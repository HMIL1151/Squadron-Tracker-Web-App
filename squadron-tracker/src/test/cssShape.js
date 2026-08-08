/**
 * Static analysis of the stylesheet layer.
 *
 * This exists because the app's CSS is global and the dashboards are lazily
 * loaded, which combine badly: six stylesheets define `.popup-overlay`, five
 * define `.popup-content`, and Vite emits one CSS chunk per lazy dashboard. So
 * which definition wins depends on which dashboards the user has opened this
 * session and in what order. Nothing in a DOM test can see that -- jsdom does
 * no layout, and the suite does not load stylesheets at all -- so the only
 * place to catch it is here, by reading the files.
 *
 * Deliberately reads from disk rather than importing. The point is to describe
 * what ships, including rules no component currently renders.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, sep } from "path";
import postcss from "postcss";

/*
 * Resolved from cwd, not from import.meta.url. Vitest rewrites import.meta.url
 * when it transforms a module for the jsdom environment, so it is not a file:
 * URL by the time this runs and fileURLToPath rejects it. Vitest always runs
 * with cwd at the project root -- the same assumption vite.config.js already
 * makes for setupFiles.
 */
const SRC = join(process.cwd(), "src");

/** Every file under `dir` matching `test`, as paths relative to src/. */
const walk = (dir, test, found = []) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, test, found);
    else if (test(entry)) found.push(relative(SRC, full).split(sep).join("/"));
  }
  return found;
};

export const cssFiles = () => walk(SRC, (f) => f.endsWith(".css")).sort();

export const sourceFiles = () =>
  walk(SRC, (f) => /\.jsx?$/.test(f) && !/\.test\.jsx?$/.test(f))
    .filter((f) => !f.startsWith("test/"))
    .sort();

const read = (rel) => readFileSync(join(SRC, rel), "utf8");

/**
 * Class names mentioned anywhere in a selector. A class inside :not() counts --
 * the file still has an opinion about it.
 */
const classesIn = (selector) =>
  [...selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]);

/**
 * The element name of a selector that targets an element with nothing
 * qualifying it.
 *
 * These matter because CSS Modules does NOT scope element selectors. A bare
 * `select {}` leaks to every <select> in the app whether or not the file it
 * lives in is named `.module.css` -- so migrating the file gives the appearance
 * of containment without the fact of it.
 */
const bareElement = (selector) => {
  const trimmed = selector.trim();
  const match = /^([a-zA-Z][a-zA-Z0-9]*)$/.exec(trimmed);
  return match ? match[1] : null;
};

