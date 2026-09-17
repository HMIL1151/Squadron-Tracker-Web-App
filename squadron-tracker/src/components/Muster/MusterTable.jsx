import { useId } from "react";
import styles from "./MusterTable.module.css";

/**
 * The table, which on most of these screens IS the screen.
 *
 * Two things are deliberately different from the classic Table component.
 *
 * Filter and sort controls are not inside the header cells. Classic puts a
 * text input and a Sort button in every `<th>`, which is why its header band
 * is sixty pixels of chrome above every table in the app, and why the column
 * titles are the smallest text in their own row. Here the header is column
 * names and nothing else; the controls live in a toolbar above, passed in as
 * `toolbar`.
 *
 * Columns declare how to render a cell rather than handing over a value to be
 * stringified. Half of these screens need a coloured flight bar, a badge chip
 * or a progress bar in a cell, and the classic table's answer -- map the value
 * through a switch on the column NAME -- meant every new cell type edited a
 * shared component.
 *
 * Sorting is the caller's job. It needs the underlying value rather than the
 * rendered node, and every screen here already derives its rows.
 */

/*
 * Explicit maps rather than `styles["cell-" + align]`. Scoped class names do
 * not survive string concatenation, and a missed lookup renders
 * class="undefined" rather than failing, which the afterEach guard in
 * setupTests.js exists to catch.
 */
const HEAD_ALIGN = {
  left: styles["head-left"],
  right: styles["head-right"],
  center: styles["head-center"],
};

const CELL_ALIGN = {
  left: styles["cell-left"],
  right: styles["cell-right"],
  center: styles["cell-center"],
};

const ROW_STATE = {
  selected: styles["row-selected"],
  plain: styles.row,
};

const MusterTable = ({
  columns,
  rows,
  getRowKey,
  onRowClick,
  selectedKey = null,
  toolbar = null,
  caption,
  empty = null,
  footer = null,
}) => {
  const captionId = useId();
  const isInteractive = typeof onRowClick === "function";

  return (
    <div className={styles.frame}>
      {toolbar && <div className={styles.toolbar}>{toolbar}</div>}

      <div className={styles.scroll}>
        <table className={styles.table} aria-describedby={caption ? captionId : undefined}>
          {caption && (
            <caption id={captionId} className={styles.caption}>
              {caption}
            </caption>
          )}
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={HEAD_ALIGN[column.align] || HEAD_ALIGN.left}
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const key = getRowKey(row);
              const isSelected = selectedKey !== null && key === selectedKey;
              return (
                <tr
                  key={key}
                  className={isSelected ? ROW_STATE.selected : ROW_STATE.plain}
                  /*
                   * A click handler on a <tr> is unreachable by keyboard, so an
                   * interactive table gets a real button in its first cell
                   * instead -- see the `interactive` column helper below. This
                   * handler is the mouse convenience on top of that, not the
                   * only way in.
                   */
                  onClick={isInteractive ? () => onRowClick(row) : undefined}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={CELL_ALIGN[column.align] || CELL_ALIGN.left}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>

        {rows.length === 0 && empty}
      </div>

      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
};

export default MusterTable;
