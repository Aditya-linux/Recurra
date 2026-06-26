import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger.js';

const router = Router();

// Escape CSV field (handles commas, quotes, newlines)
function escapeCSV(field: string | number | undefined | null): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

router.post('/', async (req, res) => {
  try {
    const { name, email, walletAddress, spend, type, message } = req.body;
    
    // Required fields check (basic)
    if (!name || !message) {
      return res.status(400).json({ error: 'Name and message are required' });
    }

    const csvFilePath = path.join(process.cwd(), 'feedback.csv');
    const date = new Date().toISOString();

    const newRow = [
      escapeCSV(date),
      escapeCSV(name),
      escapeCSV(email || 'N/A'),
      escapeCSV(walletAddress || 'N/A'),
      escapeCSV(spend || '0'),
      escapeCSV(type),
      escapeCSV(message)
    ].join(',') + '\n';

    // If file doesn't exist, create it with headers
    if (!fs.existsSync(csvFilePath)) {
      const headers = 'Date,Name,Email,Address,Transactions,Type,Area for Improvement\n';
      fs.writeFileSync(csvFilePath, headers + newRow);
    } else {
      fs.appendFileSync(csvFilePath, newRow);
    }

    logger.info('Feedback saved to CSV', { walletAddress, type });
    return res.status(201).json({ success: true, message: 'Feedback saved successfully' });
  } catch (error) {
    logger.error('Failed to save feedback', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export const feedbackRoutes = router;
