/**
 * ByahengPabama evaluation survey: saves each response as a row in the
 * "Responses" tab of the Google Sheet this script is attached to.
 *
 * Set up (once):
 *   1. Open the Sheet, then Extensions > Apps Script.
 *   2. Replace everything in Code.gs with this file and click Save.
 *   3. Deploy > New deployment > Select type: Web app.
 *        Execute as: Me
 *        Who has access: Anyone
 *      Click Deploy, allow access, and copy the Web app URL (ends in /exec).
 *   4. Put that URL in survey/config.js of the demo site.
 *
 * After changing this code, use Deploy > Manage deployments > Edit >
 * Version: New version, so the same URL keeps working.
 */

const SHEET_NAME = 'Responses';
const ROLES = ['Passenger', 'Line Inspector', 'Admin staff', 'IT practitioner'];
const ISO_ITEMS = 18;
const SUS_ITEMS = 10;
const MAX_TEXT = 1000;

// Which parts each role answers (same rules as the survey page and Chapter 3).
const ANSWERS_ISO = { 'Passenger': false, 'Line Inspector': true, 'Admin staff': true, 'IT practitioner': true };
const ANSWERS_SUS = { 'Passenger': true, 'Line Inspector': true, 'Admin staff': true, 'IT practitioner': false };

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const row = toRow(data);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

    // A response sent twice (for example, after a weak connection) is saved once.
    const seen = sheet.getRange('B:B').createTextFinder(row[1]).matchEntireCell(true).findNext();
    if (!seen) sheet.appendRow(row);

    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return reply({ ok: true, message: 'The ByahengPabama survey is receiving responses.' });
}

function toRow(d) {
  const id = String(d.id || '');
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) throw new Error('Missing response ID.');
  if (ROLES.indexOf(d.role) < 0) throw new Error('Unknown role.');
  if (d.consent !== true) throw new Error('Consent is required.');

  const iso = ratings(d.iso, ISO_ITEMS, ANSWERS_ISO[d.role]);
  const sus = ratings(d.sus, SUS_ITEMS, ANSWERS_SUS[d.role]);
  const text = (v) => String(v || '').replace(/^[=+\-@]/, "'$&").slice(0, MAX_TEXT);

  return [new Date(), id, d.role, 'Yes']
    .concat(iso, sus, [susScore(sus)], [text(d.q1), text(d.q2), text(d.q3)]);
}

/** Ratings from 1 to 5, all required when the role answers that part. */
function ratings(list, count, required) {
  if (!required) return new Array(count).fill('');
  if (!Array.isArray(list) || list.length !== count) throw new Error('Some statements were not answered.');
  return list.map((v) => {
    const n = Number(v);
    if (!(n >= 1 && n <= 5 && Math.floor(n) === n)) throw new Error('Ratings must be from 1 to 5.');
    return n;
  });
}

/** SUS score from 0 to 100 (Brooke, 1996). */
function susScore(sus) {
  if (sus[0] === '') return '';
  let sum = 0;
  sus.forEach((v, i) => { sum += i % 2 === 0 ? v - 1 : 5 - v; });
  return sum * 2.5;
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
