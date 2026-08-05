import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import {
  createUser,
  getUserByUsername,
  getUserWithHash,
  getUserById,
  getUserByEmail,
  verifyPassword,
  assignRoleToUser,
  removeRoleFromUser,
  getUserRoles,
  getUserPermissionsAndRoles,
  createSession,
  invalidateSession,
  getSession,
  cleanupSessions,
  createRole,
  updateRole,
  deleteRole,
  getAllPermissions,
  getRolePermissions,
  assignPermissionToRole,
  removePermissionFromRole
} from '../models/rbac.js';
import { generateToken, requireAuth, requirePermission, requireRole, rotateJwtSecret, getJwtSecret, getPreviousJwtSecret } from '../middleware/auth.js';
import { createAuditLog } from '../models/versions.js';

const router = express.Router();

router.post('/register', async (req, res) => {
  const { username, email, full_name, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  if (await getUserByUsername(username)) {
    return res.status(409).json({ error: 'Username already exists' });
  }

  const existingUser = await getUserById(1);
  if (existingUser) {
    const userWithEmail = await getUserByEmail(email);
    if (userWithEmail) {
      return res.status(409).json({ error: 'Email already registered' });
    }
  }

  try {
    const user = await createUser({ username, email, full_name, password });
    return res.status(201).json({
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      created_at: user.created_at
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = await getUserByUsername(username);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const userWithHash = await getUserWithHash(user.id);
    const isValid = await verifyPassword(password, userWithHash.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await createSession(user.id, token, expiresAt);

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', requireAuth, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader.substring(7);
    await invalidateSession(token);
    return res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ error: 'Logout failed' });
  }
});

router.post('/jwt/rotate', requireAuth, requireRole('Administrator'), async (req, res) => {
  try {
    const { newSecret } = req.body;

    if (!newSecret || newSecret.length < 32) {
      return res.status(400).json({ error: 'New JWT secret must be at least 32 characters' });
    }

    rotateJwtSecret(newSecret);

    await createAuditLog({
      document_id: null,
      user_id: req.user.id,
      action: 'jwt_secret_rotated',
      resource_type: 'system',
      resource_id: null,
      old_values: { loaded_at: getPreviousJwtSecret() ? 'previous_secret_available' : 'no_previous' },
      new_values: { loaded_at: getJwtSecret() ? 'new_secret_active' : 'error' },
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    return res.json({ message: 'JWT secret rotated successfully', rotated_at: new Date().toISOString() });
  } catch (err) {
    console.error('JWT rotation error:', err);
    return res.status(500).json({ error: 'JWT rotation failed' });
  }
});

router.get('/jwt/status', requireAuth, requireRole('Administrator'), async (req, res) => {
  try {
    return res.json({
      initialized: !!getJwtSecret(),
      loaded_at: getJwtSecret() ? 'available' : 'not_loaded',
      has_previous: !!getPreviousJwtSecret(),
      rotation_supported: true
    });
  } catch (err) {
    console.error('JWT status error:', err);
    return res.status(500).json({ error: 'Failed to get JWT status' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const { roles, permissions } = await getUserPermissionsAndRoles(req.user.id);
    return res.json({
      user: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        full_name: req.user.full_name,
        is_active: req.user.is_active
      },
      roles,
      permissions
    });
  } catch (err) {
    console.error('Get user error:', err);
    return res.status(500).json({ error: 'Failed to fetch user info' });
  }
});

router.get('/users', requireAuth, requirePermission('user:read'), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, email, full_name, is_active, created_at FROM users');
    return res.json({ data: result.rows });
  } catch (err) {
    console.error('Get users error:', err);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/roles', requireAuth, requirePermission('role:manage'), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, description FROM roles ORDER BY name');
    return res.json({ data: result.rows });
  } catch (err) {
    console.error('Get roles error:', err);
    return res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

router.get('/users/:id/roles', requireAuth, requirePermission('user:read'), async (req, res) => {
  try {
    const user = await getUserById(parseInt(req.params.id));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const roles = await getUserRoles(parseInt(req.params.id));
    return res.json({ data: roles });
  } catch (err) {
    console.error('Get user roles error:', err);
    return res.status(500).json({ error: 'Failed to fetch user roles' });
  }
});

router.get('/users/:id', requireAuth, requirePermission('user:read'), async (req, res) => {
  try {
    const user = await getUserById(parseInt(req.params.id));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ data: user });
  } catch (err) {
    console.error('Get user error:', err);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.delete('/users/:id', requireAuth, requirePermission('user:delete'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [parseInt(req.params.id)]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    return res.status(500).json({ error: 'Failed to delete user' });
  }
});

router.post('/users/:id/roles', requireAuth, requirePermission('role:manage'), async (req, res) => {
  const { roleId } = req.body;
  if (!roleId) {
    return res.status(400).json({ error: 'Role ID is required' });
  }

  try {
    await assignRoleToUser(parseInt(req.params.id), parseInt(roleId));
    return res.json({ message: 'Role assigned successfully' });
  } catch (err) {
    console.error('Assign role error:', err);
    return res.status(500).json({ error: 'Failed to assign role' });
  }
});

router.delete('/users/:id/roles/:roleId', requireAuth, requirePermission('role:manage'), async (req, res) => {
  try {
    await removeRoleFromUser(parseInt(req.params.id), parseInt(req.params.roleId));
    return res.json({ message: 'Role removed successfully' });
  } catch (err) {
    console.error('Remove role error:', err);
    return res.status(500).json({ error: 'Failed to remove role' });
  }
});

router.post('/roles', requireAuth, requirePermission('role:manage'), async (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Role name is required' });
  }
  try {
    const role = await createRole(name.trim(), description || '');
    return res.status(201).json({ data: role });
  } catch (err) {
    console.error('Create role error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Role name already exists' });
    }
    return res.status(500).json({ error: 'Failed to create role' });
  }
});

router.put('/roles/:id', requireAuth, requirePermission('role:manage'), async (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Role name is required' });
  }
  try {
    const role = await updateRole(parseInt(req.params.id), name.trim(), description || '');
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }
    return res.json({ data: role });
  } catch (err) {
    console.error('Update role error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Role name already exists' });
    }
    return res.status(500).json({ error: 'Failed to update role' });
  }
});

