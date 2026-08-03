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
  cleanupSessions
} from '../models/rbac.js';
import { generateToken, requireAuth, requirePermission, requireRole, JWT_SECRET } from '../middleware/auth.js';

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

export default router;