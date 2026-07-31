import jwt from 'jsonwebtoken';
import { getUserById, getUserPermissionsAndRoles, getSession } from '../models/rbac.js';

const JWT_SECRET = process.env.JWT_SECRET || 'erdms-dev-secret-key-change-in-production';

export function generateToken(user) {
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
      decoded = jwt.verify(token, JWT_SECRET);
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

export { JWT_SECRET };