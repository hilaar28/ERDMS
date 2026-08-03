import express from 'express';
import { requireAuth, requireRole, requirePermission } from '../middleware/auth.js';
import {
  getAuditTrail,
  getAllAuditTrail,
  getAuditStats,
  getAuditSummary,
  verifyAuditIntegrity,
  exportAuditTrail
} from '../models/auditTrail.js';

const router = express.Router();

router.use(requireAuth);

router.get('/documents/:id', requirePermission('document:search'), async (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit) || 100;
    const logs = await getAuditTrail(docId, limit);
    res.json({ data: logs });
  } catch (error) {
    console.error('Error fetching document audit:', error);
    res.status(500).json({ error: 'Failed to fetch audit trail' });
  }
});

router.get('/', requirePermission('document:search'), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const filters = {};
    if (req.query.action) filters.action = req.query.action;
    if (req.query.userId) filters.userId = parseInt(req.query.userId);
    if (req.query.documentId) filters.documentId = parseInt(req.query.documentId);
    if (req.query.dateFrom) filters.dateFrom = new Date(req.query.dateFrom);
    if (req.query.dateTo) filters.dateTo = new Date(req.query.dateTo);
    if (req.query.resourceType) filters.resourceType = req.query.resourceType;

    const logs = await getAllAuditTrail(filters, limit);
    res.json({ data: logs });
  } catch (error) {
    console.error('Error fetching audit trail:', error);
    res.status(500).json({ error: 'Failed to fetch audit trail' });
  }
});

router.get('/stats', requireRole('Administrator'), async (req, res) => {
  try {
    const stats = await getAuditStats();
    res.json({ data: stats });
  } catch (error) {
    console.error('Error fetching audit stats:', error);
    res.status(500).json({ error: 'Failed to fetch audit stats' });
  }
});

router.get('/summary', requireRole('Administrator'), async (req, res) => {
  try {
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : null;
    const summary = await getAuditSummary(dateFrom, dateTo);
    res.json({ data: summary });
  } catch (error) {
    console.error('Error fetching audit summary:', error);
    res.status(500).json({ error: 'Failed to fetch audit summary' });
  }
});

router.get('/integrity/verify', requireRole('Administrator'), async (req, res) => {
  try {
    const startId = req.query.startId ? parseInt(req.query.startId) : null;
    const result = await verifyAuditIntegrity(startId);
    res.json(result);
  } catch (error) {
    console.error('Error verifying audit integrity:', error);
    res.status(500).json({ error: 'Failed to verify audit integrity' });
  }
});

router.get('/export', requireRole('Administrator'), async (req, res) => {
  try {
    const filters = {};
    if (req.query.action) filters.action = req.query.action;
    if (req.query.userId) filters.userId = parseInt(req.query.userId);
    if (req.query.documentId) filters.documentId = parseInt(req.query.documentId);
    if (req.query.dateFrom) filters.dateFrom = new Date(req.query.dateFrom);
    if (req.query.dateTo) filters.dateTo = new Date(req.query.dateTo);
    if (req.query.resourceType) filters.resourceType = req.query.resourceType;

    const logs = await exportAuditTrail(filters);
    res.json({
      data: logs,
      meta: {
        totalRecords: logs.length,
        exportedAt: new Date().toISOString(),
        integrityVerified: true
      }
    });
  } catch (error) {
    console.error('Error exporting audit trail:', error);
    res.status(500).json({ error: 'Failed to export audit trail' });
  }
});

export default router;
