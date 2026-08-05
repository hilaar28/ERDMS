import pool from '../db.js';
import { getUserPermissionsAndRoles } from '../models/rbac.js';

export async function requireDocumentAccess(req, res, next) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const documentId = parseInt(req.params.id || req.params.documentId);
    if (!documentId) {
      return res.status(400).json({ error: 'Document ID is required' });
    }

    const docResult = await pool.query(
      'SELECT id, created_by, department, province FROM documents WHERE id = $1',
      [documentId]
    );

    if (docResult.rowCount === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = docResult.rows[0];
    const { roles, permissions } = await getUserPermissionsAndRoles(user.id);

    const hasPermission = permissions.some(p => p.name === 'document:admin');
    const isOwner = document.created_by === user.id;
    const isAdmin = roles.some(r => r.name === 'Administrator');

    if (hasPermission || isAdmin) {
      req.document = document;
      return next();
    }

    if (isOwner && permissions.some(p => p.name === 'document:read' || p.name === 'document:update')) {
      req.document = document;
      return next();
    }

    return res.status(403).json({ error: 'Insufficient permissions for this document' });
  } catch (err) {
    console.error('Document access check error:', err);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
}

export async function requireDocumentWriteAccess(req, res, next) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const documentId = parseInt(req.params.id || req.params.documentId);
    if (!documentId) {
      return res.status(400).json({ error: 'Document ID is required' });
    }

    const docResult = await pool.query(
      'SELECT id, created_by, department, province FROM documents WHERE id = $1',
      [documentId]
    );

    if (docResult.rowCount === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = docResult.rows[0];
    const { roles, permissions } = await getUserPermissionsAndRoles(user.id);

    const hasAdminPermission = permissions.some(p => p.name === 'document:admin');
    const isAdmin = roles.some(r => r.name === 'Administrator');
    const isOwner = document.created_by === user.id;
    const hasWritePermission = permissions.some(p =>
      p.name === 'document:update' || p.name === 'document:delete' || p.name === 'document:create'
    );

    if (hasAdminPermission || isAdmin) {
      req.document = document;
      return next();
    }

    if (isOwner && hasWritePermission) {
      req.document = document;
      return next();
    }

    return res.status(403).json({ error: 'Write access denied for this document' });
  } catch (err) {
    console.error('Document write access check error:', err);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
}

export async function requireTaskAccess(req, res, next) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const taskId = parseInt(req.params.id);
    if (!taskId) {
      return res.status(400).json({ error: 'Task ID is required' });
    }

    const taskResult = await pool.query(
      `SELECT t.*, ta.user_id as assigned_user_id
       FROM tasks t
       LEFT JOIN task_assignments ta ON t.id = ta.task_id AND ta.user_id = $2
       WHERE t.id = $1`,
      [taskId, user.id]
    );

    if (taskResult.rowCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskResult.rows[0];
    const { roles, permissions } = await getUserPermissionsAndRoles(user.id);

    const isAdmin = roles.some(r => r.name === 'Administrator');
    const isAssignee = task.assigned_to === user.id;
    const isAssigned = task.assigned_user_id === user.id;
    const isCreator = task.assigned_by === user.id;
    const hasTaskPermission = permissions.some(p => p.name === 'task:manage');

    if (isAdmin || hasTaskPermission) {
      req.task = task;
      return next();
    }

    if (isAssignee || isAssigned || isCreator) {
      req.task = task;
      return next();
    }

    return res.status(403).json({ error: 'Insufficient permissions for this task' });
  } catch (err) {
    console.error('Task access check error:', err);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
}

export async function requireDocumentOwnership(req, res, next) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const documentId = parseInt(req.params.id || req.params.documentId);
    if (!documentId) {
      return res.status(400).json({ error: 'Document ID is required' });
    }

    const docResult = await pool.query(
      'SELECT id, created_by FROM documents WHERE id = $1',
      [documentId]
    );

    if (docResult.rowCount === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = docResult.rows[0];
    const { roles } = await getUserPermissionsAndRoles(user.id);

    const isAdmin = roles.some(r => r.name === 'Administrator');
    const isOwner = document.created_by === user.id;

    if (isAdmin || isOwner) {
      req.document = document;
      return next();
    }

    return res.status(403).json({ error: 'Only document owner or admin can perform this action' });
  } catch (err) {
    console.error('Document ownership check error:', err);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
}

export async function requireTaskAssignment(req, res, next) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const taskId = parseInt(req.params.id);
    if (!taskId) {
      return res.status(400).json({ error: 'Task ID is required' });
    }

    const assignmentResult = await pool.query(
      'SELECT * FROM task_assignments WHERE task_id = $1 AND user_id = $2',
      [taskId, user.id]
    );

    if (assignmentResult.rowCount > 0) {
      req.taskAssignment = assignmentResult.rows[0];
      return next();
    }

    const taskResult = await pool.query(
      'SELECT assigned_by FROM tasks WHERE id = $1',
      [taskId]
    );

    if (taskResult.rowCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskResult.rows[0];
    if (task.assigned_by === user.id) {
      req.taskAssignment = { user_id: user.id, role_in_task: 'creator' };
      return next();
    }

    return res.status(403).json({ error: 'Not assigned to this task' });
  } catch (err) {
    console.error('Task assignment check error:', err);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
}
