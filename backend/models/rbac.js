import pool from '../db.js';
import bcrypt from 'bcryptjs';

export async function initializeAuthTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id SERIAL PRIMARY KEY,
        role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
        permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token)
    `);

    const defaultRoles = ['Administrator', 'Records Officer', 'Department Head', 'General User'];
    for (const role of defaultRoles) {
      await pool.query(
        `INSERT INTO roles (name, description) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`,
        [role, `${role} role`]
      );
    }

    const defaultPermissions = [
      'document:create',
      'document:read',
      'document:update',
      'document:delete',
      'document:register',
      'document:search',
      'user:create',
      'user:read',
      'user:update',
      'user:delete',
      'role:manage',
      'system:admin'
    ];

    for (const permission of defaultPermissions) {
      await pool.query(
        `INSERT INTO permissions (name, description) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`,
        [permission, `${permission} permission`]
      );
    }

    const adminRoleId = (await pool.query('SELECT id FROM roles WHERE name = $1', ['Administrator'])).rows[0].id;
    const permIds = (await pool.query('SELECT id, name FROM permissions')).rows;

    for (const { id } of permIds) {
      await pool.query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [adminRoleId, id]
      );
    }

    const recordsOfficerId = (await pool.query('SELECT id FROM roles WHERE name = $1', ['Records Officer'])).rows[0].id;
    const recordsPermissions = permIds.filter(p => p.name.startsWith('document:') || p.name.startsWith('user:'));
    for (const { id } of recordsPermissions) {
      await pool.query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [recordsOfficerId, id]
      );
    }

    const departmentHeadId = (await pool.query('SELECT id FROM roles WHERE name = $1', ['Department Head'])).rows[0].id;
    const deptPermissions = permIds.filter(p => p.name.startsWith('document:read') || p.name.startsWith('document:search'));
    for (const { id } of deptPermissions) {
      await pool.query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [departmentHeadId, id]
      );
    }

    const generalUserId = (await pool.query('SELECT id FROM roles WHERE name = $1', ['General User'])).rows[0].id;
    const generalPermissions = permIds.filter(p => p.name.startsWith('document:read') || p.name.startsWith('document:search'));
    for (const { id } of generalPermissions) {
      await pool.query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [generalUserId, id]
      );
    }

    console.log('Auth tables initialized with default roles and permissions');

    const adminExists = await pool.query('SELECT id FROM users WHERE username = $1', ['admin']);
    if (adminExists.rowCount === 0) {
      const adminPassword = await bcrypt.hash('admin123', 10);
      await pool.query(
        `INSERT INTO users (username, email, full_name, password_hash, is_active)
         VALUES ($1, $2, $3, $4, TRUE)
         ON CONFLICT (username) DO NOTHING
         RETURNING id`,
        ['admin', 'admin@erdms.local', 'System Administrator', adminPassword]
      );

      const adminUser = await pool.query('SELECT id FROM users WHERE username = $1', ['admin']);
      const adminUserId = adminUser.rows[0].id;
      const adminRoleId = (await pool.query('SELECT id FROM roles WHERE name = $1', ['Administrator'])).rows[0].id;
      await pool.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [adminUserId, adminRoleId]
      );

      console.log('Default admin user created (username: admin, password: admin123)');
    }
  } catch (err) {
    console.error('Auth table initialization error:', err);
    throw err;
  }
}

export async function createUser({ username, email, full_name, password }) {
  const password_hash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `INSERT INTO users (username, email, full_name, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, username, email, full_name, is_active, created_at`,
    [username, email, full_name, password_hash]
  );
  return result.rows[0];
}

export async function getUserById(id) {
  const result = await pool.query(
    `SELECT id, username, email, full_name, is_active, created_at FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0];
}

export async function getUserByUsername(username) {
  const result = await pool.query(
    `SELECT id, username, email, full_name, is_active, created_at FROM users WHERE username = $1`,
    [username]
  );
  return result.rows[0];
}

