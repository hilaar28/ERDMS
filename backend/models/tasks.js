import pool from '../db.js';

export async function initializeTaskTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
        assigned_by INTEGER REFERENCES users(id),
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        priority VARCHAR(20) DEFAULT 'normal',
        due_date TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_document_id ON tasks(document_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON tasks(assigned_by)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at)
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS task_assignments (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        assigned_by INTEGER REFERENCES users(id),
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        role_in_task VARCHAR(100)
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_task_assignments_task_id ON task_assignments(task_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_task_assignments_user_id ON task_assignments(user_id)
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
        document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
        message TEXT NOT NULL,
        notification_type VARCHAR(50) NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_task_id ON notifications(task_id)
    `);

    console.log('Task and notification tables initialized');
  } catch (err) {
    console.error('Task table initialization error:', err);
    throw err;
  }
}

export async function createTask({
  title,
  description,
  documentId,
  assignedTo,
  assignedBy,
  priority = 'normal',
  dueDate = null
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const taskResult = await client.query(
      `INSERT INTO tasks (title, description, document_id, assigned_to, assigned_by, priority, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [title, description, documentId, assignedTo, assignedBy, priority, dueDate]
    );

    const task = taskResult.rows[0];

    if (assignedTo) {
      await client.query(
        `INSERT INTO task_assignments (task_id, user_id, assigned_by)
         VALUES ($1, $2, $3)`,
        [task.id, assignedTo, assignedBy]
      );

      await client.query(
        `INSERT INTO notifications (user_id, task_id, document_id, message, notification_type, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [assignedTo, task.id, documentId, `New task assigned: ${title}`, 'task_assignment', JSON.stringify({ priority, dueDate })]
      );
    }

    await client.query('COMMIT');
    return task;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function createNotification({
  userId,
  taskId = null,
  documentId = null,
  message,
  type,
  metadata = {}
}) {
  const result = await pool.query(
    `INSERT INTO notifications (user_id, task_id, document_id, message, notification_type, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, taskId, documentId, message, type, JSON.stringify(metadata)]
  );
  return result.rows[0];
}

export async function getTasks(filters = {}) {
  let query = `
    SELECT t.*,
           d.name as document_name,
           assignee.username as assignee_username,
           assignee.full_name as assignee_full_name,
           assigner.username as assigner_username,
           assigner.full_name as assigner_full_name
    FROM tasks t
    LEFT JOIN documents d ON t.document_id = d.id
    LEFT JOIN users assignee ON t.assigned_to = assignee.id
    LEFT JOIN users assigner ON t.assigned_by = assigner.id
    WHERE 1=1
  `;
  const params = [];
  let paramCount = 0;

  if (filters.assignedTo) {
    paramCount++;
    params.push(filters.assignedTo);
    query += ` AND (t.assigned_to = $${paramCount} OR EXISTS (SELECT 1 FROM task_assignments ta WHERE ta.task_id = t.id AND ta.user_id = $${paramCount}))`;
  }

  if (filters.assignedBy) {
    paramCount++;
    params.push(filters.assignedBy);
    query += ` AND t.assigned_by = $${paramCount}`;
  }

  if (filters.status) {
    paramCount++;
    params.push(filters.status);
    query += ` AND t.status = $${paramCount}`;
  }

  if (filters.documentId) {
    paramCount++;
    params.push(filters.documentId);
    query += ` AND t.document_id = $${paramCount}`;
  }

  if (filters.priority) {
    paramCount++;
    params.push(filters.priority);
    query += ` AND t.priority = $${paramCount}`;
  }

  if (filters.overdue === 'true') {
    query += ` AND t.due_date < NOW() AND t.status != 'completed'`;
  }

  paramCount++;
  params.push(100);
  query += ` ORDER BY t.created_at DESC LIMIT $${paramCount}`;

  const result = await pool.query(query, params);
  return result.rows;
}

export async function getTaskById(id) {
  const result = await pool.query(
    `SELECT t.*,
           d.name as document_name, d.original_filename,
           assignee.username as assignee_username,
           assignee.full_name as assignee_full_name,
           assigner.username as assigner_username,
           assigner.full_name as assigner_full_name
    FROM tasks t
    LEFT JOIN documents d ON t.document_id = d.id
    LEFT JOIN users assignee ON t.assigned_to = assignee.id
    LEFT JOIN users assigner ON t.assigned_by = assigner.id
    WHERE t.id = $1`,
    [id]
  );
  return result.rows[0];
}

export async function updateTaskStatus(taskId, status, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE tasks SET status = $1, updated_at = CURRENT_TIMESTAMP,
       completed_at = ${status === 'completed' ? 'CURRENT_TIMESTAMP' : 'NULL'}
       WHERE id = $2 RETURNING *`,
      [status, taskId]
    );

    if (status === 'completed') {
      await createNotification({
        userId: result.rows[0].assigned_to,
        taskId,
        documentId: result.rows[0].document_id,
        message: `Task "${result.rows[0].title}" has been completed`,
        type: 'task_completed',
        metadata: { completed_by: userId }
      });
    }

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateTask(taskId, updates) {
  const fields = [];
  const values = [];
  let paramCount = 0;

  const updatableFields = ['title', 'description', 'priority', 'due_date', 'assigned_to'];
  for (const field of updatableFields) {
    if (updates[field] !== undefined) {
      paramCount++;
      fields.push(`${field} = $${paramCount}`);
      values.push(updates[field]);
    }
  }

  if (fields.length === 0) return getTaskById(taskId);

  paramCount++;
  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(taskId);

  const result = await pool.query(
    `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );
  return result.rows[0];
}

export async function getTaskAssignments(taskId) {
  const result = await pool.query(
    `SELECT ta.*, u.username, u.full_name
    FROM task_assignments ta
    LEFT JOIN users u ON ta.user_id = u.id
    WHERE ta.task_id = $1`,
    [taskId]
  );
  return result.rows;
}

export async function addTaskAssignment(taskId, userId, assignedBy, roleInTask = null) {
  const result = await pool.query(
    `INSERT INTO task_assignments (task_id, user_id, assigned_by, role_in_task)
    VALUES ($1, $2, $3, $4)
    RETURNING *`,
    [taskId, userId, assignedBy, roleInTask]
  );
  return result.rows[0];
}

export async function getNotifications(userId, limit = 50, unreadOnly = false) {
  let result;
  if (unreadOnly) {
    result = await pool.query(
      `SELECT n.*, t.title as task_title, d.name as document_name
       FROM notifications n
       LEFT JOIN tasks t ON n.task_id = t.id
       LEFT JOIN documents d ON n.document_id = d.id
       WHERE n.user_id = $1 AND n.is_read = FALSE
       ORDER BY n.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
  } else {
    result = await pool.query(
      `SELECT n.*, t.title as task_title, d.name as document_name
       FROM notifications n
       LEFT JOIN tasks t ON n.task_id = t.id
       LEFT JOIN documents d ON n.document_id = d.id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
  }
  return result.rows;
}

export async function markNotificationRead(notificationId) {
  await pool.query(
    `UPDATE notifications SET is_read = TRUE WHERE id = $1`,
    [notificationId]
  );
}

export async function markAllNotificationsRead(userId) {
  await pool.query(
    `UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`,
    [userId]
  );
}

export async function getUnreadNotificationCount(userId) {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
    [userId]
  );
  return parseInt(result.rows[0].count) || 0;
}

export async function deleteTask(taskId) {
  const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING id', [taskId]);
  return result.rowCount > 0;
}

export async function completeTask(taskId, userId) {
  const result = await pool.query(
    `UPDATE tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 RETURNING *`,
    [taskId]
  );
  return result.rows[0];
}

export async function updateTaskComment(taskId, comment, userId) {
  const result = await pool.query(
    `UPDATE tasks SET description = COALESCE(description, '') || '\nComment by ' || (SELECT username FROM users WHERE id = $2) || ' at ' || NOW() || ': ' || $3
    WHERE id = $1 RETURNING *`,
    [taskId, userId, comment]
  );
  return result.rows[0];
}
