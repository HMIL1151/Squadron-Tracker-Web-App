/**
 * Text contrast, measured against the token file rather than eyeballed.
 *
 * Every one of these pairs is a real combination the app renders -- white text
 * on a coloured button, body text on a surface -- and four of them failed WCAG
 * AA when this was written. The primary action button was 2.78:1 against the
 * 4.5:1 minimum, which is the sort of thing nobody notices until someone cannot
 * read it.
 *
 * Reads tokens.css from disk and resolves var() chains itself. The alternative
 * -- asserting against a hardcoded copy of the palette -- would pass forever
 * while the real values drifted, which is precisely the failure this is meant
 * to prevent.
 *
 * Deliberately not a lint rule: contrast is a property of a PAIR, and no
 * stylesheet linter knows which text colour lands on which background.
 */

import { readFileSync } from "fs";
import { join } from "path";

const AA_NORMAL = 4.5;
const AA_LARGE = 3.0; // 18pt+, or 14pt+ bold

const raw = readFileSync(join(process.cwd(), "src/Styles/tokens.css"), "utf8");

/**
 * Everything except @media print.
 *
 * That block deliberately forces the LIGHT values back on for a dark-theme
 * user who prints, so a naive scan reads its `--color-text: #333` as the dark
 * theme's body colour and then measures it against a dark surface. The first
 * version of this test did exactly that and reported three failures that were
 * its own misreading rather than anything wrong with the palette.
 *
 * Brace-matched rather than regexed, because the block contains nested rules.
 */
const stripPrintBlock = (text) => {
  const start = text.indexOf("@media print");
  if (start === -1) return text;
  let depth = 0;
  for (let i = text.indexOf("{", start); i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return text.slice(0, start) + text.slice(i + 1);
  }
  return text.slice(0, start);
};

const css = stripPrintBlock(raw);

/**
 * Token values for one theme.
 *
 * Light is everything in the plain :root blocks; dark is those overridden by
 * :root[data-theme="dark"]. The media-query copy is deliberately skipped -- it
 * carries the same values, and parsing both would only assert twice.
 */
const readTokens = (theme) => {
  const values = {};
  for (const [, isDark, body] of css.matchAll(/:root(\[data-theme="dark"\])?\s*\{([^}]*)\}/g)) {
    // Light reads only the plain :root blocks. Dark reads those too and then
    // lets the dark block override, which is what the cascade does.
    if (theme === "light" && isDark) continue;
    for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      values[name] = value.trim();
    }
  }
  return values;
};

/** Follow var() chains to a literal colour. */
const resolve = (values, name, depth = 0) => {
  const value = values[name];
  if (!value || depth > 10) return value;
  const match = value.match(/^var\((--[\w-]+)\)$/);
  return match ? resolve(values, match[1], depth + 1) : value;
};

const toRgb = (colour) => {
  const rgba = colour.match(/rgba?\(([^)]+)\)/);
  if (rgba) return rgba[1].split(",").slice(0, 3).map((n) => parseFloat(n));
  let hex = colour.replace("#", "").trim();
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
};

const luminance = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (a, b) => {
  const [l1, l2] = [luminance(toRgb(a)), luminance(toRgb(b))];
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
};

/** Pairs the app actually renders, as [background, foreground, minimum]. */
const PAIRS = [
  // Against the on-colour, not a blanket white: dark mode lightens these
  // surfaces and darkens their text, and asserting white here would demand a
  // combination the app no longer renders.
  ["--color-action", "--color-on-action", AA_NORMAL],
  ["--color-action-hover", "--color-on-action", AA_NORMAL],
  ["--color-danger", "--color-on-danger", AA_NORMAL],
  ["--color-danger-hover", "--color-on-danger", AA_NORMAL],
  ["--color-accent", "--color-on-accent", AA_NORMAL],
  ["--color-accent-hover", "--color-on-accent", AA_NORMAL],
  ["--color-logout", "--color-on-danger", AA_NORMAL],
  ["--color-logout-hover", "--color-on-danger", AA_NORMAL],
  ["--color-surface", "--color-text", AA_NORMAL],
  ["--color-surface", "--color-text-muted", AA_NORMAL],
  ["--color-surface-sunken", "--color-text", AA_NORMAL],
  ["--color-surface-muted", "--color-text", AA_NORMAL],
  ["--color-app-bar", "--color-text-inverse", AA_NORMAL],
  ["--color-button-neutral", "--color-button-neutral-text", AA_NORMAL],
  ["--color-warning-bg", "--color-text", AA_NORMAL],
  ["--color-success-bg", "--color-text", AA_NORMAL],
  ["--color-error-bg", "--color-text", AA_NORMAL],
  // The version number in the corner is small but decorative-adjacent; it is
  // held to the large-text bar rather than exempted entirely.
  ["--color-surface", "--color-text-faint", AA_LARGE],
];

describe.each(["light", "dark"])("%s theme contrast", (theme) => {
  const values = readTokens(theme);

  it("resolves the tokens it is asserting on", () => {
    // Guards against a rename silently turning every assertion below into a
    // comparison of two undefineds.
    expect(Object.keys(values).length).toBeGreaterThan(30);
    expect(resolve(values, "--color-action")).toMatch(/^#|^rgb/);
  });

  it.each(PAIRS)("%s against %s meets AA", (bgToken, fgToken, minimum) => {
    const bg = resolve(values, bgToken);
    const fg = resolve(values, fgToken);
    expect(bg, `${bgToken} did not resolve`).toBeTruthy();
    expect(fg, `${fgToken} did not resolve`).toBeTruthy();

    const ratio = contrast(bg, fg);
    expect(
      Number(ratio.toFixed(2)),
      `${bgToken} (${bg}) on ${fgToken} (${fg}) is ${ratio.toFixed(2)}:1, needs ${minimum}:1`
    ).toBeGreaterThanOrEqual(minimum);
  });
});
