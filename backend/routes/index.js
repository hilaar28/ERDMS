import express from 'express';
import { initializeIndexTables, indexDocument, searchDocuments, addTag, getTags, searchByTag } from '../models/indexing.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { isUserAdmin } from '../middleware/authorization.js';

const router = express.Router();

router.post('/initialize', requireAuth, requirePermission('document:register'), async (req, res) => {
  try {
    await initializeIndexTables();
    res.json({ status: 'Index tables initialized' });
  } catch (error) {
    console.error('Index initialization error:', error);
    res.status(500).json({ error: 'Failed to initialize index tables' });
  }
});

router.post('/index/:documentId', requireAuth, requirePermission('document:register'), async (req, res) => {
  const { documentId } = req.params;
  try {
    await indexDocument(parseInt(documentId));
    res.json({ status: 'Document indexed', documentId });
  } catch (error) {
    res.status(500).json({ error: 'Indexing failed' });
  }
});

router.get('/search', requireAuth, requirePermission('document:search'), async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'Search query parameter "q" is required' });
  }
  try {
    const isAdmin = await isUserAdmin(req.user.id);
    const userId = isAdmin ? null : req.user.id;
    const results = await searchDocuments(q, userId);
    res.json({ data: results, count: results.length });
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

router.post('/tags/:documentId', requireAuth, requirePermission('document:update'), async (req, res) => {
  const { documentId } = req.params;
  const { tag } = req.body;
  if (!tag) {
    return res.status(400).json({ error: 'Tag is required' });
  }
  try {
    await addTag(parseInt(documentId), tag);
    res.json({ status: 'Tag added', documentId, tag });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add tag' });
  }
});

router.get('/tags/:documentId', requireAuth, requirePermission('document:search'), async (req, res) => {
  const { documentId } = req.params;
  try {
    const tags = await getTags(parseInt(documentId));
    res.json({ data: tags });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get tags' });
  }
});

router.get('/search/tags', requireAuth, requirePermission('document:search'), async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'Search query parameter "q" is required' });
  }
  try {
    const isAdmin = await isUserAdmin(req.user.id);
    const userId = isAdmin ? null : req.user.id;
    const results = await searchByTag(q, userId);
    res.json({ data: results, count: results.length });
  } catch (error) {
    res.status(500).json({ error: 'Tag search failed' });
  }
});

export default router;