import pool from '../db.js';
import crypto from 'crypto';

export async function initializeImmutableAudit() {
  try {
    await pool.query(`
      ALTER TABLE audit_log
      ADD COLUMN IF NOT EXISTS previous_hash TEXT
    `);
    await pool.query(`
      ALTER TABLE audit_log
      ADD COLUMN IF NOT EXISTS record_hash TEXT
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_trail (
        id SERIAL PRIMARY KEY,
        document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(100),
        resource_id INTEGER,
        old_values JSONB,
        new_values JSONB,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        previous_hash TEXT,
        record_hash TEXT,
        is_immutable BOOLEAN DEFAULT TRUE,
        CONSTRAINT audit_immutable UNIQUE (id)
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_trail_document_id ON audit_trail(document_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_trail_user_id ON audit_trail(user_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_trail_action ON audit_trail(action)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_trail_created_at ON audit_trail(created_at)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_trail_hash ON audit_trail(record_hash)
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS audit_trail_unique_check
      ON audit_trail (document_id, action, created_at)
      WHERE document_id IS NOT NULL
    `);

    console.log('Immutable audit trail tables initialized');
  } catch (err) {
    console.error('Immutable audit initialization error:', err);
    throw err;
  }
}

export async function createImmutableAuditEntry({
  document_id,
  user_id,
  action,
  resource_type,
  resource_id,
  old_values,
  new_values,
  ip_address,
  user_agent
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const latest = await client.query(
      `SELECT record_hash FROM audit_trail ORDER BY id DESC LIMIT 1`
    );
    const prevHash = latest.rows.length > 0 ? latest.rows[0].record_hash : 'genesis';

    const content = JSON.stringify({
      document_id,
      user_id,
      action,
      resource_type,
      resource_id,
      old_values,
      new_values,
      ip_address,
      user_agent,
      created_at: new Date().toISOString(),
      previous_hash: prevHash
    });

    const currentHash = crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');

    const result = await client.query(
      `INSERT INTO audit_trail
        (document_id, user_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent, previous_hash, record_hash)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [document_id, user_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent, prevHash, currentHash]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Immutable audit log error:', err);
    throw err;
  } finally {
    client.release();
  }
}

export async function verifyAuditIntegrity(startId = null) {
  try {
    let query = `
      SELECT id, document_id, user_id, action, resource_type, resource_id,
             old_values, new_values, ip_address, user_agent, created_at, previous_hash, record_hash
      FROM audit_trail
    `;
    const params = [];

    if (startId) {
      params.push(startId);
      query += ` WHERE id >= $${params.length}`;
    }

    query += ` ORDER BY id ASC`;

    const result = await pool.query(query, params);

    let expectedPrevHash = 'genesis';
    const issues = [];

    for (const row of result.rows) {
      const content = JSON.stringify({
        document_id: row.document_id,
        user_id: row.user_id,
        action: row.action,
        resource_type: row.resource_type,
        resource_id: row.resource_id,
        old_values: row.old_values,
        new_values: row.new_values,
        ip_address: row.ip_address,
        user_agent: row.user_agent,
        created_at: row.created_at.toISOString(),
        previous_hash: expectedPrevHash
      });

      const expectedHash = crypto
        .createHash('sha256')
        .update(content)
        .digest('hex');

      if (row.previous_hash !== expectedPrevHash) {
        issues.push({
          id: row.id,
          issue: 'previous_hash_mismatch',
          expected: expectedPrevHash,
          actual: row.previous_hash
        });
      }

      if (row.record_hash !== expectedHash) {
        issues.push({
          id: row.id,
          issue: 'record_hash_mismatch',
          expected: expectedHash,
          actual: row.record_hash
        });
      }

      expectedPrevHash = row.record_hash;
    }

    return {
      totalRecords: result.rows.length,
      isIntegrityValid: issues.length === 0,
      issues
    };
  } catch (err) {
    console.error('Audit integrity verification error:', err);
    throw err;
  }
}

export async function getAuditTrail(documentId, limit = 100) {
  const result = await pool.query(
    `SELECT at.*, u.username, u.full_name
    FROM audit_trail at
    LEFT JOIN users u ON at.user_id = u.id
    WHERE at.document_id = $1
    ORDER BY at.created_at DESC
    LIMIT $2`,
    [documentId, limit]
  );
  return result.rows;
}

export async function getAllAuditTrail(filters = {}, limit = 100) {
  let query = `
    SELECT at.*, u.username, u.full_name, d.name as document_name, d.original_filename
    FROM audit_trail at
    LEFT JOIN users u ON at.user_id = u.id
    LEFT JOIN documents d ON at.document_id = d.id
    WHERE at.is_immutable = TRUE
  `;
  const params = [];
  let paramCount = 0;

  if (filters.action) {
    paramCount++;
    params.push(filters.action);
    query += ` AND at.action = $${paramCount}`;
  }

  if (filters.userId) {
    paramCount++;
    params.push(filters.userId);
    query += ` AND at.user_id = $${paramCount}`;
  }

  if (filters.documentId) {
    paramCount++;
    params.push(filters.documentId);
    query += ` AND at.document_id = $${paramCount}`;
  }

  if (filters.dateFrom) {
    paramCount++;
    params.push(filters.dateFrom);
    query += ` AND at.created_at >= $${paramCount}`;
  }

  if (filters.dateTo) {
    paramCount++;
    params.push(filters.dateTo);
    query += ` AND at.created_at <= $${paramCount}`;
  }

  if (filters.resourceType) {
    paramCount++;
    params.push(filters.resourceType);
    query += ` AND at.resource_type = $${paramCount}`;
  }

  paramCount++;
  params.push(limit);
  query += ` ORDER BY at.created_at DESC LIMIT $${paramCount}`;

  const result = await pool.query(query, params);
  return result.rows;
}

export async function getAuditStats() {
  const result = await pool.query(`
    SELECT
      action,
      COUNT(*) as count,
      COUNT(DISTINCT user_id) as unique_users,
      COUNT(DISTINCT document_id) as unique_documents,
      MIN(created_at) as first_action,
      MAX(created_at) as last_action
    FROM audit_trail
    WHERE is_immutable = TRUE
    GROUP BY action
    ORDER BY count DESC
  `);
  return result.rows;
}

export async function getAuditSummary(dateFrom = null, dateTo = null) {
  let query = `
    SELECT
      COUNT(*) as total_entries,
      COUNT(DISTINCT user_id) as unique_users,
      COUNT(DISTINCT document_id) as unique_documents,
      MIN(created_at) as earliest_entry,
      MAX(created_at) as latest_entry
    FROM audit_trail
    WHERE is_immutable = TRUE
  `;
  const params = [];
  let paramCount = 0;

  if (dateFrom) {
    paramCount++;
    params.push(dateFrom);
    query += ` AND created_at >= $${paramCount}`;
  }

  if (dateTo) {
    paramCount++;
    params.push(dateTo);
    query += ` AND created_at <= $${paramCount}`;
  }

  const result = await pool.query(query, params);
  return result.rows[0];
}

export async function exportAuditTrail(filters = {}) {
  const rows = await getAllAuditTrail(filters, 10000);
  return rows;
}