export async function getUserByEmail(email) {
  const result = await pool.query(
    `SELECT id, username, email, full_name, is_active, created_at FROM users WHERE email = $1`,
    [email]
  );
  return result.rows[0];
}

export async function getUserWithHash(id) {
  const result = await pool.query(
    `SELECT id, username, email, full_name, password_hash, is_active, created_at FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0];
}

export async function verifyPassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

export async function getUserRoles(userId) {
  const result = await pool.query(`
    SELECT r.id, r.name, r.description, r.created_at
    FROM roles r
    JOIN user_roles ur ON r.id = ur.role_id
    WHERE ur.user_id = $1
  `, [userId]);
  return result.rows;
}

export async function getUserPermissions(userId) {
  const result = await pool.query(`
    SELECT DISTINCT p.id, p.name, p.description
    FROM permissions p
    JOIN role_permissions rp ON p.id = rp.permission_id
    JOIN user_roles ur ON rp.role_id = ur.role_id
    WHERE ur.user_id = $1
  `, [userId]);
  return result.rows;
}

export async function getUserPermissionsAndRoles(userId) {
  const roles = await getUserRoles(userId);
  const permissions = await getUserPermissions(userId);
  return { roles, permissions };
}

export async function assignRoleToUser(userId, roleId) {
  await pool.query(
    `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, roleId]
  );
}

export async function removeRoleFromUser(userId, roleId) {
  await pool.query(
    `DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2`,
    [userId, roleId]
  );
}

export async function createRole(name, description) {
  const result = await pool.query(
    `INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING id, name, description, created_at`,
    [name, description]
  );
  return result.rows[0];
}

export async function updateRole(roleId, name, description) {
  const result = await pool.query(
    `UPDATE roles SET name = $1, description = $2 WHERE id = $3 RETURNING id, name, description, created_at`,
    [name, description, roleId]
  );
  return result.rows[0];
}

export async function deleteRole(roleId) {
  const result = await pool.query('DELETE FROM roles WHERE id = $1 RETURNING id', [roleId]);
  return result.rowCount > 0;
}

export async function getAllPermissions() {
  const result = await pool.query('SELECT id, name, description FROM permissions ORDER BY name');
  return result.rows;
}

export async function getRolePermissions(roleId) {
  const result = await pool.query(`
    SELECT p.id, p.name, p.description
    FROM permissions p
    JOIN role_permissions rp ON p.id = rp.permission_id
    WHERE rp.role_id = $1
    ORDER BY p.name
  `, [roleId]);
  return result.rows;
}

export async function assignPermissionToRole(roleId, permissionId) {
  await pool.query(
    `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [roleId, permissionId]
  );
}

export async function removePermissionFromRole(roleId, permissionId) {
  await pool.query(
    `DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2`,
    [roleId, permissionId]
  );
}

export async function createSession(userId, token, expiresAt) {
  await pool.query(
    `INSERT INTO user_sessions (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [userId, token, expiresAt]
  );
}

export async function invalidateSession(token) {
  await pool.query(`DELETE FROM user_sessions WHERE token = $1`, [token]);
}

export async function getSession(token) {
  const result = await pool.query(`
    SELECT us.id, us.user_id, us.expires_at, u.username, u.email, u.full_name
    FROM user_sessions us
    JOIN users u ON us.user_id = u.id
    WHERE us.token = $1 AND us.expires_at > NOW()
  `, [token]);
  return result.rows[0];
}

export async function cleanupSessions() {
  await pool.query(`DELETE FROM user_sessions WHERE expires_at < NOW()`);
}

export async function initializeCmsTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_cms_links (
        id SERIAL PRIMARY KEY,
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        case_id TEXT NOT NULL,
        case_system TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_cms_links_document_id ON document_cms_links(document_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_cms_links_case_id ON document_cms_links(case_id)
    `);

    console.log('CMS tables initialized');
  } catch (err) {
    console.error('CMS table initialization error:', err);
    throw err;
  }
}