import express from 'express';
import multer from 'multer';
import path from 'path';
import pool from '../db.js';
import { validateFile } from '../utils/fileValidation.js';
import { createVersion, createAuditLog } from '../models/versions.js';
import { createImmutableAuditEntry } from '../models/auditTrail.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { requireDocumentAccess, requireDocumentWriteAccess, requireDocumentOwnership } from '../middleware/authorization.js';

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

    let metadata;
    try {
      metadata = typeof rawMetadata === 'string' ? JSON.parse(rawMetadata) : (rawMetadata || { name: 'Untitled' });
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
      'INSERT INTO documents (name, original_filename, stored_filename, file_path, file_size, mime_type, bucket_name, department, province, created_by, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id',
      [
        metadata.name,
        file.originalname,
        file.filename,
        path.join('uploads/', file.filename),
        file.size,
        file.mimetype,
        process.env.MINIO_BUCKET || 'erkms-bucks',
        metadata.department || '',
        metadata.province || '',
        req.user?.id || null
      ]
    );

    const documentId = result.rows[0].id;

    await createVersion(documentId, {
      name: metadata.name,
      original_filename: file.originalname,
      stored_filename: file.filename,
      file_path: path.join('uploads/', file.filename),
      file_size: file.size,
      mime_type: file.mimetype,
      department: metadata.department || '',
      province: metadata.province || '',
      bucket_name: process.env.MINIO_BUCKET || 'erkms-bucks',
      created_by: req.user?.id || null
    });

    await createAuditLog({
      document_id: documentId,
      user_id: req.user?.id || null,
      action: 'document_upload',
      resource_type: 'document',
      resource_id: documentId,
      old_values: null,
      new_values: {
        name: metadata.name,
        original_filename: file.originalname,
        file_size: file.size,
        mime_type: file.mimetype,
        department: metadata.department || '',
        province: metadata.province || ''
      },
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    await createImmutableAuditEntry({
      document_id: documentId,
      user_id: req.user?.id || null,
      action: 'document_upload',
      resource_type: 'document',
      resource_id: documentId,
      old_values: null,
      new_values: {
        name: metadata.name,
        original_filename: file.originalname,
        file_size: file.size,
        mime_type: file.mimetype,
        department: metadata.department || '',
        province: metadata.province || ''
      },
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    res.status(201).json({
      success: true,
      documentId: documentId,
      document: {
        id: documentId,
        name: metadata.name,
        storedFilename: file.filename,
        department: metadata.department || '',
        province: metadata.province || ''
      },
      version: 1
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

// Get document with version history and metadata
router.get('/documents/:id', requireAuth, requireDocumentAccess, async (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    const result = await pool.query(
      'SELECT * FROM documents WHERE id = $1',
      [docId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Document retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve document' });
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
router.post('/', requireAuth, requirePermission('document:register'), async (req, res) => {
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
