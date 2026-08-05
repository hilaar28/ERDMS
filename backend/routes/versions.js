import express from 'express';
import pool from '../db.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { requireDocumentAccess, requireDocumentWriteAccess } from '../middleware/authorization.js';
import {
  getVersions,
  getVersion,
  restoreVersion,
  getAuditLog,
  getAllAuditLogs,
  setWorkflowStatus,
  getWorkflowStatus,
  addComment,
  getComments,
  getDocumentWithVersions,
  createAuditLog
} from '../models/versions.js';

const router = express.Router();

router.get('/documents/:id/versions', requireAuth, requireDocumentAccess, async (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    const docCheck = await pool.query('SELECT id FROM documents WHERE id = $1', [docId]);
    if (docCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    const versions = await getVersions(docId);
    res.json({ data: versions });
  } catch (error) {
    console.error('Error fetching versions:', error);
    res.status(500).json({ error: 'Failed to fetch versions' });
  }
});

router.get('/documents/:id/versions/:versionNumber', requireAuth, async (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    const versionNum = parseInt(req.params.versionNumber);
    const version = await getVersion(docId, versionNum);
    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }
    res.json({ data: version });
  } catch (error) {
    console.error('Error fetching version:', error);
    res.status(500).json({ error: 'Failed to fetch version' });
  }
});

router.post('/documents/:id/versions/:versionNumber/restore', requireAuth, requireDocumentWriteAccess, async (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    const versionNum = parseInt(req.params.versionNumber);
    const userId = req.user.id;

    const docCheck = await pool.query('SELECT id FROM documents WHERE id = $1', [docId]);
    if (docCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const restored = await restoreVersion(docId, versionNum, userId);
    res.json({
      message: `Document restored to version ${versionNum}`,
      data: restored
    });
  } catch (error) {
    console.error('Error restoring version:', error);
    res.status(500).json({ error: error.message || 'Failed to restore version' });
  }
});

router.get('/documents/:id/audit-log', requireAuth, requireDocumentAccess, async (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit) || 50;
    const docCheck = await pool.query('SELECT id FROM documents WHERE id = $1', [docId]);
    if (docCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    const logs = await getAuditLog(docId, limit);
    res.json({ data: logs });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

router.get('/audit-log', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const filters = {};
    if (req.query.action) filters.action = req.query.action;
    if (req.query.userId) filters.userId = parseInt(req.query.userId);
    if (req.query.documentId) filters.documentId = parseInt(req.query.documentId);

    const logs = await getAllAuditLogs(filters, limit);
    res.json({ data: logs });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

router.get('/documents/:id/workflow', requireAuth, async (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    const status = await getWorkflowStatus(docId);
    if (!status) {
      return res.json({ data: { status: 'draft', reviewer_id: null, reviewed_at: null, review_notes: null } });
    }
    res.json({ data: status });
  } catch (error) {
    console.error('Error fetching workflow status:', error);
    res.status(500).json({ error: 'Failed to fetch workflow status' });
  }
});

router.put('/documents/:id/workflow', requireAuth, requireDocumentWriteAccess, async (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    const { status, notes } = req.body;
    const userId = req.user.id;

    const docCheck = await pool.query('SELECT id FROM documents WHERE id = $1', [docId]);
    if (docCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const validStatuses = ['draft', 'in_review', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await setWorkflowStatus(docId, status, userId, notes);
    res.json({
      message: `Workflow status updated to ${status}`,
      data: result
    });
  } catch (error) {
    console.error('Error updating workflow:', error);
    res.status(500).json({ error: 'Failed to update workflow' });
  }
});

router.get('/documents/:id/comments', requireAuth, requireDocumentAccess, async (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    const comments = await getComments(docId);
    res.json({ data: comments });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

router.post('/documents/:id/comments', requireAuth, requireDocumentAccess, async (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    const userId = req.user.id;
    const { comment, parentCommentId } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Comment is required' });
    }

    const docCheck = await pool.query('SELECT id FROM documents WHERE id = $1', [docId]);
    if (docCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const result = await addComment(docId, userId, comment.trim(), parentCommentId || null);
    res.status(201).json({ message: 'Comment added', data: result });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

router.get('/documents/:id/metadata', requireAuth, async (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    const data = await getDocumentWithVersions(docId);
    if (!data.document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json({ data });
  } catch (error) {
    console.error('Error fetching document metadata:', error);
    res.status(500).json({ error: 'Failed to fetch document metadata' });
  }
});

export default router;