router.delete('/roles/:id', requireAuth, requirePermission('role:manage'), async (req, res) => {
  try {
    const deleted = await deleteRole(parseInt(req.params.id));
    if (!deleted) {
      return res.status(404).json({ error: 'Role not found' });
    }
    return res.json({ message: 'Role deleted successfully' });
  } catch (err) {
    console.error('Delete role error:', err);
    return res.status(500).json({ error: 'Failed to delete role' });
  }
});

router.get('/permissions', requireAuth, requirePermission('role:manage'), async (req, res) => {
  try {
    const permissions = await getAllPermissions();
    return res.json({ data: permissions });
  } catch (err) {
    console.error('Get permissions error:', err);
    return res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

router.get('/roles/:id/permissions', requireAuth, requirePermission('role:manage'), async (req, res) => {
  try {
    const rolePermissions = await getRolePermissions(parseInt(req.params.id));
    return res.json({ data: rolePermissions });
  } catch (err) {
    console.error('Get role permissions error:', err);
    return res.status(500).json({ error: 'Failed to fetch role permissions' });
  }
});

router.post('/roles/:id/permissions', requireAuth, requirePermission('role:manage'), async (req, res) => {
  const { permissionId } = req.body;
  if (!permissionId) {
    return res.status(400).json({ error: 'Permission ID is required' });
  }
  try {
    await assignPermissionToRole(parseInt(req.params.id), parseInt(permissionId));
    return res.json({ message: 'Permission assigned to role' });
  } catch (err) {
    console.error('Assign permission error:', err);
    return res.status(500).json({ error: 'Failed to assign permission' });
  }
});

router.delete('/roles/:id/permissions/:permissionId', requireAuth, requirePermission('role:manage'), async (req, res) => {
  try {
    await removePermissionFromRole(parseInt(req.params.id), parseInt(req.params.permissionId));
    return res.json({ message: 'Permission removed from role' });
  } catch (err) {
    console.error('Remove permission error:', err);
    return res.status(500).json({ error: 'Failed to remove permission' });
  }
});

export default router;