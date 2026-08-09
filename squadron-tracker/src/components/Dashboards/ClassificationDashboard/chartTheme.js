/**
 * Chart.js colours, read from the token layer.
 *
 * Charts paint to a canvas, so nothing about them is reachable from CSS. That
 * matters more than it sounds: Chart.js's built-in defaults are tuned for a
 * light background -- #666 tick labels, rgba(0,0,0,0.1) gridlines, a dark
 * tooltip -- and none of them are written down anywhere in this app. Left
 * alone, dark mode's most visible failure would be black axis labels on a dark
 * card, from code nobody had touched.
 *
 * The values come from CSS rather than being duplicated here, so a change to
 * the theme reaches the chart without anyone remembering this file exists.
 * getComputedStyle on the document element resolves whatever the active theme
 * has set, which is the only way canvas code can ask.
 */

/** Resolve a custom property to its computed value, with a fallback. */
export const token = (name, fallback) => {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name);
  return value?.trim() || fallback;
};

/**
 * Point Chart.js's global defaults at the theme.
 *
 * Set globally rather than threaded through each chart's options: there are
 * roughly ten keys involved -- tick colour, grid colour, axis title colour,
 * legend labels, tooltip background and text -- and every one of them is
 * currently absent from the options object, relying on a light-tuned default.
 * Adding them per chart would mean remembering all ten again for the next
 * chart. Doing it once at the root covers charts nobody has written yet.
 */
export const applyChartTheme = (ChartJS) => {
  const text = token("--color-text", "#333");
  const tick = token("--chart-tick", "#666");
  const grid = token("--chart-grid", "rgba(0, 0, 0, 0.1)");
  const border = token("--color-border", "#ccc");
  const surface = token("--color-surface", "#fff");

  ChartJS.defaults.color = text;
  ChartJS.defaults.borderColor = grid;

  /*
   * No entry animation.
   *
   * Two reasons, and either alone would justify it. Chart.js animates into a
   * canvas, which the reduced-motion rule in Styles/index.css cannot reach --
   * a user who has asked the operating system for less movement gets it
   * everywhere in this app except here. And it makes the chart
   * nondeterministic: the visual baseline for this dashboard varied by a few
   * thousand pixels between consecutive runs depending on where the animation
   * had got to, which is the sort of flake that trains people to re-run a
   * suite rather than read it.
   *
   * The chart shows a static snapshot of cadet progression. Nothing is
   * communicated by watching the points slide into place.
   */
  ChartJS.defaults.animation = false;
  ChartJS.defaults.animations = {};

  if (ChartJS.defaults.scale) {
    ChartJS.defaults.scale.grid = { ...ChartJS.defaults.scale.grid, color: grid };
    ChartJS.defaults.scale.ticks = { ...ChartJS.defaults.scale.ticks, color: tick };
  }
  if (ChartJS.defaults.plugins?.legend?.labels) {
    ChartJS.defaults.plugins.legend.labels.color = text;
  }
  if (ChartJS.defaults.plugins?.tooltip) {
    Object.assign(ChartJS.defaults.plugins.tooltip, {
      backgroundColor: surface,
      titleColor: text,
      bodyColor: text,
      borderColor: border,
      borderWidth: 1,
    });
  }
};

/**
 * The crosshair colours, read at draw time.
 *
 * The plugin is registered on the ChartJS singleton at module scope, outside
 * React entirely, so it has no props, no context and no way to be told the
 * theme changed. Reading the tokens off the canvas inside afterDraw is the one
 * bridge available -- the canvas is in the document, so it inherits whatever
 * :root currently says, and a theme switch is picked up on the next repaint
 * with no subscription to keep in sync.
 */
export const crosshairColours = () => ({
  line: token("--chart-crosshair", "rgba(0, 0, 0, 0.3)"),
  label: token("--chart-crosshair-label", "rgba(0, 0, 0, 0.7)"),
});
