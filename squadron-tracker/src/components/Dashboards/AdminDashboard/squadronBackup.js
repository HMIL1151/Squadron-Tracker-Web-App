/**
 * Fetch a squadron, turn it into CSV files, hand the browser a zip.
 *
 * The three steps live apart on purpose: src/firebase/backup.js knows about
 * Firestore, src/utils/backupCsv.js is pure formatting, and this module is the
 * only part that touches the browser's download machinery. That keeps the CSV
 * layouts testable without jsdom and the fetch testable without JSZip.
 *
 * Four files rather than one: the collections have nothing in common
 * column-wise, and a single sheet would either be mostly empty or need a
 * hand-written key to read. A zip also matches how certificates already
 * download, so the flow is familiar.
 */

import JSZip from "jszip";
import { saveAs } from "file-saver";

import { fetchSquadronBackup } from "../../../firebase/backup";
import { backupFileName, buildBackupFiles } from "../../../utils/backupCsv";

/**
 * Build and save the backup.
 *
 * Errors are left to propagate: the caller owns the UI and can say what
 * happened, which is more useful than a console line and a button that
 * silently does nothing.
 *
 * @returns the file name saved, so callers can report it
 */
export const downloadSquadronBackup = async (squadronNumber) => {
  const data = await fetchSquadronBackup(squadronNumber);
  const files = buildBackupFiles(data, squadronNumber);

  const zip = new JSZip();
  Object.entries(files).forEach(([name, contents]) => zip.file(name, contents));

  const blob = await zip.generateAsync({ type: "blob" });
  const name = backupFileName(squadronNumber);
  saveAs(blob, name);

  return name;
};

export default downloadSquadronBackup;
