import React, { useState, useEffect } from 'react';

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

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

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
                backgroundColor: activeTab === tab.id ? '#007bff' : 'transparent',
                color: activeTab === tab.id ? 'white' : '#666',
                border: 'none',
                borderBottom: activeTab === tab.id ? '3px solid #007bff' : 'none',
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
                  backgroundColor: '#28a745',
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
              <tr style={{ backgroundColor: '#f5f5f5' }}>
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
                          backgroundColor: '#007bff',
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
          <h3 style={{ color: '#333' }}>Role Definitions</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>ID</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Role Name</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Description</th>
              </tr>
            </thead>
            <tbody>
              {roles.map(role => (
                <tr key={role.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.75rem' }}>{role.id}</td>
                  <td style={{ padding: '0.75rem', fontWeight: 500 }}>{role.name}</td>
                  <td style={{ padding: '0.75rem' }}>{role.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AuthModule;