import React, { useState, useEffect } from 'react';

interface AuditTrailProps {
  API_URL: string;
}

interface AuditEntry {
  id: number;
  document_id: number;
  user_id: number;
  action: string;
  resource_type: string;
  resource_id: number;
  old_values: any;
  new_values: any;
  ip_address: string;
  user_agent: string;
  created_at: string;
  previous_hash: string;
  record_hash: string;
  username: string;
  full_name: string;
  document_name: string;
  original_filename: string;
}

const AuditTrail: React.FC<AuditTrailProps> = ({ API_URL }) => {
  const auditUrl = API_URL.replace('/documents', '/audit');

  const [activeTab, setActiveTab] = useState<'all' | 'verify' | 'stats'>('all');
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [integrityResult, setIntegrityResult] = useState<any>(null);
  const [stats, setStats] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string }>({ type: '', text: '' });

  const [filters, setFilters] = useState({
    action: '',
    userId: '',
    documentId: '',
    dateFrom: '',
    dateTo: '',
    resourceType: ''
  });

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.action) params.append('action', filters.action);
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.documentId) params.append('documentId', filters.documentId);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.resourceType) params.append('resourceType', filters.resourceType);

      const response = await fetch(`${auditUrl}?${params.toString()}`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setEntries(data.data || []);
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to fetch audit trail' });
    } finally {
      setLoading(false);
    }
  };

  const fetchIntegrity = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${auditUrl}/integrity/verify`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setIntegrityResult(data);
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to verify integrity' });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${auditUrl}/stats`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setStats(data.data || []);
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to fetch stats' });
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    const params = new URLSearchParams();
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.append('dateTo', filters.dateTo);

    try {
      const response = await fetch(`${auditUrl}/summary?${params.toString()}`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setSummary(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    }
  };

  useEffect(() => {
    fetchEntries();
    fetchStats();
    fetchSummary();
  }, []);

  const tabs = [
    { id: 'all', label: 'All Entries', icon: '📋' },
    { id: 'verify', label: 'Integrity Verification', icon: '🔐' },
    { id: 'stats', label: 'Statistics', icon: '📊' },
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

      {activeTab === 'all' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>Action</label>
              <input
                type="text"
                value={filters.action}
                onChange={(e) => setFilters({...filters, action: e.target.value})}
                placeholder="e.g. document_upload"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>Document ID</label>
              <input
                type="number"
                value={filters.documentId}
                onChange={(e) => setFilters({...filters, documentId: e.target.value})}
                placeholder="Doc ID"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>From Date</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>To Date</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
          </div>
          <button
            onClick={() => { fetchEntries(); fetchSummary(); }}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#6f42c1',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginBottom: '1rem'
            }}
          >
            Apply Filters
          </button>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>ID</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Action</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Document</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>User</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>IP Address</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Timestamp</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Record Hash</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.5rem' }}>{entry.id}</td>
                    <td style={{ padding: '0.5rem' }}>{entry.action}</td>
                    <td style={{ padding: '0.5rem' }}>{entry.document_name || entry.document_id || 'N/A'}</td>
                    <td style={{ padding: '0.5rem' }}>{entry.full_name || entry.username || 'System'}</td>
                    <td style={{ padding: '0.5rem' }}>{entry.ip_address || 'N/A'}</td>
                    <td style={{ padding: '0.5rem' }}>{new Date(entry.created_at).toLocaleString()}</td>
                    <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {entry.record_hash?.substring(0, 16)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {entries.length === 0 && <p style={{ color: '#999', textAlign: 'center', marginTop: '2rem' }}>No audit entries found</p>}
          </div>
        </div>
      )}

      {activeTab === 'verify' && (
        <div>
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ color: '#333' }}>Hash Chain Integrity Verification</h3>
            <p style={{ color: '#666' }}>
              Each audit entry is cryptographically linked to the previous one using SHA-256 hashes.
              Any modification to a record will break the chain and be immediately detected.
            </p>
          </div>

          <button
            onClick={fetchIntegrity}
            disabled={loading}
            style={{
              padding: '0.6rem 1.2rem',
              backgroundColor: '#6f42c1',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginBottom: '1.5rem'
            }}
          >
            {loading ? 'Verifying...' : 'Verify Integrity'}
          </button>

          {integrityResult && (
            <div style={{
              padding: '1.5rem',
              backgroundColor: integrityResult.is_integrity_valid ? '#d4edda' : '#f8d7da',
              borderRadius: '8px',
              border: `2px solid ${integrityResult.is_integrity_valid ? '#fd7e14' : '#dc3545'}`
            }}>
              <h3 style={{ marginTop: '0', color: integrityResult.is_integrity_valid ? '#155724' : '#721c24' }}>
                {integrityResult.is_integrity_valid ? '✓ Integrity Verified' : '✗ Integrity Compromised'}
              </h3>
              <p><strong>Total Records:</strong> {integrityResult.total_records}</p>
              <p><strong>Issues Found:</strong> {integrityResult.issues?.length || 0}</p>
              {integrityResult.issues && integrityResult.issues.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <h4>Issues:</h4>
                  {integrityResult.issues.map((issue: any, i: number) => (
                    <div key={i} style={{
                      padding: '0.5rem',
                      backgroundColor: 'rgba(0,0,0,0.05)',
                      borderRadius: '4px',
                      marginBottom: '0.5rem',
                      fontFamily: 'monospace',
                      fontSize: '0.8rem'
                    }}>
                      <strong>Record ID:</strong> {issue.id} |
                      <strong> Issue:</strong> {issue.issue} |
                      <strong> Expected:</strong> {issue.expected?.substring(0, 20)}... |
                      <strong> Actual:</strong> {issue.actual?.substring(0, 20)}...
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'stats' && (
        <div>
          {summary && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#e9ecef',
              borderRadius: '8px',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{ marginTop: '0', color: '#333' }}>Audit Summary</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                <div>
                  <strong style={{ fontSize: '1.5rem' }}>{summary.total_entries}</strong>
                  <p style={{ color: '#666', fontSize: '0.85rem', margin: 0 }}>Total Entries</p>
                </div>
                <div>
                  <strong style={{ fontSize: '1.5rem' }}>{summary.unique_users}</strong>
                  <p style={{ color: '#666', fontSize: '0.85rem', margin: 0 }}>Unique Users</p>
                </div>
                <div>
                  <strong style={{ fontSize: '1.5rem' }}>{summary.unique_documents}</strong>
                  <p style={{ color: '#666', fontSize: '0.85rem', margin: 0 }}>Documents Audited</p>
                </div>
              </div>
              {summary.earliest_entry && (
                <p style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  Earliest: {new Date(summary.earliest_entry).toLocaleString()} |
                  Latest: {new Date(summary.latest_entry).toLocaleString()}
                </p>
              )}
            </div>
          )}

          <h3 style={{ color: '#333' }}>Action Statistics</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Action</th>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Count</th>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Users</th>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Documents</th>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>First</th>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Last</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((stat, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.5rem' }}>{stat.action}</td>
                  <td style={{ padding: '0.5rem' }}>{stat.count}</td>
                  <td style={{ padding: '0.5rem' }}>{stat.unique_users}</td>
                  <td style={{ padding: '0.5rem' }}>{stat.unique_documents}</td>
                  <td style={{ padding: '0.5rem' }}>{new Date(stat.first_action).toLocaleDateString()}</td>
                  <td style={{ padding: '0.5rem' }}>{new Date(stat.last_action).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AuditTrail;