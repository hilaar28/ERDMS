import express from 'express';
import { requireAuth, requireRole, requirePermission } from '../middleware/auth.js';
import {
  createRetentionPolicy,
  getPolicies,
  getPolicyById,
  updatePolicy,
  deletePolicy,
  applyPolicyToDocument,
  getDueForDisposal,
  logDisposal,
  executeDisposal,
  getAllDisposalLogs,
  getDocumentRetentionStatus,
  getRetentionSchedule
} from '../models/retention.js';

const router = express.Router();

router.use(requireAuth);

router.post('/policies', requireRole('Administrator'), async (req, res) => {
  try {
    const { name, description, documentType, department, retentionPeriod, requiresApproval } = req.body;

    if (!name || !retentionPeriod) {
      return res.status(400).json({ error: 'Name and retention period are required' });
    }

    const policy = await createRetentionPolicy({
      name,
      description,
      documentType,
      department,
      retentionPeriod,
      requiresApproval: requiresApproval || false,
      userId: req.user.id
    });

    res.status(201).json({ message: 'Retention policy created', data: policy });
  } catch (error) {
    console.error('Error creating retention policy:', error);
    res.status(500).json({ error: 'Failed to create retention policy' });
  }
});

router.get('/policies', async (req, res) => {
  try {
    const filters = {};
    if (req.query.isActive !== undefined) filters.isActive = req.query.isActive === 'true';
    if (req.query.department) filters.department = req.query.department;
    if (req.query.documentType) filters.documentType = req.query.documentType;

    const policies = await getPolicies(filters);
    res.json({ data: policies });
  } catch (error) {
    console.error('Error fetching policies:', error);
    res.status(500).json({ error: 'Failed to fetch policies' });
  }
});

router.get('/policies/:id', requireAuth, async (req, res) => {
  try {
    const policy = await getPolicyById(parseInt(req.params.id));
    if (!policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    res.json({ data: policy });
  } catch (error) {
    console.error('Error fetching policy:', error);
    res.status(500).json({ error: 'Failed to fetch policy' });
  }
});

router.put('/policies/:id', requireRole('Administrator'), async (req, res) => {
  try {
    const policy = await updatePolicy(parseInt(req.params.id), req.body);
    if (!policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    res.json({ message: 'Policy updated', data: policy });
  } catch (error) {
    console.error('Error updating policy:', error);
    res.status(500).json({ error: 'Failed to update policy' });
  }
});

router.delete('/policies/:id', requireRole('Administrator'), async (req, res) => {
  try {
    const success = await deletePolicy(parseInt(req.params.id));
    if (!success) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    res.json({ message: 'Policy deleted' });
  } catch (error) {
    console.error('Error deleting policy:', error);
    res.status(500).json({ error: 'Failed to delete policy' });
  }
});

router.post('/documents/:documentId/policies/:policyId/apply', requireRole('Administrator'), requirePermission('document:create'), async (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId);
    const policyId = parseInt(req.params.policyId);
    const result = await applyPolicyToDocument(documentId, policyId, req.user.id);
    res.json({ message: 'Policy applied to document', data: result });
  } catch (error) {
    console.error('Error applying policy:', error);
    res.status(500).json({ error: error.message || 'Failed to apply policy' });
  }
});

router.get('/disposal/due', requireRole('Records Officer'), async (req, res) => {
  try {
    const dateFilter = req.query.date ? new Date(req.query.date) : null;
    const documents = await getDueForDisposal(dateFilter);
    res.json({ data: documents });
  } catch (error) {
    console.error('Error fetching due documents:', error);
    res.status(500).json({ error: 'Failed to fetch due documents' });
  }
});

router.get('/disposal/logs', requireRole('Administrator'), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const filters = {};
    if (req.query.userId) filters.userId = parseInt(req.query.userId);
    if (req.query.dateFrom) filters.dateFrom = req.query.dateFrom;
    if (req.query.dateTo) filters.dateTo = req.query.dateTo;

    const logs = await getAllDisposalLogs(filters, limit);
    res.json({ data: logs });
  } catch (error) {
    console.error('Error fetching disposal logs:', error);
    res.status(500).json({ error: 'Failed to fetch disposal logs' });
  }
});

router.post('/disposal/:documentId/execute', requireRole('Administrator'), async (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId);
    const { reason } = req.body;
    const result = await pool.query(
      `SELECT dl.id as log_id FROM disposal_logs dl WHERE dl.document_id = $1 ORDER BY dl.created_at DESC LIMIT 1`,
      [documentId]
    );

    if (result.rowCount > 0) {
      const disposalLogId = result.rows[0].log_id;
      await executeDisposal(documentId, disposalLogId, reason);
      res.json({ message: 'Document disposed successfully' });
    } else {
      const disposalLog = await logDisposal({
        documentId,
        policyId: null,
        dispositionAction: 'dispose',
        disposalMethod: 'manual',
        approvedBy: req.user.id,
        approvedAt: new Date(),
        notes: reason
      });
      await executeDisposal(documentId, disposalLog.id, reason);
      res.json({ message: 'Document disposed successfully' });
    }
  } catch (error) {
    console.error('Error during disposal:', error);
    res.status(500).json({ error: 'Failed to dispose document' });
  }
});

router.post('/disposal/approve', requireRole('Administrator'), async (req, res) => {
  try {
    const { documentId, policyId, reason } = req.body;

    await logDisposal({
      documentId: parseInt(documentId),
      policyId: parseInt(policyId),
      dispositionAction: 'disposition_approved',
      disposalMethod: 'retention_policy',
      approvedBy: req.user.id,
      approvedAt: new Date(),
      notes: reason
    });

    res.json({ message: 'Disposal approved and logged' });
  } catch (error) {
    console.error('Error approving disposal:', error);
    res.status(500).json({ error: 'Failed to approve disposal' });
  }
});

router.get('/schedule', requireRole('Records Officer'), async (req, res) => {
  try {
    const schedule = await getRetentionSchedule();
    res.json({ data: schedule });
  } catch (error) {
    console.error('Error fetching retention schedule:', error);
    res.status(500).json({ error: 'Failed to fetch retention schedule' });
  }
});

router.get('/documents/:documentId/retention', requireAuth, async (req, res) => {
  try {
    const status = await getDocumentRetentionStatus(parseInt(req.params.documentId));
    if (!status) {
      return res.json({ data: { status: 'no_policy' } });
    }
    res.json({ data: status });
  } catch (error) {
    console.error('Error fetching retention status:', error);
    res.status(500).json({ error: 'Failed to fetch retention status' });
  }
});

export default router;
