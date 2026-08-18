import express from 'express';
import pool from '../db.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { getClasses, createClass, getFileNumbersByClass, createFileNumber, getFolioNumbersByFileNumber, createFolioNumber } from '../models/classification.js';

const router = express.Router();

router.get('/classes', requireAuth, async (req, res) => {
  try {
    const classes = await getClasses();
    res.json(classes);
  } catch (err) {
    console.error('Get classes error:', err);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

router.post('/classes', requireAuth, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Class name is required' });
    }
    const cls = await createClass(name, description);
    res.status(201).json(cls);
  } catch (err) {
    console.error('Create class error:', err);
    res.status(500).json({ error: 'Failed to create class' });
  }
});

router.get('/classes/:classId/file-numbers', requireAuth, async (req, res) => {
  try {
    const classId = parseInt(req.params.classId);
    const fileNumbers = await getFileNumbersByClass(classId);
    res.json(fileNumbers);
  } catch (err) {
    console.error('Get file numbers error:', err);
    res.status(500).json({ error: 'Failed to fetch file numbers' });
  }
});

router.post('/classes/:classId/file-numbers', requireAuth, async (req, res) => {
  try {
    const classId = parseInt(req.params.classId);
    const { fileNumber, description } = req.body;
    if (!fileNumber) {
      return res.status(400).json({ error: 'File number is required' });
    }
    const fn = await createFileNumber(classId, fileNumber, description);
    res.status(201).json(fn);
  } catch (err) {
    console.error('Create file number error:', err);
    res.status(500).json({ error: 'Failed to create file number' });
  }
});

router.get('/file-numbers/:fileNumberId/folio-numbers', requireAuth, async (req, res) => {
  try {
    const fileNumberId = parseInt(req.params.fileNumberId);
    const folioNumbers = await getFolioNumbersByFileNumber(fileNumberId);
    res.json(folioNumbers);
  } catch (err) {
    console.error('Get folio numbers error:', err);
    res.status(500).json({ error: 'Failed to fetch folio numbers' });
  }
});

router.post('/file-numbers/:fileNumberId/folio-numbers', requireAuth, async (req, res) => {
  try {
    const fileNumberId = parseInt(req.params.fileNumberId);
    const { folioNumber, description } = req.body;
    if (!folioNumber) {
      return res.status(400).json({ error: 'Folio number is required' });
    }
    const folio = await createFolioNumber(fileNumberId, folioNumber, description);
    res.status(201).json(folio);
  } catch (err) {
    console.error('Create folio number error:', err);
    res.status(500).json({ error: 'Failed to create folio number' });
  }
});

export default router;
