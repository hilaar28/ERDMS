import jwt from 'jsonwebtoken';
import { getUserById, getUserPermissionsAndRoles, getSession } from '../models/rbac.js';
import fs from 'fs/promises';
import path from 'path';

let JWT_SECRET = null;
let JWT_SECRET_PREVIOUS = null;
let JWT_SECRET_LOADED_AT = null;

function generateEntropyBytes(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{}|;:,.<>?';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function loadJwtSecret() {
  const secretFile = process.env.JWT_SECRET_FILE || '/run/secrets/jwt_secret';

  if (process.env.JWT_SECRET) {
    const secret = process.env.JWT_SECRET.trim();
    if (secret.length < 32) {
      throw new Error('JWT_SECRET is too short. Must be at least 32 characters for security.');
    }
    return secret;
  }

  try {
    const fileContent = await fs.readFile(secretFile, 'utf8');
    const secret = fileContent.trim();
    if (secret.length < 32) {
      throw new Error(`JWT secret from file ${secretFile} is too short. Must be at least 32 characters.`);
    }
    return secret;
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(
        `JWT_SECRET environment variable or secret file ${secretFile} is required. ` +
        'Set JWT_SECRET or mount a Docker secret at /run/secrets/jwt_secret.'
      );
    }
    throw err;
  }
}

export async function initializeJwtSecret() {
  if (JWT_SECRET) {
    return;
  }

  JWT_SECRET = await loadJwtSecret();
  JWT_SECRET_LOADED_AT = new Date().toISOString();

  console.log('JWT secret loaded successfully');
}

export function getJwtSecret() {
  if (!JWT_SECRET) {
    throw new Error('JWT secret not initialized. Call initializeJwtSecret() first.');
  }
  return JWT_SECRET;
}

export function getPreviousJwtSecret() {
  return JWT_SECRET_PREVIOUS;
}

export function rotateJwtSecret(newSecret) {
  if (!newSecret || newSecret.length < 32) {
    throw new Error('New JWT secret must be at least 32 characters');
  }

  JWT_SECRET_PREVIOUS = JWT_SECRET;
  JWT_SECRET = newSecret;
  JWT_SECRET_LOADED_AT = new Date().toISOString();

  console.log('JWT secret rotated successfully');
}

export function verifyToken(token) {
  if (!JWT_SECRET) {
    throw new Error('JWT secret not initialized');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    if (JWT_SECRET_PREVIOUS) {
      try {
        decoded = jwt.verify(token, JWT_SECRET_PREVIOUS);
      } catch (prevErr) {
        throw err;
      }
    } else {
      throw err;
    }
  }
  return decoded;
}

export function generateToken(user) {
  if (!JWT_SECRET) {
    throw new Error('JWT secret not initialized. Cannot generate token.');
  }
  return jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization header missing or invalid' });
    }

    const token = authHeader.substring(7);
    let decoded;

    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await getUserById(decoded.userId);
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

export function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { permissions } = await getUserPermissionsAndRoles(user.id);
      const hasPermission = permissions.some(p => p.name === permission);

      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    } catch (err) {
      console.error('Permission check error:', err);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

export function requireRole(roleName) {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { roles } = await getUserPermissionsAndRoles(user.id);
      const hasRole = roles.some(r => r.name === roleName);

      if (!hasRole) {
        return res.status(403).json({ error: 'Insufficient role privileges' });
      }

      next();
    } catch (err) {
      console.error('Role check error:', err);
      return res.status(500).json({ error: 'Role check failed' });
    }
  };
}
