import React, { useState, useEffect } from 'react';

interface VersionHistoryProps {
  documentId: number;
  API_URL: string;
  onClose?: () => void;
}

const VersionHistory: React.FC<VersionHistoryProps> = ({ documentId, API_URL, onClose }) => {
  const [versions, setVersions] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string }>({ type: '', text: '' });

  useEffect(() => {
    fetchVersions();
    fetchAuditLog();
  }, [documentId]);

  const fetchVersions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL.replace('/documents', '/versioning')}/documents/${documentId}/versions`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (response.ok) {
        const data = await response.json();
        setVersions(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch versions:', error);
    }
  };

  const fetchAuditLog = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL.replace('/documents', '/versioning')}/documents/${documentId}/audit-log`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (response.ok) {
        const data = await response.json();
        setAuditLog(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch audit log:', error);
    }
  };

  const handleRestore = async (versionNumber: number) => {
    const token = localStorage.getItem('token');
    if (!token) {
      setMessage({ type: 'error', text: 'Authentication required to restore versions' });
      return;
    }

    if (!window.confirm(`Restore document to version ${versionNumber}?`)) return;

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch(
        `${API_URL.replace('/documents', '/versioning')}/documents/${documentId}/versions/${versionNumber}/restore`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: data.message || 'Version restored successfully!' });
        fetchVersions();
        fetchAuditLog();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to restore version' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      padding: '1.5rem',
      backgroundColor: 'white',
      borderRadius: '8px',
      border: '1px solid #ddd'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ color: '#333', margin: 0 }}>Document History (ID: {documentId})</h2>
        {onClose && (
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#999' }}
          >
            ✕
          </button>
        )}
      </div>

      {message.text && (
        <div style={{
          padding: '0.75rem',
          borderRadius: '4px',
          marginBottom: '1rem',
          backgroundColor: message.type === 'error' ? '#f8d7da' : '#d4edda',
          color: message.type === 'error' ? '#721c24' : '#155724'
        }}>
          {message.text}
        </div>
      )}

      <h3 style={{ color: '#333' }}>Version History</h3>
      {versions.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Version</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Name</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>File</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Size</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Created By</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Created At</th>
              <th style={{ padding: '0.5rem', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem' }}>{v.version_number}</td>
                <td style={{ padding: '0.5rem' }}>{v.name}</td>
                <td style={{ padding: '0.5rem' }}>{v.original_filename || 'N/A'}</td>
                <td style={{ padding: '0.5rem' }}>{v.file_size ? `${Math.round(v.file_size / 1024)} KB` : 'N/A'}</td>
                <td style={{ padding: '0.5rem' }}>{v.created_by_username || v.created_by_full_name || 'System'}</td>
                <td style={{ padding: '0.5rem' }}>{new Date(v.created_at).toLocaleString()}</td>
                <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                  <button
                    onClick={() => handleRestore(v.version_number)}
                    disabled={loading || v.version_number === versions[0]?.version_number}
                    style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >
                    Restore
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ color: '#999', marginBottom: '2rem' }}>No versions available</p>
      )}

      <h3 style={{ color: '#333' }}>Audit Log</h3>
      {auditLog.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Action</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>User</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {auditLog.map((log) => (
              <tr key={log.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem' }}>{log.action}</td>
                <td style={{ padding: '0.5rem' }}>{log.username || 'System'}</td>
                <td style={{ padding: '0.5rem' }}>{new Date(log.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ color: '#999' }}>No audit entries available</p>
      )}
    </div>
  );
};

export default VersionHistory;