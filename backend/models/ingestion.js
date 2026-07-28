import pool from '../db.js';

/* Initialize database schema for ingestion */
export async function initIngestionSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        original_filename VARCHAR(512),
        stored_filename VARCHAR(512),
        file_path VARCHAR(1024),
        file_size BIGINT,
        mime_type VARCHAR(255),
        bucket_name VARCHAR(255),
        category VARCHAR(100),
        source VARCHAR(50),
        department VARCHAR(100),
        province VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Index for fast searches by department/province
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_docs_dept_prov
      ON documents (department, province);
    `);

    console.log('Ingestion schema initialized');
  } catch (err) {
    console.error('Schema init error:', err);
    throw err;
  }
}

/* Save document metadata after successful processing */
export async function saveDocumentMetadata(metadata) {
  const result = await pool.query(
    `INSERT INTO documents
      (name, original_filename, stored_filename, file_path, file_size, mime_type, bucket_name, category, source, department, province, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
     RETURNING id`,
    [
      metadata.name,
      metadata.originalFilename,
      metadata.storedFilename,
      metadata.filePath,
      metadata.fileSize,
      metadata.mimeType,
      metadata.bucketName,
      metadata.category ?? null,
      metadata.source ?? null,
      metadata.department ?? null,
      metadata.province ?? null
    ]
  );

  return result.rows[0].id;
}