/** Parse one stylesheet into the facts worth asserting on. */
export const analyseCss = (rel) => {
  const root = postcss.parse(read(rel), { from: rel });

  const classes = new Set();
  const keyframes = new Set();
  const animationRefs = new Set();
  const bareElements = new Set();

  root.walkAtRules(/^(-\w+-)?keyframes$/, (rule) => keyframes.add(rule.params.trim()));

  root.walkRules((rule) => {
    // Selectors inside @keyframes are percentages and from/to, not elements.
    if (rule.parent?.type === "atrule" && /keyframes$/.test(rule.parent.name)) return;

    for (const selector of rule.selectors) {
      classesIn(selector).forEach((c) => classes.add(c));
      const element = bareElement(selector);
      if (element) bareElements.add(element);
    }
  });

  const NON_NAME_KEYWORDS = new Set([
    "normal", "reverse", "alternate", "alternate-reverse",
    "none", "forwards", "backwards", "both",
    "running", "paused", "infinite",
    "linear", "ease", "ease-in", "ease-out", "ease-in-out", "step-start", "step-end",
    "initial", "inherit", "unset",
  ]);

  root.walkDecls(/^animation(-name)?$/, (decl) => {
    if (decl.prop === "animation-name") {
      decl.value.split(",").forEach((v) => animationRefs.add(v.trim()));
      return;
    }
    /*
     * The shorthand allows the name in any position. Rather than implement the
     * grammar, drop the tokens that provably are not a name -- times, counts,
     * timing functions and the fixed keywords -- and take the first survivor.
     */
    for (const token of decl.value.split(/\s+/)) {
      const t = token.trim();
      if (!t || NON_NAME_KEYWORDS.has(t)) continue;
      if (/^-?[\d.]+m?s$/.test(t)) continue; // duration / delay
      if (/^-?[\d.]+$/.test(t)) continue; // iteration count
      if (/^(cubic-bezier|steps)\(/.test(t)) continue;
      animationRefs.add(t);
      break;
    }
  });

  return { file: rel, classes, keyframes, animationRefs, bareElements };
};

/**
 * Class names a source file asks for.
 *
 * `dynamic` is returned separately because badge-level-${level.toLowerCase()}
 * cannot be resolved statically. Pretending otherwise would either invent
 * failures or quietly hide real ones.
 */
export const analyseSource = (rel) => {
  const text = read(rel);
  const classes = new Set();
  const dynamic = new Set();
  const BACKTICK = String.fromCharCode(96);

  const addAll = (value) => value.split(/\s+/).filter(Boolean).forEach((c) => classes.add(c));

  for (const match of text.matchAll(/className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{)/g)) {
    const literal = match[1] ?? match[2];
    if (literal !== undefined) {
      addAll(literal);
      continue;
    }

    // Expression form: take the balanced braces that follow.
    let depth = 1;
    let i = match.index + match[0].length;
    for (; i < text.length && depth > 0; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") depth--;
    }
    const expression = text.slice(match.index + match[0].length, i - 1);

    if (/\$\{/.test(expression)) dynamic.add(expression.replace(/\s+/g, " ").trim());

    /*
     * Template literals are handled separately from plain quoted strings.
     * Treating a backtick as just another quote character made
     * `App ${x ? "a" : ""}` match from the backtick to the first double quote,
     * which produced ":" and "}" as class names.
     *
     * Inside a template, a token touching an interpolation is a prefix rather
     * than a class: "badge-level-" in `badge-level-${level}` must not be
     * reported as a class the stylesheets are missing, while "App" in
     * `App ${...}` is whitespace-separated and is real. Dropping the tokens
     * adjacent to each interpolation draws that line.
     */
    const templates = new RegExp(BACKTICK + "([^" + BACKTICK + "]*)" + BACKTICK, "g");
    const withoutTemplates = expression.replace(templates, (_full, inner) => {
      inner
        .split(/\$\{[^}]*\}/)
        .flatMap((segment, index, all) => {
          const tokens = segment.split(/\s+/);
          if (index > 0) tokens.shift();
          if (index < all.length - 1) tokens.pop();
          return tokens;
        })
        .filter(Boolean)
        .forEach((c) => classes.add(c));

      // Hand back the interpolated expressions so quoted strings inside a
      // ternary are still seen by the plain-string pass below.
      return [...inner.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1]).join(" ");
    });

    for (const s of withoutTemplates.matchAll(/"([^"]*)"|'([^']*)'/g)) {
      addAll(s[1] ?? s[2]);
    }
  }

  // Belt and braces against a tokeniser slip leaking punctuation in as a class.
  for (const c of classes) if (!/^-?[_a-zA-Z][\w-]*$/.test(c)) classes.delete(c);

  return { file: rel, classes, dynamic };
};

/** Class name -> defining stylesheets, for every name defined more than once. */
export const duplicateClasses = (sheets) => {
  const owners = new Map();
  for (const sheet of sheets) {
    for (const c of sheet.classes) {
      if (!owners.has(c)) owners.set(c, []);
      owners.get(c).push(sheet.file);
    }
  }
  return new Map([...owners].filter(([, files]) => files.length > 1).sort());
};

/** animation references whose @keyframes lives in a different file, or nowhere. */
export const crossFileAnimations = (sheets) => {
  const found = [];
  for (const sheet of sheets) {
    for (const name of sheet.animationRefs) {
      if (sheet.keyframes.has(name)) continue;
      found.push({
        file: sheet.file,
        name,
        definedIn: sheets.filter((s) => s.keyframes.has(name)).map((s) => s.file),
      });
    }
  }
  return found;
};
