import { useId, useMemo, useState } from "react";
import styles from "./MusterTable.module.css";

/**
 * The table, which on most of these screens IS the screen.
 *
 * Sorting and per-column filtering live here rather than in each screen, so
 * every Muster table behaves the same way and a screen only has to say which
 * columns are sortable and which are filterable.
 *
 * The classic Table puts a text input AND a Sort button inside every `<th>`,
 * which is why its header band is sixty pixels of chrome and the column titles
 * are the smallest text in their own row. The behaviour was right; the placing
 * was not. Here the column title IS the sort control -- one click to sort, a
 * second to reverse -- and the filter inputs sit in a slim second header row
 * that only appears when a screen asks for it.
 *
 * Columns declare how to render a cell rather than handing over a value to be
 * stringified, because half of these screens need a coloured flight bar, a
 * badge chip or a progress bar in a cell. Sorting and filtering therefore need
 * their own accessors -- `sortValue` and `filterValue` -- since the rendered
 * node is a React element and cannot be compared or searched.
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

const SORT_STATE = {
  asc: styles["sort-asc"],
  desc: styles["sort-desc"],
  none: styles.sort,
};

/** What a column contributes to sorting, falling back to its filter text. */
const sortKeyOf = (column, row) => {
  if (column.sortValue) return column.sortValue(row);
  if (column.filterValue) return column.filterValue(row);
  return null;
};

const compare = (a, b) => {
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "en-GB", { numeric: true });
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
  /**
   * The column sorted on first load, as `{ key, direction }`.
   *
   * Without one the table shows whatever order the screen handed it, which is
   * usually meaningful (newest first, name order) -- so this is opt-in rather
   * than a default of "first column ascending".
   */
  defaultSort = null,
}) => {
  const captionId = useId();
  const filterId = useId();
  const isInteractive = typeof onRowClick === "function";

  const [sort, setSort] = useState(defaultSort);
  const [filters, setFilters] = useState({});

  const filterable = columns.filter((column) => column.filterValue);
  const hasFilters = filterable.length > 0;

  const toggleSort = (column) => {
    setSort((current) =>
      current && current.key === column.key
        ? { key: column.key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key: column.key, direction: "asc" }
    );
  };

  const visible = useMemo(() => {
    const active = Object.entries(filters).filter(([, value]) => value.trim() !== "");

    let result = rows;

    if (active.length) {
      result = result.filter((row) =>
        active.every(([key, value]) => {
          const column = columns.find((c) => c.key === key);
          if (!column?.filterValue) return true;
          return String(column.filterValue(row)).toLowerCase().includes(value.trim().toLowerCase());
        })
      );
    }

    if (sort) {
      const column = columns.find((c) => c.key === sort.key);
      if (column) {
        // Copied before sorting: the caller owns `rows` and a sort in place
        // would reorder their state behind their back.
        result = [...result].sort((a, b) => {
          const order = compare(sortKeyOf(column, a), sortKeyOf(column, b));
          return sort.direction === "asc" ? order : -order;
        });
      }
    }

    return result;
  }, [rows, columns, filters, sort]);

  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

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
              {columns.map((column) => {
                const isSorted = sort?.key === column.key;
                const direction = isSorted ? sort.direction : null;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={HEAD_ALIGN[column.align] || HEAD_ALIGN.left}
                    style={column.width ? { width: column.width } : undefined}
                    /*
                     * aria-sort on the header, so a screen reader announces the
                     * order rather than leaving it to the caret glyph.
                     */
                    aria-sort={isSorted ? (direction === "asc" ? "ascending" : "descending") : undefined}
                  >
                    {column.sortValue || column.filterValue ? (
                      <button
                        type="button"
                        className={SORT_STATE[direction || "none"]}
                        onClick={() => toggleSort(column)}
                      >
                        {column.header}
                        <svg
                          className={styles.caret}
                          width="9"
                          height="9"
                          viewBox="0 0 12 12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          {direction === "desc" ? <path d="M2.5 4.5 6 8l3.5-3.5" /> : <path d="M2.5 7.5 6 4l3.5 3.5" />}
                        </svg>
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>

            {hasFilters && (
              <tr className={styles["filter-row"]}>
                {columns.map((column) => (
                  <th key={column.key} scope="col" className={styles["filter-cell"]}>
                    {column.filterValue && (
                      <>
                        <label htmlFor={`${filterId}-${column.key}`} className={styles["visually-hidden"]}>
                          Filter by {column.header}
                        </label>
                        <input
                          id={`${filterId}-${column.key}`}
                          type="search"
                          className={styles["filter-input"]}
                          value={filters[column.key] || ""}
                          onChange={(event) => setFilter(column.key, event.target.value)}
                          placeholder="Filter"
                        />
                      </>
                    )}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {visible.map((row) => {
              const key = getRowKey(row);
              const isSelected = selectedKey !== null && key === selectedKey;
              return (
                <tr
                  key={key}
                  className={isSelected ? ROW_STATE.selected : ROW_STATE.plain}
                  /*
                   * A click handler on a <tr> is unreachable by keyboard, so an
                   * interactive table gives its first cell a real control. This
                   * is the mouse convenience on top of that, not the only way in.
                   */
                  onClick={isInteractive ? () => onRowClick(row) : undefined}
                >
                  {columns.map((column) => (
                    <td key={column.key} className={CELL_ALIGN[column.align] || CELL_ALIGN.left}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>

        {visible.length === 0 && empty}
      </div>

      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
};

export default MusterTable;
