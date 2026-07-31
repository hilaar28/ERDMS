import React, { useState, useEffect } from 'react';

interface AuthModuleProps {
  API_URL: string;
}

const AuthModule: React.FC<AuthModuleProps> = ({ API_URL }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [message, setMessage] = useState<{ type: string; text: string }>({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [token, setToken] = useState('');

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
      fetchUsers(savedToken);
    }
  }, []);

  const fetchUsers = async (authToken: string) => {
    try {
      const response = await fetch(`${API_URL.replace('/documents', '/auth')}/users`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    const endpoint = activeTab === 'login' ? 'login' : 'register';
    const payload = activeTab === 'login'
      ? { username, password }
      : { username, email, full_name: fullName, password };

    try {
      const response = await fetch(`${API_URL.replace('/documents', '/auth')}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (response.ok) {
        if (activeTab === 'login' && data.token) {
          localStorage.setItem('token', data.token);
          setToken(data.token);
          setMessage({ type: 'success', text: `Logged in as ${data.user?.username || 'User'}` });
          fetchUsers(data.token);
        } else {
          setMessage({ type: 'success', text: data.message || 'Operation successful' });
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Operation failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Connection error - please check your server' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 style={{ color: '#333' }}>User Management</h1>
      <div style={{ marginBottom: '1rem' }}>
        <button
          onClick={() => setActiveTab('login')}
          style={{
            padding: '0.5rem 1rem',
            marginRight: '0.5rem',
            backgroundColor: activeTab === 'login' ? '#007bff' : '#f0f0f0',
            color: activeTab === 'login' ? 'white' : '#333',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Login
        </button>
        <button
          onClick={() => setActiveTab('register')}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: activeTab === 'register' ? '#007bff' : '#f0f0f0',
            color: activeTab === 'register' ? 'white' : '#333',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Register
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ marginBottom: '2rem', maxWidth: '400px' }}>
        {activeTab === 'register' && (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}
                required
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}
                required
              />
            </div>
          </>
        )}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}
            required
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: loading ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Processing...' : activeTab === 'login' ? 'Login' : 'Register'}
        </button>
      </form>

      {message.text && (
        <div style={{
          padding: '1rem',
          borderRadius: '4px',
          marginBottom: '1rem',
          backgroundColor: message.type === 'error' ? '#f8d7da' : '#d4edda',
          color: message.type === 'error' ? '#721c24' : '#155724'
        }}>
          {message.text}
        </div>
      )}

      {token && users.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ color: '#333' }}>Registered Users</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>ID</th>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Username</th>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Email</th>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Full Name</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.5rem' }}>{user.id}</td>
                  <td style={{ padding: '0.5rem' }}>{user.username}</td>
                  <td style={{ padding: '0.5rem' }}>{user.email}</td>
                  <td style={{ padding: '0.5rem' }}>{user.full_name}</td>
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