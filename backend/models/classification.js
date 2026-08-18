import pool from '../db.js';

export async function initClassificationSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS file_numbers (
        id SERIAL PRIMARY KEY,
        class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        file_number VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(class_id, file_number)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS folio_numbers (
        id SERIAL PRIMARY KEY,
        file_number_id INTEGER NOT NULL REFERENCES file_numbers(id) ON DELETE CASCADE,
        folio_number VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(file_number_id, folio_number)
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_file_numbers_class
      ON file_numbers (class_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_folio_numbers_file
      ON folio_numbers (file_number_id);
    `);

    console.log('Classification schema initialized');
  } catch (err) {
    console.error('Classification schema init error:', err);
    throw err;
  }
}

export async function getClasses() {
  const result = await pool.query('SELECT id, name, description FROM classes ORDER BY name');
  return result.rows;
}

export async function createClass(name, description = '') {
  const result = await pool.query(
    'INSERT INTO classes (name, description) VALUES ($1, $2) RETURNING id, name, description',
    [name, description]
  );
  return result.rows[0];
}

export async function getFileNumbersByClass(classId) {
  const result = await pool.query(
    'SELECT id, file_number, description FROM file_numbers WHERE class_id = $1 ORDER BY file_number',
    [classId]
  );
  return result.rows;
}

export async function createFileNumber(classId, fileNumber, description = '') {
  const result = await pool.query(
    'INSERT INTO file_numbers (class_id, file_number, description) VALUES ($1, $2, $3) RETURNING id, file_number, description',
    [classId, fileNumber, description]
  );
  return result.rows[0];
}

export async function getFolioNumbersByFileNumber(fileNumberId) {
  const result = await pool.query(
    'SELECT id, folio_number, description FROM folio_numbers WHERE file_number_id = $1 ORDER BY folio_number',
    [fileNumberId]
  );
  return result.rows;
}

export async function createFolioNumber(fileNumberId, folioNumber, description = '') {
  const result = await pool.query(
    'INSERT INTO folio_numbers (file_number_id, folio_number, description) VALUES ($1, $2, $3) RETURNING id, folio_number, description',
    [fileNumberId, folioNumber, description]
  );
  return result.rows[0];
}
