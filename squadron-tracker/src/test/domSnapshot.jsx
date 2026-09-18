/**
 * Serialisers for golden-master snapshots.
 *
 * Deliberately NOT raw HTML. Later phases change styling on purpose -- the
 * Flight Points chart becomes a real chart component, folders and classes get
 * renamed -- and a style-coupled snapshot would produce a large diff on every
 * one of those, which trains people to approve snapshot changes without reading
 * them. That would quietly destroy the safety net.
 *
 * So these capture what a user would notice -- structure, text, form state,
 * and the class names that encode UI state -- and drop inline styles entirely.
 */

/** Attributes worth recording. `style` is excluded on purpose. */
const INTERESTING_ATTRS = ["class", "id", "type", "placeholder", "value", "disabled", "checked", "for", "role", "aria-label", "colspan", "rowspan"];

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "LINK", "META"]);

const squash = (s) => s.replace(/\s+/g, " ").trim();

const describeAttrs = (el) => {
  const parts = [];
  INTERESTING_ATTRS.forEach((name) => {
    if (!el.hasAttribute(name)) return;
    const value = el.getAttribute(name);
    // A class attribute that is empty carries no information.
    if (value === "" && name === "class") return;
    parts.push(`${name}="${squash(value)}"`);
  });

  // Form controls hold their current value as a property, not an attribute.
  if (el.tagName === "INPUT" && el.type !== "checkbox" && el.value) {
    if (!el.hasAttribute("value")) parts.push(`value="${squash(el.value)}"`);
  }
  if (el.tagName === "INPUT" && el.type === "checkbox") {
    parts.push(`checked=${el.checked}`);
  }
  if (el.tagName === "SELECT") {
    parts.push(`selected="${squash(el.value)}"`);
  }

  return parts.length ? ` ${parts.join(" ")}` : "";
};

/**
 * An indented outline of an element tree: tag, notable attributes, and text.
 * Stable across restyling, sensitive to anything a user would see change.
 */
export const toStructure = (root, depth = 0) => {
  const lines = [];

  const walk = (node, level) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = squash(node.textContent);
      if (text) lines.push(`${"  ".repeat(level)}"${text}"`);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (SKIP_TAGS.has(node.tagName)) return;

    lines.push(`${"  ".repeat(level)}<${node.tagName.toLowerCase()}${describeAttrs(node)}>`);
    node.childNodes.forEach((child) => walk(child, level + 1));
  };

  walk(root, depth);
  return lines.join("\n");
};

/**
 * A rendered <table> as a plain array of rows.
 *
 * For data-bearing dashboards this is the assertion that actually matters --
 * it reads as the numbers a squadron would see, so a wrong points total shows
 * up as a wrong number rather than as an opaque markup diff.
 *
 * Header cells keep only their label; the shared Table component puts a filter
 * input and a Sort button in every <th>, which are noise here.
 */
export const tableToRows = (table) => {
  if (!table) throw new Error("tableToRows: no table given");

  /*
   * Only the FIRST header row. Muster tables carry a second one holding a
   * filter box per column; counting those as headers would give a table of
   * five columns ten header names and shift every assertion by five.
   */
  const headerRow = table.querySelector("thead tr");

  /*
   * A column's name, from either interface.
   *
   * Classic puts the name in the cell as text, alongside a Filter input and a
   * Sort button -- so stripping both is what leaves the name. Muster makes the
   * name itself the sort control, so stripping buttons leaves nothing.
   *
   * Hence: strip the controls, and if that empties the cell, fall back to the
   * text with buttons kept. Neither interface has to know this exists, and the
   * classic headers come out exactly as they did before.
   */
  const headers = [...(headerRow ? headerRow.children : [])].map((th) => {
    const withoutInputs = th.cloneNode(true);
    withoutInputs.querySelectorAll("input").forEach((n) => n.remove());

    const withoutControls = withoutInputs.cloneNode(true);
    withoutControls.querySelectorAll("button").forEach((n) => n.remove());

    return squash(withoutControls.textContent) || squash(withoutInputs.textContent);
  });

  const rows = [...table.querySelectorAll("tbody tr")].map((tr) =>
    [...tr.querySelectorAll("td")].map((td) => squash(td.textContent))
  );

  return { headers, rows };
};

/** Every table in a container, keyed by index. */
export const allTables = (container) =>
  [...container.querySelectorAll("table")].map((t) => tableToRows(t));

/**
 * Table rows as objects keyed by header, for readable assertions:
 *   expect(rowsByHeader(table)).toContainEqual({ Name: "Amelia Hart", Points: "5" })
 */
export const rowsByHeader = (table) => {
  const { headers, rows } = tableToRows(table);
  return rows.map((cells) =>
    Object.fromEntries(cells.map((cell, i) => [headers[i] ?? `col${i}`, cell]))
  );
};

/** Visible button labels, in document order. */
export const buttonLabels = (container) =>
  [...container.querySelectorAll("button")].map((b) => squash(b.textContent)).filter(Boolean);
