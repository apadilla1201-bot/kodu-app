/**
 * Smoke test for lib/pa-parser.ts — verifies the isomorphic parser works
 * with Uint8Array input (the browser path) and that per-file failures
 * throw catchable errors instead of killing the batch.
 * Run: npx tsx scripts/test-pa-parser.ts
 */
import * as XLSX from 'xlsx';
import { parseExcelBuffer, sortParsedPAs, toPreviewPA } from '../lib/pa-parser';

function makeWorkbook(appNo: number, periodTo: string, schedValue: number): Uint8Array {
  const settings = XLSX.utils.aoa_to_sheet([
    [],
    ['', 'PAY APPLICATION NUMBER', appNo],
    ['', 'PERIOD TO', periodTo],
    ['', 'APPLICATION DATE', periodTo],
    ['', 'ORIGINAL CONTRACT SUM', 1500000],
  ]);
  const g702 = XLSX.utils.aoa_to_sheet([
    ['TO OWNER', '', '', 'PROJECT'],
    ['OWNER LLC', '', '', ''],
    ['FROM CONTRACTOR', '', '', ''],
    ['GC COMPANY LLC', '', '', ''],
    [],
    ['APPLICATION NO:', appNo, '', 'APPLICATION DATE:', periodTo],
    ['', '', '', 'PERIOD TO:', periodTo],
    [],
    ['1. ORIGINAL CONTRACT SUM', '', '', 1500000],
    ['2. NET CHANGE BY CHANGE ORDERS', '', '', 0],
    ['3. CONTRACT SUM TO DATE', '', '', 1500000],
    ['9. CURRENT PAYMENT DUE', '', '', 125000],
  ]);
  const g703 = XLSX.utils.aoa_to_sheet([
    [],
    ['ITEM', 'DESCRIPTION', 'SUB', 'SCHEDULED VALUE', '', '', '', '', 'PREV COMPLETED', 'THIS PERIOD'],
    ['01000', 'GENERAL CONDITIONS', 'Self', 250000, '', '', '', '', 100000, 50000],
    ['02000', 'SITE WORK', 'Excavator Co', 350000, '', '', '', '', 200000, 75000],
    ['GRAND TOTAL', '', '', 600000],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, settings, 'PROJECT SETTINGS');
  XLSX.utils.book_append_sheet(wb, g702, 'G702');
  XLSX.utils.book_append_sheet(wb, g703, 'G703');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(out);
}

let failures = 0;
function check(name: string, cond: boolean, extra?: any) {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures++; console.error(`  FAIL  ${name}`, extra ?? ''); }
}

console.log('1) Parse valid workbook (Uint8Array, browser path)');
const pa1 = parseExcelBuffer(makeWorkbook(2, '06/30/2026', 600000), 'PA-002.xlsx');
check('applicationNumber = 2', pa1.headerData.applicationNumber === 2, pa1.headerData.applicationNumber);
const ptd = new Date(pa1.headerData.periodTo);
check('periodTo parsed (local calendar day)', ptd.getFullYear() === 2026 && ptd.getMonth() === 5 && ptd.getDate() === 30, pa1.headerData.periodTo);
check('sheetsFound all true', pa1.sheetsFound.g702 && pa1.sheetsFound.g703 && pa1.sheetsFound.settings);
check('lineItems = 2 (grand total skipped)', pa1.lineItems.length === 2, pa1.lineItems.map((l: any) => l.itemNumber));
check('scheduledValue sums', pa1.lineItems.reduce((s: number, l: any) => s + l.scheduledValue, 0) === 600000);

console.log('2) Chronological sort');
const paOld = parseExcelBuffer(makeWorkbook(9, '01/31/2026', 100), 'zzz-later-number.xlsx');
const sorted = sortParsedPAs([pa1, paOld]);
check('older periodTo first', sorted[0].fileName === 'zzz-later-number.xlsx', sorted.map(p => p.fileName));

console.log('3) Preview shape');
const pv = toPreviewPA(pa1);
check('preview fields', pv.applicationNumber === 2 && pv.lineItemCount === 2 && pv.scheduledValue === 600000, pv);

console.log('4) Corrupt file throws catchable error (per-file isolation)');
let threw = false;
try {
  parseExcelBuffer(new Uint8Array([1, 2, 3, 4, 5]), 'corrupt.xlsx');
} catch { threw = true; }
check('corrupt file throws', threw);

console.log('5) Workbook with no AIA sheets throws descriptive error');
const blankWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(blankWb, XLSX.utils.aoa_to_sheet([['hello']]), 'Random');
let msg = '';
try {
  parseExcelBuffer(new Uint8Array(XLSX.write(blankWb, { type: 'array', bookType: 'xlsx' })), 'random.xlsx');
} catch (e: any) { msg = e.message; }
check('descriptive error', msg.includes('G702'), msg);

console.log('6) JSON round-trip (parsedJson payload for import)');
const json = JSON.stringify([pa1, paOld]);
const back = JSON.parse(json);
check('survives JSON round-trip', back.length === 2 && back[0].lineItems.length === 2);
check('payload is compact', json.length < 200_000, `${(json.length / 1024).toFixed(0)} KB`);

if (failures) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log('\nAll parser tests passed.');
