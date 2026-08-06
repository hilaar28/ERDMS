import pool from '../db.js';

export async function initializeIndexTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_tags (
        id SERIAL PRIMARY KEY,
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        tag TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_document_tags_document_id
      ON document_tags (document_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_document_tags_tag
      ON document_tags (tag)
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS search_vector_store (
        document_id INTEGER PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
        content_ts TSVECTOR
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_search_vector
      ON search_vector_store
      USING GIN (content_ts)
    `);

    console.log('Index tables initialized');
  } catch (err) {
    console.error('Index table initialization error:', err);
    throw err;
  }
}

export async function indexDocument(documentId) {
  try {
    const docResult = await pool.query(
      `SELECT name, original_filename, mime_type, department, province, category, bucket_name FROM documents WHERE id = $1`,
      [documentId]
    );

    if (docResult.rows.length === 0) {
      throw new Error(`Document with id ${documentId} not found`);
    }

    const doc = docResult.rows[0];
    const content = `${doc.name || ''} ${doc.original_filename || ''} ${doc.category || ''} ${doc.department || ''} ${doc.province || ''}`;

    await pool.query(`
      INSERT INTO search_vector_store (document_id, content_ts)
      VALUES ($1, to_tsvector('english', $2))
      ON CONFLICT (document_id)
      DO UPDATE SET content_ts = EXCLUDED.content_ts
    `, [documentId, content]);

    console.log(`Document ${documentId} indexed successfully`);
  } catch (err) {
    console.error('Indexing error: ' + documentId, err);
    throw err;
  }
}

export async function searchDocuments(query, userId = null) {
  try {
    let sql = `
      SELECT d.*, ts_rank(sv.content_ts, query) AS rank
      FROM documents d
      JOIN search_vector_store sv ON d.id = sv.document_id
      JOIN to_tsquery('english', $1) query ON sv.content_ts @@ query
    `;
    const params = [query];

    if (userId !== null) {
      sql += ` WHERE d.created_by = $2`;
      params.push(userId);
    }

    sql += ` ORDER BY rank DESC`;

    const result = await pool.query(sql, params);
    return result.rows;
  } catch (err) {
    console.error('Search error:', err);
    throw err;
  }
}

export async function addTag(documentId, tag) {
  try {
    await pool.query(
      `INSERT INTO document_tags (document_id, tag) VALUES ($1, $2)`,
      [documentId, tag]
    );
  } catch (err) {
    console.error('Add tag error:', err);
    throw err;
  }
}

export async function getTags(documentId) {
  try {
    const result = await pool.query(
      `SELECT id, tag, created_at FROM document_tags WHERE document_id = $1 ORDER BY created_at DESC`,
      [documentId]
    );
    return result.rows;
  } catch (err) {
    console.error('Get tags error:', err);
    throw err;
  }
}

export async function searchByTag(tagPattern, userId = null) {
  try {
    let sql = `
      SELECT d.*, dt.tag
      FROM documents d
      JOIN document_tags dt ON d.id = dt.document_id
      WHERE dt.tag ILIKE $1
    `;
    const params = [`%${tagPattern}%`];

    if (userId !== null) {
      sql += ` AND d.created_by = $2`;
      params.push(userId);
    }

    sql += ` ORDER BY d.created_at DESC`;

    const result = await pool.query(sql, params);
    return result.rows;
  } catch (err) {
    console.error('Tag search error:', err);
    throw err;
  }
}