import { Router } from 'express';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { logger } from '../../utils/logger.js';

const router = Router();

// ─── POST /api/v1/feedback ───────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, email, walletAddress, spend, type, message } = req.body;

    // Required fields check
    if (!name || !message) {
      return res.status(400).json({ error: 'Name and message are required' });
    }

    const sheetId = process.env.GOOGLE_SHEET_ID;
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!sheetId || !clientEmail || !privateKey) {
      logger.error('Google Sheets credentials not configured');
      return res.status(500).json({ error: 'Feedback system not fully configured (missing env vars)' });
    }

    // Initialize auth
    const serviceAccountAuth = new JWT({
      email: clientEmail,
      // Replace escaped newlines if they exist
      key: privateKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
    await doc.loadInfo(); // loads document properties and worksheets
    
    // Use the first sheet
    const sheet = doc.sheetsByIndex[0];
    
    if (!sheet) {
      throw new Error('No sheet found in the document');
    }
    
    // Note: If the sheet is completely blank, we set the headers first.
    // However, it's safer to ensure the user sets the headers in Google Sheets as per the instructions.
    try {
      await sheet.loadHeaderRow();
    } catch (e) {
      // If headers aren't found, try setting them
      await sheet.setHeaderRow([
        'Date', 'Wallet Address', 'Name', 'Email', 'Feedback Type', 'Feedback', 'Total Spend (XLM)'
      ]);
    }

    // Append row
    await sheet.addRow({
      'Date': new Date().toISOString(),
      'Wallet Address': walletAddress || 'N/A',
      'Name': name,
      'Email': email || 'N/A',
      'Feedback Type': type || 'general',
      'Feedback': message,
      'Total Spend (XLM)': spend || '0',
    });

    logger.info('Feedback saved to Google Sheets', { walletAddress, type });
    return res.status(201).json({ success: true, message: 'Feedback saved successfully' });
  } catch (error) {
    logger.error('Failed to save feedback to Google Sheets', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export const feedbackRoutes = router;
