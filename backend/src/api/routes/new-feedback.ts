import { Router } from 'express';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { logger } from '../../utils/logger.js';

const router = Router();

// ─── POST /api/v1/new-feedback ───────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, email, walletAddress, spend, type, message, rating } = req.body;

    // Required fields check
    if (!name || !message || !rating) {
      return res.status(400).json({ error: 'Name, message, and rating are required' });
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
    
    // Append row using array format to avoid needing headers loaded and prevent clearing the sheet
    // We add rating as the 8th column
    await sheet.addRow([
      new Date().toISOString(),
      walletAddress || 'N/A',
      name,
      email || 'N/A',
      type || 'general',
      message,
      spend || '0',
      rating || 'N/A'
    ]);

    logger.info('New Feedback with rating saved to Google Sheets', { walletAddress, type, rating });
    return res.status(201).json({ success: true, message: 'Feedback saved successfully' });
  } catch (error) {
    logger.error('Failed to save feedback to Google Sheets', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export const newFeedbackRoutes = router;
