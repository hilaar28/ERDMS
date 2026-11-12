import express from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);

router.get('/folders', async (req, res) => {
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

router.get('/folders/tree', async (req, res) => {
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

router.get('/folders/classification-tree', async (req, res) => {
  try {
    const classesResult = await pool.query(
      `SELECT c.id, c.name, c.description,
              (SELECT COUNT(*) FROM file_numbers WHERE class_id = c.id) as file_number_count,
              (SELECT COUNT(*) FROM documents d
               JOIN file_numbers fn ON d.file_number_id = fn.id
               WHERE fn.class_id = c.id AND d.is_deleted = FALSE) as document_count
       FROM classes c
       ORDER BY c.name ASC`
    );

    const classes = classesResult.rows.map(cls => ({
      ...cls,
      file_numbers: []
    }));

    if (classes.length > 0) {
      const fileNumbersResult = await pool.query(
        `SELECT fn.id, fn.file_number, fn.description, fn.class_id,
                (SELECT COUNT(*) FROM folio_numbers WHERE file_number_id = fn.id) as folio_count,
                (SELECT COUNT(*) FROM documents d
                 JOIN folio_numbers fol ON d.folio_number_id = fol.id
                 JOIN file_numbers fn2 ON fol.file_number_id = fn2.id
                 WHERE fn2.id = fn.id AND d.is_deleted = FALSE) as document_count
         FROM file_numbers fn
         ORDER BY fn.file_number ASC`
      );

      const classMap = new Map(classes.map(c => [c.id, c]));
      fileNumbersResult.rows.forEach(fn => {
        const parent = classMap.get(fn.class_id);
        if (parent) {
          parent.file_numbers.push(fn);
        }
      });
    }

    res.json({ data: classes });
  } catch (error) {
    console.error('Classification tree error:', error);
    res.status(500).json({ error: 'Failed to fetch classification tree' });
  }
});

router.post('/folders/sync-from-classification', async (req, res) => {
  try {
    const classesResult = await pool.query('SELECT id, name FROM classes ORDER BY name');
    const createdFolders = [];

    for (const cls of classesResult.rows) {
      const existingFolder = await pool.query('SELECT id FROM folders WHERE name = $1 AND parent_id IS NULL', [cls.name]);
      let folderId;

      if (existingFolder.rowCount === 0) {
        const result = await pool.query(
          'INSERT INTO folders (name, parent_id, path, created_by, created_at, updated_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id',
          [cls.name, null, cls.name, req.user?.id || null]
        );
        folderId = result.rows[0].id;
        createdFolders.push({ type: 'class', id: folderId, name: cls.name });
      } else {
        folderId = existingFolder.rows[0].id;
      }

      const fileNumbersResult = await pool.query(
        'SELECT id, file_number FROM file_numbers WHERE class_id = $1 ORDER BY file_number',
        [cls.id]
      );

      for (const fn of fileNumbersResult.rows) {
        const existingFnFolder = await pool.query(
          'SELECT id FROM folders WHERE name = $1 AND parent_id = $2',
          [fn.file_number, folderId]
        );

        if (existingFnFolder.rowCount === 0) {
          const fnPath = `${cls.name}/${fn.file_number}`;
          const result = await pool.query(
            'INSERT INTO folders (name, parent_id, path, created_by, created_at, updated_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id',
            [fn.file_number, folderId, fnPath, req.user?.id || null]
          );
          createdFolders.push({ type: 'file_number', id: result.rows[0].id, name: fn.file_number, class: cls.name });
        }
      }
    }

    res.json({ message: 'Folders synced with classification', data: createdFolders });
  } catch (error) {
    console.error('Folder sync error:', error);
    res.status(500).json({ error: 'Failed to sync folders' });
  }
});

router.post('/folders', async (req, res) => {
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

router.put('/folders/:id', async (req, res) => {
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

router.delete('/folders/:id', async (req, res) => {
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
