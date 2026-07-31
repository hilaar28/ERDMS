import express from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import {
  fetchCaseById,
  syncCaseDocuments,
  linkDocumentToCase,
  getCaseDocuments
} from '../models/cms.js';
import pool from '../db.js';

const router = express.Router();

router.get('/cases/:id', requireAuth, requirePermission('document:read'), async (req, res) => {
  try {
    const caseData = await fetchCaseById(req.params.id);
    res.json(caseData);
  } catch (error) {
    console.error('CMS case fetch error:', error);
    res.status(502).json({ error: 'Failed to retrieve case from CMS' });
  }
});

router.post('/cases/:id/sync', requireAuth, requirePermission('document:create'), async (req, res) => {
  try {
    const documents = await syncCaseDocuments(req.params.id);

    const inserted = await Promise.all(
      documents.map(doc =>
        pool.query(
          `INSERT INTO documents (name, original_filename, category, source, file_path, file_size, mime_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, name, original_filename, created_at`,
          [doc.name || `CMS Doc ${doc.id}`, doc.originalName || doc.filename, 'Legal CMS', `case-${req.params.id}`, doc.url || null, doc.size || null, doc.mimeType || null]
        )
      )
    );

    res.json({
      synced: inserted.length,
      documents: inserted.map(r => r.rows[0])
    });
  } catch (error) {
    console.error('CMS sync error:', error);
    res.status(502).json({ error: 'Failed to sync documents from CMS' });
  }
});

router.post('/cases/:id/documents', requireAuth, requirePermission('document:create'), async (req, res) => {
  try {
    const { documentId, metadata } = req.body;
    const link = await linkDocumentToCase(documentId, req.params.id, metadata);
    res.status(201).json({ 
      message: 'Document linked to case',
      linkId: link.id,
      caseId: req.params.id,
      documentId
    });
  } catch (error) {
    console.error('CMS link error:', error);
    res.status(500).json({ error: 'Failed to link document to case' });
  }
});

router.get('/cases/:id/documents', requireAuth, requirePermission('document:read'), async (req, res) => {
  try {
    const documents = await getCaseDocuments(req.params.id);
    res.json({ data: documents });
  } catch (error) {
    console.error('CMS case documents fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch case documents' });
  }
});

export default router;