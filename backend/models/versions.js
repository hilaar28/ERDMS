import pool from '../db.js';

export async function initializeVersioningTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_versions (
        id SERIAL PRIMARY KEY,
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL,
        name TEXT,
        original_filename TEXT,
        stored_filename TEXT,
        file_path TEXT,
        file_size BIGINT,
        mime_type TEXT,
        department TEXT,
        province TEXT,
        bucket_name TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_document_versions_document_id
      ON document_versions(document_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_document_versions_version_number
      ON document_versions(document_id, version_number)
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        resource_type TEXT,
        resource_id INTEGER,
        old_values JSONB,
        new_values JSONB,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_log_document_id ON audit_log(document_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at)
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_workflow (
        id SERIAL PRIMARY KEY,
        document_id INTEGER UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'draft',
        reviewer_id INTEGER REFERENCES users(id),
        reviewed_at TIMESTAMP,
        review_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_document_workflow_document_id ON document_workflow(document_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_document_workflow_status ON document_workflow(status)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_document_workflow_reviewer_id ON document_workflow(reviewer_id)
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_comments (
        id SERIAL PRIMARY KEY,
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        comment TEXT NOT NULL,
        parent_comment_id INTEGER REFERENCES document_comments(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_document_comments_document_id ON document_comments(document_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_document_comments_parent_id ON document_comments(parent_comment_id)
    `);

    console.log('Versioning tables initialized');
  } catch (err) {
    console.error('Versioning table initialization error:', err);
    throw err;
  }
}

export async function createVersion(documentId, {
  name,
  original_filename,
  stored_filename,
  file_path,
  file_size,
  mime_type,
  department,
  province,
  bucket_name,
  created_by
}) {
  const result = await pool.query(
    `INSERT INTO document_versions (
      document_id, version_number, name, original_filename, stored_filename,
      file_path, file_size, mime_type, department, province, bucket_name, created_by
    ) SELECT $1, COALESCE(MAX(version_number), 0) + 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
    FROM document_versions WHERE document_id = $1
    RETURNING *`,
    [documentId, name, original_filename, stored_filename, file_path, file_size, mime_type, department, province, bucket_name, created_by]
  );
  return result.rows[0];
}

export async function getVersions(documentId) {
  const result = await pool.query(
    `SELECT dv.*, u.username as created_by_username, u.full_name as created_by_full_name
    FROM document_versions dv
    LEFT JOIN users u ON dv.created_by = u.id
    WHERE dv.document_id = $1
    ORDER BY dv.version_number DESC`,
    [documentId]
  );
  return result.rows;
}

export async function getVersion(documentId, versionNumber) {
  const result = await pool.query(
    `SELECT dv.*, u.username as created_by_username, u.full_name as created_by_full_name
    FROM document_versions dv
    LEFT JOIN users u ON dv.created_by = u.id
    WHERE dv.document_id = $1 AND dv.version_number = $2`,
    [documentId, versionNumber]
  );
  return result.rows[0];
}

export async function restoreVersion(documentId, versionNumber, userId) {
  const version = await getVersion(documentId, versionNumber);
  if (!version) {
    throw new Error('Version not found');
  }

  await pool.query(
    `UPDATE documents SET
      name = $1, original_filename = $2, stored_filename = $3, file_path = $4,
      file_size = $5, mime_type = $6, department = $7, province = $8, bucket_name = $9,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $10`,
    [version.name, version.original_filename, version.stored_filename, version.file_path,
     version.file_size, version.mime_type, version.department, version.province,
     version.bucket_name, documentId]
  );

  await createAuditLog({
    document_id: documentId,
    user_id: userId,
    action: 'version_restore',
    resource_type: 'document',
    resource_id: documentId,
    old_values: null,
    new_values: { restored_from_version: versionNumber }
  });

  return version;
}

export async function createAuditLog({
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
  await pool.query(
    `INSERT INTO audit_log (document_id, user_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [document_id, user_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent]
  );
}

export async function getAuditLog(documentId, limit = 50) {
  const result = await pool.query(
    `SELECT al.*, u.username, u.full_name
    FROM audit_log al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE al.document_id = $1
    ORDER BY al.created_at DESC
    LIMIT $2`,
    [documentId, limit]
  );
  return result.rows;
}

export async function getAllAuditLogs(filters = {}, limit = 100) {
  let query = `
    SELECT al.*, u.username, u.full_name
    FROM audit_log al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.action) {
    params.push(filters.action);
    query += ` AND al.action = $${params.length}`;
  }

  if (filters.userId) {
    params.push(filters.userId);
    query += ` AND al.user_id = $${params.length}`;
  }

  if (filters.documentId) {
    params.push(filters.documentId);
    query += ` AND al.document_id = $${params.length}`;
  }

  params.push(limit);
  query += ` ORDER BY al.created_at DESC LIMIT $${params.length}`;

  const result = await pool.query(query, params);
  return result.rows;
}

export async function setWorkflowStatus(documentId, status, userId, notes = null) {
  const result = await pool.query(
    `INSERT INTO document_workflow (document_id, status, reviewer_id, reviewed_at, review_notes)
    VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4)
    ON CONFLICT (document_id)
    DO UPDATE SET status = $2, reviewer_id = $3, reviewed_at = CURRENT_TIMESTAMP, review_notes = $4, updated_at = CURRENT_TIMESTAMP
    RETURNING *`,
    [documentId, status, userId, notes]
  );

  await createAuditLog({
    document_id: documentId,
    user_id: userId,
    action: `workflow_${status}`,
    resource_type: 'document_workflow',
    resource_id: documentId,
    old_values: null,
    new_values: { status, notes }
  });

  return result.rows[0];
}

export async function getWorkflowStatus(documentId) {
  const result = await pool.query(
    `SELECT dw.*, u.username as reviewer_username, u.full_name as reviewer_full_name
    FROM document_workflow dw
    LEFT JOIN users u ON dw.reviewer_id = u.id
    WHERE dw.document_id = $1`,
    [documentId]
  );
  return result.rows[0];
}

export async function addComment(documentId, userId, comment, parentCommentId = null) {
  const result = await pool.query(
    `INSERT INTO document_comments (document_id, user_id, comment, parent_comment_id)
    VALUES ($1, $2, $3, $4)
    RETURNING *`,
    [documentId, userId, comment, parentCommentId]
  );

  await createAuditLog({
    document_id: documentId,
    user_id: userId,
    action: 'comment_add',
    resource_type: 'document_comment',
    resource_id: result.rows[0].id,
    old_values: null,
    new_values: { comment }
  });

  return result.rows[0];
}

export async function getComments(documentId) {
  const result = await pool.query(
    `SELECT dc.*, u.username, u.full_name
    FROM document_comments dc
    LEFT JOIN users u ON dc.user_id = u.id
    WHERE dc.document_id = $1
    ORDER BY dc.created_at ASC`,
    [documentId]
  );
  return result.rows;
}

export async function getDocumentWithVersions(documentId) {
  const docResult = await pool.query('SELECT * FROM documents WHERE id = $1', [documentId]);
  const versions = await getVersions(documentId);
  const workflow = await getWorkflowStatus(documentId);

  return {
    document: docResult.rows[0],
    versions,
    workflow: workflow || { status: 'draft', reviewer_id: null, reviewed_at: null, review_notes: null }
  };
}
