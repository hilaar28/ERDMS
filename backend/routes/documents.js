import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pool from '../db.js';
import { validateFile } from '../utils/fileValidation.js';
import { createVersion, createAuditLog } from '../models/versions.js';
import { createImmutableAuditEntry } from '../models/auditTrail.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { requireDocumentAccess, requireDocumentWriteAccess, requireDocumentOwnership, isUserAdmin, buildDocumentScope } from '../middleware/authorization.js';
import { getFolioNumbersByFileNumber, createFolioNumber } from '../models/classification.js';

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
router.post('/upload', requireAuth, upload.single('document'), async (req, res) => {
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

    let folioNumberId = metadata.folioNumberId || null;

    if (metadata.folioNumber && !folioNumberId && metadata.fileNumberId) {
      const existingFolios = await getFolioNumbersByFileNumber(metadata.fileNumberId);
      const existing = existingFolios.find(f => f.folio_number === metadata.folioNumber);
      if (existing) {
        folioNumberId = existing.id;
      } else {
        const newFolio = await createFolioNumber(
          metadata.fileNumberId,
          metadata.folioNumber,
          metadata.folioNumber
        );
        folioNumberId = newFolio.id;
      }
    }

    const result = await pool.query(
      'INSERT INTO documents (name, original_filename, stored_filename, file_path, file_size, mime_type, bucket_name, department, province, class, file_number, folio_number, class_id, file_number_id, folio_number_id, folder_id, created_by, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id',
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
        metadata.class || '',
        metadata.fileNumber || '',
        metadata.folioNumber || '',
        metadata.classId || null,
        metadata.fileNumberId || null,
        folioNumberId,
        metadata.folderId || null,
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
        province: metadata.province || '',
        class: metadata.class || '',
        fileNumber: metadata.fileNumber || '',
        folioNumber: metadata.folioNumber || ''
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

// Get all documents route — scoped to current user's department/ownership
router.get('/documents', requireAuth, requirePermission('document:search'), async (req, res) => {
  try {
    const { clause: scopeClause, params: scopeParams } = await buildDocumentScope(req);

    let query = `
      SELECT d.*,
             u.username as created_by_username,
             u.full_name as created_by_full_name
      FROM documents d
      LEFT JOIN users u ON d.created_by = u.id
      WHERE 1=1 ${scopeClause}
    `;

    if (req.query.department) {
      const paramIndex = scopeParams.length + 1;
      query += ` AND d.department = $${paramIndex}`;
      scopeParams.push(req.query.department);
    }

    if (req.query.category) {
      const paramIndex = scopeParams.length + 1;
      query += ` AND d.category = $${paramIndex}`;
      scopeParams.push(req.query.category);
    }

    if (req.query.folderId) {
      const paramIndex = scopeParams.length + 1;
      query += ` AND d.folder_id = $${paramIndex}`;
      scopeParams.push(parseInt(req.query.folderId));
    }

    if (req.query.fileNumberId) {
      const paramIndex = scopeParams.length + 1;
      query += ` AND d.file_number_id = $${paramIndex}`;
      scopeParams.push(parseInt(req.query.fileNumberId));
    }

    query += ' ORDER BY d.created_at DESC LIMIT 100';

    const result = await pool.query(query, scopeParams);

    const documents = result.rows.map(doc => ({
      ...doc,
      bucketUrl: `http://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '9000'}/${process.env.MINIO_BUCKET || 'erkms-bucks'}/${doc.stored_filename || doc.name}`
    }));

    res.json({ data: documents, count: documents.length });
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

// Download a document file (forces download)
router.get('/documents/:id/download', requireAuth, requireDocumentAccess, async (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    const result = await pool.query(
      'SELECT original_filename, file_path, stored_filename, mime_type, file_size, bucket_name FROM documents WHERE id = $1',
      [docId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = result.rows[0];
    let filePath = doc.file_path;

    // Fall back to uploads/ if file_path not set
    if (!filePath && doc.stored_filename) {
      filePath = path.join(process.cwd(), 'uploads', doc.stored_filename);
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on storage' });
    }

    const filename = doc.original_filename || doc.stored_filename || `document_${docId}`;
    const mimeType = doc.mime_type || 'application/octet-stream';

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', mimeType);
    if (doc.file_size) {
      res.setHeader('Content-Length', doc.file_size);
    }

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);

    await createImmutableAuditEntry({
      document_id: docId,
      user_id: req.user?.id || null,
      action: 'document_download',
      resource_type: 'document',
      resource_id: docId,
      old_values: null,
      new_values: {
        filename: doc.original_filename,
        mime_type: doc.mime_type
      },
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });
  } catch (error) {
    console.error('Document download error:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

// View a document inline (displays in browser)
router.get('/documents/:id/view', requireAuth, requireDocumentAccess, async (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    const result = await pool.query(
      'SELECT original_filename, file_path, stored_filename, mime_type, file_size, bucket_name FROM documents WHERE id = $1',
      [docId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = result.rows[0];
    let filePath = doc.file_path;

    if (!filePath && doc.stored_filename) {
      filePath = path.join(process.cwd(), 'uploads', doc.stored_filename);
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on storage' });
    }

    const mimeType = doc.mime_type || 'application/octet-stream';

    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Content-Type', mimeType);
    if (doc.file_size) {
      res.setHeader('Content-Length', doc.file_size);
    }

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);

    await createImmutableAuditEntry({
      document_id: docId,
      user_id: req.user?.id || null,
      action: 'document_view',
      resource_type: 'document',
      resource_id: docId,
      old_values: null,
      new_values: {
        filename: doc.original_filename,
        mime_type: doc.mime_type
      },
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });
  } catch (error) {
    console.error('Document view error:', error);
    res.status(500).json({ error: 'Failed to view document' });
  }
});

// Folder CRUD
router.get('/folders', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.*, u.username as created_by_username,
              (SELECT COUNT(*) FROM documents WHERE folder_id = f.id AND is_deleted = FALSE) as document_count
       FROM folders f
       LEFT JOIN users u ON f.created_by = u.id
       ORDER BY f.name ASC`
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Folder list error:', error);
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

router.get('/folders/tree', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.*, u.username as created_by_username,
              (SELECT COUNT(*) FROM documents WHERE folder_id = f.id AND is_deleted = FALSE) as document_count
       FROM folders f
       LEFT JOIN users u ON f.created_by = u.id
       ORDER BY f.parent_id ASC NULLS FIRST, f.name ASC`
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Folder tree error:', error);
    res.status(500).json({ error: 'Failed to fetch folder tree' });
  }
});

router.post('/folders', requireAuth, async (req, res) => {
  try {
    const { name, parentId } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const parentResult = parentId ? await pool.query('SELECT id, path FROM folders WHERE id = $1', [parentId]) : { rows: [] };
    const parentPath = parentResult.rows[0]?.path || '';
    const newPath = parentPath ? `${parentPath}/${name.trim()}` : name.trim();

    const result = await pool.query(
      'INSERT INTO folders (name, parent_id, path, created_by, created_at, updated_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *',
      [name.trim(), parentId || null, newPath, req.user?.id || null]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    console.error('Folder creation error:', error);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

router.put('/folders/:id', requireAuth, async (req, res) => {
  try {
    const folderId = parseInt(req.params.id);
    const { name, parentId } = req.body;

    const existing = await pool.query('SELECT * FROM folders WHERE id = $1', [folderId]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const parentResult = parentId ? await pool.query('SELECT id, path FROM folders WHERE id = $1', [parentId]) : { rows: [] };
    const parentPath = parentResult.rows[0]?.path || '';
    const newName = name?.trim() || existing.rows[0].name;
    const newPath = parentPath ? `${parentPath}/${newName}` : newName;

    const result = await pool.query(
      'UPDATE folders SET name = $1, parent_id = $2, path = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
      [newName, parentId || null, newPath, folderId]
    );

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Folder update error:', error);
    res.status(500).json({ error: 'Failed to update folder' });
  }
});

router.delete('/folders/:id', requireAuth, async (req, res) => {
  try {
    const folderId = parseInt(req.params.id);
    const result = await pool.query('DELETE FROM folders WHERE id = $1 RETURNING id', [folderId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    res.json({ message: 'Folder deleted' });
  } catch (error) {
    console.error('Folder deletion error:', error);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

export default router;
