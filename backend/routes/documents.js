import express from 'express';
import multer from 'multer';
import path from 'path';
import pool from '../db.js';
import { validateFile } from '../utils/fileValidation.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${ext}`);
  }
});

const upload = multer({ storage });

// Document upload route with metadata
router.post('/upload', upload.single('document'), async (req, res) => {
  try {
    const file = req.file;
    const rawMetadata = req.body.documentMetadata;

    // Parse documentMetadata - it could be a stringified JSON or an object
    let metadata;
    try {
      metadata = typeof rawMetadata === 'string' ? JSON.parse(rawMetadata) : rawMetadata;
    } catch (e) {
      metadata = { name: 'Untitled' };
    }

    if (!file || !metadata?.name) {
      return res.status(400).json({ error: 'Missing file or document name' });
    }

    const validation = await validateFile(file);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.reason });
    }

    const result = await pool.query(
      'INSERT INTO documents (name, original_filename, stored_filename, file_path, file_size, mime_type, bucket_name, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP) RETURNING id',
      [
        metadata.name,
        file.originalname,
        file.filename,
        path.join('uploads/', file.filename),
        file.size,
        file.mimetype,
        process.env.MINIO_BUCKET || 'erkms-bucks'
      ]
    );

    res.status(201).json({
      success: true,
      documentId: result.rows[0].id,
      document: {
        id: result.rows[0].id,
        name: metadata.name,
        storedFilename: file.filename
      }
    });

  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Document upload failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get all documents route
router.get('/documents', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM documents ORDER BY created_at DESC');

    const documents = result.rows.map(doc => ({
      ...doc,
      bucketUrl: `http://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '9000'}/${process.env.MINIO_BUCKET || 'erkms-bucks'}/${doc.stored_filename || doc.name}`
    }));

    res.json({ data: documents });
  } catch (error) {
    console.error('Document retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve documents' });
  }
});

// Simple text-only document registration (for testing)
router.post('/', async (req, res) => {
  try {
    const { documentName } = req.body;

    if (!documentName || typeof documentName !== 'string' ||
        documentName.trim() === '' ||
        documentName.trim().length < 2) {
      return res.status(400).json({
        error: 'Document name is required and must be a non-empty string'
      });
    }

    const name = documentName.trim();
    const result = await pool.query(
      'INSERT INTO documents (name) VALUES ($1) RETURNING id, name, created_at',
      [name]
    );

    res.status(201).json({
      success: true,
      id: result.rows[0].id,
      name: result.rows[0].name,
      createdAt: result.rows[0].created_at
    });
  } catch (error) {
    console.error('Document creation error:', error);
    res.status(500).json({ error: 'Document creation failed' });
  }
});

export default router;
