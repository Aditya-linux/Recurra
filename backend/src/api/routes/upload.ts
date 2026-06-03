import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';

export const uploadRoutes = Router();

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    // Relative to the project root
    cb(null, 'public/uploads/');
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only images (jpeg, jpg, png, gif, webp, svg) are allowed'));
  },
});

/**
 * POST /api/v1/upload - Upload an image file
 */
uploadRoutes.post('/', authenticate, (req: Request, res: Response, _next: NextFunction) => {
  upload.single('file')(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      logger.warn('Multer error during upload', { error: err.message });
      return res.status(400).json({ error: err.message });
    } else if (err) {
      logger.warn('Error during upload', { error: err.message });
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    logger.info('File uploaded successfully', { filename: req.file.filename, mimetype: req.file.mimetype });

    return res.status(200).json({
      message: 'File uploaded successfully',
      url: `/uploads/${req.file.filename}`,
    });
  });
});
