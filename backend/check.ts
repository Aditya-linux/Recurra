import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

async function checkSheet() {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!sheetId || !clientEmail || !privateKey) {
    console.error('Missing credentials');
    return;
  }

  const serviceAccountAuth = new JWT({
    email: clientEmail,
    key: privateKey.replace(/\\n/g, '\n').replace(/"/g, '').trim(),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
  await doc.loadInfo();
  
  const sheet = doc.sheetsByIndex[0];
  console.log(`Sheet Title: ${sheet.title}`);
  console.log(`Sheet Grid Properties: Rows: ${sheet.rowCount}, Columns: ${sheet.columnCount}`);
  
  // Try to read all rows with data
  await sheet.loadCells();
  console.log('--- Non-empty Cells ---');
  let dataFound = false;
  
  // Iterate over some reasonable bounds
  const maxRows = Math.min(sheet.rowCount, 2000);
  for (let r = 0; r < maxRows; r++) {
    const rowValues = [];
    for (let c = 0; c < 8; c++) {
      const cell = sheet.getCell(r, c);
      if (cell.value) {
        rowValues.push(cell.value);
      }
    }
    if (rowValues.length > 0) {
      console.log(`Row ${r + 1}:`, rowValues.join(' | '));
      dataFound = true;
    }
  }
  
  if (!dataFound) {
    console.log('No data found in the first 2000 rows.');
  }
}

checkSheet().catch(console.error);
