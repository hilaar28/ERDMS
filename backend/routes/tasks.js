import express from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  updateTaskStatus,
  getTaskAssignments,
  addTaskAssignment,
  deleteTask,
  completeTask,
  updateTaskComment
} from '../models/tasks.js';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadNotificationCount,
  createNotification
} from '../models/tasks.js';
import { createAuditLog } from '../models/versions.js';
import { requireTaskAccess, requireTaskAssignment, isUserAdmin } from '../middleware/authorization.js';

const router = express.Router();

router.use(requireAuth);

router.post('/tasks', requirePermission('document:create'), async (req, res) => {
  try {
    const { title, description, documentId, assignedTo, priority, dueDate } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    const task = await createTask({
      title: title.trim(),
      description,
      documentId: documentId || null,
      assignedTo: assignedTo || null,
      assignedBy: req.user.id,
      priority: priority || 'normal',
      dueDate: dueDate || null
    });

    if (documentId) {
      await createAuditLog({
        document_id: parseInt(documentId),
        user_id: req.user.id,
        action: 'task_created',
        resource_type: 'task',
        resource_id: task.id,
        old_values: null,
        new_values: { title, description, assigned_to: assignedTo, priority, due_date: dueDate },
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
    }

    res.status(201).json({ message: 'Task created', data: task });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.get('/tasks', requirePermission('document:search'), async (req, res) => {
  try {
    const filters = {};
    if (req.query.assignedTo) filters.assignedTo = parseInt(req.query.assignedTo);
    if (req.query.assignedBy) filters.assignedBy = parseInt(req.query.assignedBy);
    if (req.query.status) filters.status = req.query.status;
    if (req.query.documentId) filters.documentId = parseInt(req.query.documentId);
    if (req.query.priority) filters.priority = req.query.priority;
    if (req.query.overdue) filters.overdue = req.query.overdue;

    const isAdmin = await isUserAdmin(req.user.id);
    if (!isAdmin) {
      filters.assignedTo = req.user.id;
    }

    const tasks = await getTasks(filters);
    res.json({ data: tasks, count: tasks.length });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.get('/tasks/:id', requireAuth, requireTaskAccess, async (req, res) => {
  try {
    const task = await getTaskById(parseInt(req.params.id));
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const assignments = await getTaskAssignments(task.id);
    res.json({ data: { ...task, assignments } });
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

router.put('/tasks/:id', requireAuth, requireTaskAccess, async (req, res) => {
  try {
    const task = await updateTask(parseInt(req.params.id), req.body);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task updated', data: task });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

router.delete('/tasks/:id', requireAuth, requireTaskAccess, async (req, res) => {
  return res.status(403).json({ error: 'Task deletion is not allowed' });
});

router.post('/tasks/:id/status', requireAuth, requireTaskAssignment, async (req, res) => {
  try {
    const { status } = req.body;
    const task = await updateTaskStatus(parseInt(req.params.id), status, req.user.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task status updated', data: task });
  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({ error: 'Failed to update task status' });
  }
});

router.post('/tasks/:id/assign', requireAuth, requireTaskAccess, async (req, res) => {
  try {
    const { userId, roleInTask } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const assignment = await addTaskAssignment(parseInt(req.params.id), parseInt(userId), req.user.id, roleInTask);

    await createNotification({
      userId: parseInt(userId),
      taskId: parseInt(req.params.id),
      message: `You have been assigned to a task`,
      type: 'task_assignment',
    });

    res.status(201).json({ message: 'User assigned to task', data: assignment });
  } catch (error) {
    console.error('Error assigning task:', error);
    res.status(500).json({ error: 'Failed to assign task' });
  }
});

router.get('/tasks/:id/assignments', requirePermission('document:search'), async (req, res) => {
  try {
    const assignments = await getTaskAssignments(parseInt(req.params.id));
    res.json({ data: assignments });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

router.get('/me/tasks', requireAuth, async (req, res) => {
  try {
    const tasks = await getTasks({ assignedTo: req.user.id });
    res.json({ data: tasks });
  } catch (error) {
    console.error('Error fetching user tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.get('/me/notifications', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const unreadOnly = req.query.unread === 'true';
    const notifications = await getNotifications(req.user.id, limit, unreadOnly);
    res.json({ data: notifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.get('/me/notifications/unread/count', requireAuth, async (req, res) => {
  try {
    const count = await getUnreadNotificationCount(req.user.id);
    res.json({ count });
  } catch (error) {
    console.error('Error fetching notification count:', error);
    res.status(500).json({ error: 'Failed to fetch notification count' });
  }
});

router.post('/me/notifications/read', requireAuth, async (req, res) => {
  try {
    await markAllNotificationsRead(req.user.id);
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking notifications:', error);
    res.status(500).json({ error: 'Failed to mark notifications' });
  }
});

router.post('/me/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    await markNotificationRead(parseInt(req.params.id));
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification:', error);
    res.status(500).json({ error: 'Failed to mark notification' });
  }
});

router.post('/tasks/:id/comments', requireAuth, requireTaskAssignment, async (req, res) => {
  try {
    const { comment } = req.body;
    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Comment is required' });
    }

    const task = await updateTaskComment(parseInt(req.params.id), comment, req.user.id);

    await createNotification({
      userId: task.assigned_to,
      taskId: task.id,
      documentId: task.document_id,
      message: `${req.user.username} commented on task: ${task.title}`,
      type: 'task_comment',
      metadata: { commenter_id: req.user.id }
    });

    res.json({ message: 'Comment added', data: task });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

export default router;
