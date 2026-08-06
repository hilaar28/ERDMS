import React, { useState, useEffect } from 'react';
import { getAuthHeaders, getRefreshToken } from '../utils/auth';

interface AuthModuleProps {
  API_URL: string;
}

interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
}

interface Role {
  id: number;
  name: string;
  description: string;
}

interface Permission {
  id: number;
  name: string;
  description: string;
}

const AuthModule: React.FC<AuthModuleProps> = ({ API_URL }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [userRoles, setUserRoles] = useState<Record<number, Role[]>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string }>({ type: '', text: '' });
  const authUrl = API_URL.replace('/documents', '/auth');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roleForm, setRoleForm] = useState({ name: '', description: '' });
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [expandedRoleId, setExpandedRoleId] = useState<number | null>(null);
  const [rolePermissionsMap, setRolePermissionsMap] = useState<Record<number, Permission[]>>({});

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${authUrl}/users`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await fetch(`${authUrl}/roles`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setRoles(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    }
  };

  const fetchUserRoles = async (userId: number) => {
    try {
      const response = await fetch(`${authUrl}/users/${userId}/roles`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setUserRoles(prev => ({ ...prev, [userId]: data.data || [] }));
      }
    } catch (error) {
      console.error('Failed to fetch user roles:', error);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await fetch(`${authUrl}/permissions`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setPermissions(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
    }
  };

  const fetchRolePermissions = async (roleId: number) => {
    try {
      const response = await fetch(`${authUrl}/roles/${roleId}/permissions`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setRolePermissionsMap(prev => ({ ...prev, [roleId]: data.data || [] }));
      }
    } catch (error) {
      console.error('Failed to fetch role permissions:', error);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleForm.name.trim()) {
      setMessage({ type: 'error', text: 'Role name is required' });
      return;
    }
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await fetch(`${authUrl}/roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(roleForm)
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'Role created successfully' });
        setRoleForm({ name: '', description: '' });
        fetchRoles();
        fetchPermissions();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to create role' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleForm.name.trim() || editingRoleId === null) return;
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await fetch(`${authUrl}/roles/${editingRoleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(roleForm)
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'Role updated successfully' });
        setRoleForm({ name: '', description: '' });
        setEditingRoleId(null);
        fetchRoles();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update role' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRole = async (roleId: number) => {
    if (!window.confirm('Delete this role? Users with this role will lose it.')) return;
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await fetch(`${authUrl}/roles/${roleId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'Role deleted successfully' });
        if (expandedRoleId === roleId) setExpandedRoleId(null);
        fetchRoles();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to delete role' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignPermission = async (roleId: number, permissionId: number) => {
    setLoading(true);
    try {
      const response = await fetch(`${authUrl}/roles/${roleId}/permissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ permissionId })
      });
      if (response.ok) {
        fetchRolePermissions(roleId);
      }
    } catch (error) {
      console.error('Failed to assign permission:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePermission = async (roleId: number, permissionId: number) => {
    setLoading(true);
    try {
      const response = await fetch(`${authUrl}/roles/${roleId}/permissions/${permissionId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (response.ok) {
        fetchRolePermissions(roleId);
      }
    } catch (error) {
      console.error('Failed to remove permission:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditRole = (role: Role) => {
    setEditingRoleId(role.id);
    setRoleForm({ name: role.name, description: role.description || '' });
  };

  const handleCancelEdit = () => {
    setEditingRoleId(null);
    setRoleForm({ name: '', description: '' });
  };

  const toggleExpandRole = async (roleId: number) => {
    if (expandedRoleId === roleId) {
      setExpandedRoleId(null);
    } else {
      setExpandedRoleId(roleId);
      if (!rolePermissionsMap[roleId]) {
        await fetchRolePermissions(roleId);
      }
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const handleAssignRole = async () => {
    if (!selectedUserId || !selectedRoleId) {
      setMessage({ type: 'error', text: 'Please select both user and role' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch(`${authUrl}/users/${selectedUserId}/roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ roleId: parseInt(selectedRoleId) })
      });

      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'Role assigned successfully' });
        fetchUserRoles(selectedUserId);
        fetchUsers();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to assign role' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setLoading(false);
      setSelectedUserId(null);
      setSelectedRoleId('');
    }
  };

  const handleRemoveRole = async (userId: number, roleId: number) => {
    try {
      const response = await fetch(`${authUrl}/users/${userId}/roles/${roleId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'Role removed successfully' });
        fetchUserRoles(userId);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to remove role' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Connection error' });
    }
  };

  const tabs = [
    { id: 'users', label: 'Users & Roles', icon: '👥' },
    { id: 'roles', label: 'Role Definitions', icon: '🔐' },
  ];

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #ddd' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: activeTab === tab.id ? '#6f42c1' : 'transparent',
                color: activeTab === tab.id ? 'white' : '#666',
                border: 'none',
                borderBottom: activeTab === tab.id ? '3px solid #6f42c1' : 'none',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {message.text && (
        <div style={{
          padding: '0.75rem',
          borderRadius: '4px',
          marginBottom: '1.5rem',
          backgroundColor: message.type === 'error' ? '#f8d7da' : '#d4edda',
          color: message.type === 'error' ? '#721c24' : '#155724'
        }}>
          {message.text}
        </div>
      )}

      {activeTab === 'users' && (
        <div>
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ color: '#333' }}>Assign Role to User</h3>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>User</label>
                <select
                  value={selectedUserId || ''}
                  onChange={(e) => setSelectedUserId(parseInt(e.target.value) || null)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="">Select User</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.full_name || user.username}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>Role</label>
                <select
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="">Select Role</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAssignRole}
                disabled={loading || !selectedUserId || !selectedRoleId}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#fd7e14',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginBottom: '0.5rem'
                }}
              >
                {loading ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>

          <h3 style={{ color: '#333' }}>User List</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>ID</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Full Name</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Username</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Email</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Roles</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Created</th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => {
                const userRoleList = userRoles[user.id] || [];
                return (
                  <tr key={user.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.75rem' }}>{user.id}</td>
                    <td style={{ padding: '0.75rem' }}>{user.full_name || '-'}</td>
                    <td style={{ padding: '0.75rem' }}>{user.username}</td>
                    <td style={{ padding: '0.75rem' }}>{user.email}</td>
                    <td style={{ padding: '0.75rem' }}>
                      {userRoleList.length > 0
                        ? userRoleList.map(r => r.name).join(', ')
                        : <span style={{ color: '#999' }}>No roles</span>}
                    </td>
                    <td style={{ padding: '0.75rem' }}>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <button
                        onClick={() => {
                          if (userRoles[user.id]) {
                            setUserRoles(prev => ({ ...prev, [user.id]: [] }));
                          } else {
                            fetchUserRoles(user.id);
                          }
                        }}
                        style={{
                          padding: '0.3rem 0.6rem',
                          backgroundColor: '#6f42c1',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.8rem'
                        }}
                      >
                        {userRoles[user.id] ? 'Hide Roles' : 'Show Roles'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {users.length === 0 && <p style={{ color: '#999', textAlign: 'center', marginTop: '2rem' }}>No users found</p>}
        </div>
      )}

      {activeTab === 'roles' && (
        <div>
          <h3 style={{ color: '#333', marginBottom: '1rem' }}>Role Definitions</h3>

          <form onSubmit={editingRoleId ? handleUpdateRole : handleCreateRole} style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#fafafa' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', color: '#555' }}>{editingRoleId ? 'Edit Role' : 'Create New Role'}</h4>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: 500 }}>Role Name</label>
                <input
                  type="text"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter role name"
                  required
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              <div style={{ flex: 2 }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: 500 }}>Description</label>
                <input
                  type="text"
                  value={roleForm.description}
                  onChange={(e) => setRoleForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter role description"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: editingRoleId ? '#6f42c1' : '#fd7e14',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Saving...' : editingRoleId ? 'Update Role' : 'Create Role'}
              </button>
              {editingRoleId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>ID</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Role Name</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Description</th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map(role => {
                const isExpanded = expandedRoleId === role.id;
                const rolePerms = rolePermissionsMap[role.id] || [];
                return (
                  <React.Fragment key={role.id}>
                    <tr style={{ borderBottom: '1px solid #eee', backgroundColor: isExpanded ? '#f3e8fd' : 'transparent' }}>
                      <td style={{ padding: '0.75rem' }}>{role.id}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 500 }}>
                        <button
                          onClick={() => toggleExpandRole(role.id)}
                          style={{ background: 'none', border: 'none', color: '#6f42c1', cursor: 'pointer', padding: 0, fontWeight: 500, fontSize: 'inherit' }}
                        >
                          {role.name} {isExpanded ? '▲' : '▼'}
                        </button>
                      </td>
                      <td style={{ padding: '0.75rem' }}>{role.description}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => handleEditRole(role)}
                          style={{
                            padding: '0.3rem 0.6rem',
                            marginRight: '0.3rem',
                            backgroundColor: '#6f42c1',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteRole(role.id)}
                          disabled={loading}
                          style={{
                            padding: '0.3rem 0.6rem',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ borderBottom: '1px solid #ddd', backgroundColor: '#fafafa' }}>
                        <td colSpan={4} style={{ padding: '1rem' }}>
                          <h4 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>Permissions</h4>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            {permissions.map(permission => {
                              const assigned = rolePerms.some(p => p.id === permission.id);
                              return (
                                <button
                                  key={permission.id}
                                  onClick={() => assigned ? handleRemovePermission(role.id, permission.id) : handleAssignPermission(role.id, permission.id)}
                                  style={{
                                    padding: '0.35rem 0.75rem',
                                    border: '1px solid #ddd',
                                    borderRadius: '20px',
                                    backgroundColor: assigned ? '#6f42c1' : 'white',
                                    color: assigned ? 'white' : '#333',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem'
                                  }}
                                >
                                  {permission.name}
                                </button>
                              );
                            })}
                          </div>
                          <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>
                            {rolePerms.length === 0 ? 'No permissions assigned.' : `${rolePerms.length} permission(s) assigned.`}
                          </p>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {roles.length === 0 && <p style={{ color: '#999', textAlign: 'center', marginTop: '2rem' }}>No roles defined</p>}
        </div>
      )}
    </div>
  );
};

export default AuthModule;