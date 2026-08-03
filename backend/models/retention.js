import pool from '../db.js';

export async function initializeRetentionTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS retention_policies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        document_type VARCHAR(100),
        department VARCHAR(100),
        retention_period INTERVAL NOT NULL,
        disposal_action VARCHAR(50) NOT NULL DEFAULT 'delete',
        is_active BOOLEAN DEFAULT TRUE,
        requires_approval BOOLEAN DEFAULT FALSE,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_retention_policies_department ON retention_policies(department)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_retention_policies_document_type ON retention_policies(document_type)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_retention_policies_active ON retention_policies(is_active)
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_retention (
        id SERIAL PRIMARY KEY,
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        policy_id INTEGER REFERENCES retention_policies(id),
        retention_period INTERVAL,
        dispose_at TIMESTAMP,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        applied_by INTEGER REFERENCES users(id)
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_document_retention_document_id ON document_retention(document_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_document_retention_dispose_at ON document_retention(dispose_at)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_document_retention_policy_id ON document_retention(policy_id)
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS disposal_logs (
        id SERIAL PRIMARY KEY,
        document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
        policy_id INTEGER REFERENCES retention_policies(id),
        disposition_action VARCHAR(50),
        disposal_method VARCHAR(100),
        approved_by INTEGER REFERENCES users(id),
        approved_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_disposal_logs_document_id ON disposal_logs(document_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_disposal_logs_created_at ON disposal_logs(created_at)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_disposal_logs_approved_at ON disposal_logs(approved_at)
    `);

    console.log('Retention and disposal tables initialized');
  } catch (err) {
    console.error('Retention table initialization error:', err);
    throw err;
  }
}

export async function createRetentionPolicy({
  name,
  description,
  documentType,
  department,
  retentionPeriod,
  disposalAction,
  requiresApproval,
  userId
}) {
  const result = await pool.query(
    `INSERT INTO retention_policies
      (name, description, document_type, department, retention_period, disposal_action, requires_approval, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [name, description, documentType, department, retentionPeriod, disposalAction, requiresApproval, userId]
  );
  return result.rows[0];
}

export async function getPolicies(filters = {}) {
  let query = `
    SELECT p.*, u.username as created_by_username, u.full_name as created_by_full_name
    FROM retention_policies p
    LEFT JOIN users u ON p.created_by = u.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.isActive !== undefined) {
    params.push(filters.isActive);
    query += ` AND p.is_active = $${params.length}`;
  }

  if (filters.department) {
    params.push(filters.department);
    query += ` AND p.department = $${params.length}`;
  }

  if (filters.documentType) {
    params.push(filters.documentType);
    query += ` AND p.document_type = $${params.length}`;
  }

  query += ` ORDER BY p.created_at DESC`;

  const result = await pool.query(query, params);
  return result.rows;
}

export async function getPolicyById(id) {
  const result = await pool.query(
    `SELECT p.*, u.username as created_by_username, u.full_name as created_by_full_name
    FROM retention_policies p
    LEFT JOIN users u ON p.created_by = u.id
    WHERE p.id = $1`,
    [id]
  );
  return result.rows[0];
}

export async function updatePolicy(id, updates) {
  const fields = [];
  const values = [];
  let paramCount = 0;

  const updatableFields = ['name', 'description', 'document_type', 'department',
    'retention_period', 'disposal_action', 'is_active', 'requires_approval'];

  for (const field of updatableFields) {
    if (updates[field] !== undefined) {
      paramCount++;
      fields.push(`${field} = $${paramCount}`);
      values.push(updates[field]);
    }
  }

  if (fields.length === 0) return getPolicyById(id);

  paramCount++;
  fields.push(`updated_at = CURRENT_TIMESTAMP`);

  values.push(id);

  const result = await pool.query(
    `UPDATE retention_policies SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );
  return result.rows[0];
}

export async function deletePolicy(id) {
  const result = await pool.query('DELETE FROM retention_policies WHERE id = $1 RETURNING id', [id]);
  return result.rowCount > 0;
}

export async function applyPolicyToDocument(documentId, policyId, userId) {
  const policy = await getPolicyById(policyId);
  if (!policy) throw new Error('Retention policy not found');

  const disposeAt = new Date();
  disposeAt.setTime(disposeAt.getTime() + parseInterval(policy.retention_period));

  await pool.query(
    `INSERT INTO document_retention
      (document_id, policy_id, retention_period, dispose_at, applied_by)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (document_id)
    DO UPDATE SET policy_id = $2, retention_period = $3, dispose_at = $4, applied_by = $5`,
    [documentId, policyId, policy.retention_period, disposeAt, userId]
  );

  return { documentId, policyId, disposeAt };
}

function parseInterval(intervalStr) {
  if (!intervalStr) return 0;
  const matches = intervalStr.match(/(\d+)\s*(\w+)/);
  if (!matches) return 0;
  const num = parseInt(matches[1]);
  const unit = matches[2].toLowerCase();
  switch (unit) {
    case 'day':
    case 'days':
    case 'day':
      return num * 24 * 60 * 60 * 1000;
    case 'month':
    case 'months':
      return num * 30 * 24 * 60 * 60 * 1000;
    case 'year':
    case 'years':
      return num * 365 * 24 * 60 * 60 * 1000;
    default:
      return num * 24 * 60 * 60 * 1000;
  }
}

export async function getDueForDisposal(dateFilter = null) {
  let query = `
    SELECT dr.*, d.name, d.original_filename, p.name as policy_name, p.disposal_action
    FROM document_retention dr
    JOIN documents d ON dr.document_id = d.id
    JOIN retention_policies p ON dr.policy_id = p.id
    WHERE dr.dispose_at <= NOW()
  `;
  const params = [];

  if (dateFilter) {
    params.push(dateFilter);
    query += ` AND dr.dispose_at <= $${params.length}`;
  }

  query += ` ORDER BY dr.dispose_at ASC`;

  const result = await pool.query(query, params);
  return result.rows;
}

export async function logDisposal({
  documentId,
  policyId,
  dispositionAction,
  disposalMethod,
  approvedBy,
  approvedAt,
  notes
}) {
  const result = await pool.query(
    `INSERT INTO disposal_logs
      (document_id, policy_id, disposition_action, disposal_method, approved_by, approved_at, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [documentId, policyId, dispositionAction, disposalMethod, approvedBy, approvedAt, notes]
  );
  return result.rows[0];
}

export async function executeDisposal(documentId, disposalLogId, reason = 'Retention period expired') {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query('UPDATE documents SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [documentId]);

    await client.query(
      'UPDATE disposal_logs SET notes = COALESCE(notes, \'\') || $2 WHERE id = $1',
      [disposalLogId, ` - Disposed: ${reason}`]
    );

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getAllDisposalLogs(filters = {}, limit = 100) {
  let query = `
    SELECT dl.*, d.name as document_name, d.original_filename,
           p.name as policy_name,
           u1.username as approved_by_username, u1.full_name as approved_by_full_name
    FROM disposal_logs dl
    LEFT JOIN documents d ON dl.document_id = d.id
    LEFT JOIN retention_policies p ON dl.policy_id = p.id
    LEFT JOIN users u1 ON dl.approved_by = u1.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.userId) {
    params.push(filters.userId);
    query += ` AND dl.approved_by = $${params.length}`;
  }

  if (filters.dateFrom) {
    params.push(filters.dateFrom);
    query += ` AND dl.created_at >= $${params.length}`;
  }

  if (filters.dateTo) {
    params.push(filters.dateTo);
    query += ` AND dl.created_at <= $${params.length}`;
  }

  params.push(limit);
  query += ` ORDER BY dl.created_at DESC LIMIT $${params.length}`;

  const result = await pool.query(query, params);
  return result.rows;
}

export async function getDocumentRetentionStatus(documentId) {
  const result = await pool.query(
    `SELECT dr.*, p.name as policy_name, p.description as policy_description, p.retention_period, p.disposal_action
    FROM document_retention dr
    JOIN retention_policies p ON dr.policy_id = p.id
    WHERE dr.document_id = $1`,
    [documentId]
  );
  return result.rows[0];
}

export async function getRetentionSchedule() {
  const result = await pool.query(`
    SELECT d.id, d.name, d.original_filename, d.created_at,
           dr.dispose_at, dr.retention_period,
           p.name as policy_name, p.disposal_action, p.requires_approval,
           EXTRACT(DAY FROM (dr.dispose_at - CURRENT_TIMESTAMP)) as days_remaining
    FROM document_retention dr
    JOIN documents d ON dr.document_id = d.id
    JOIN retention_policies p ON dr.policy_id = p.id
    WHERE d.is_deleted IS DISTINCT FROM TRUE OR d.is_deleted IS NULL
    ORDER BY dr.dispose_at ASC
  `);
  return result.rows;
}
