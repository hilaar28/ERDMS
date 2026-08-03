import React, { useState, useEffect } from 'react';

interface RetentionModuleProps {
  API_URL: string;
}

interface RetentionPolicy {
  id: number;
  name: string;
  description: string;
  document_type: string;
  department: string;
  retention_period: string;
  disposal_action: string;
  is_active: boolean;
  requires_approval: boolean;
  created_by_username: string;
  created_at: string;
  updated_at: string;
}

interface DisposalItem {
  id: number;
  document_id: number;
  name: string;
  original_filename: string;
  policy_name: string;
  disposal_action: string;
  dispose_at: string;
  days_remaining: number;
}

const RetentionModule: React.FC<RetentionModuleProps> = ({ API_URL }) => {
  const versioningUrl = API_URL.replace('/documents', '/retention');

  const [activeTab, setActiveTab] = useState<'policies' | 'schedule' | 'disposal'>('policies');
  const [policies, setPolicies] = useState<RetentionPolicy[]>([]);
  const [schedule, setSchedule] = useState<DisposalItem[]>([]);
  const [dueForDisposal, setDueForDisposal] = useState<DisposalItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string }>({ type: '', text: '' });

  const [policyForm, setPolicyForm] = useState({
    name: '',
    description: '',
    documentType: '',
    department: '',
    retentionPeriod: '180 days',
    requiresApproval: false
  });

  useEffect(() => {
    fetchPolicies();
    fetchSchedule();
    fetchDueForDisposal();
  }, []);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const fetchPolicies = async () => {
    try {
      const response = await fetch(`${versioningUrl}/policies`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setPolicies(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch policies:', error);
    }
  };

  const fetchSchedule = async () => {
    try {
      const response = await fetch(`${versioningUrl}/schedule`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setSchedule(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch schedule:', error);
    }
  };

  const fetchDueForDisposal = async () => {
    try {
      const response = await fetch(`${versioningUrl}/disposal/due`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setDueForDisposal(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch due disposals:', error);
    }
  };

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch(`${versioningUrl}/policies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          name: policyForm.name,
          description: policyForm.description,
          documentType: policyForm.documentType,
          department: policyForm.department,
          retentionPeriod: policyForm.retentionPeriod,
          requiresApproval: policyForm.requiresApproval
        })
      });

      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'Policy created successfully' });
        setPolicyForm({
          name: '', description: '', documentType: '', department: '',
          retentionPeriod: '180 days', requiresApproval: false
        });
        fetchPolicies();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to create policy' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePolicy = async (policy: RetentionPolicy) => {
    try {
      await fetch(`${versioningUrl}/policies/${policy.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ is_active: !policy.is_active })
      });
      fetchPolicies();
    } catch (error) {
      console.error('Failed to toggle policy:', error);
    }
  };

  const handleDisposal = async (documentId: number, reason: string) => {
    if (!window.confirm(`Permanently dispose document ${documentId}? This action cannot be undone.`)) return;

    try {
      const response = await fetch(`${versioningUrl}/disposal/${documentId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ reason })
      });

      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: data.message || 'Document disposed successfully' });
        fetchSchedule();
        fetchDueForDisposal();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to dispose document' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Connection error' });
    }
  };

  const tabs = [
    { id: 'policies', label: 'Retention Policies', icon: '📜' },
    { id: 'schedule', label: 'Retention Schedule', icon: '📅' },
    { id: 'disposal', label: 'Pending Disposals', icon: '🗑️' },
  ];

  return (
    <div>
      <h1 style={{ color: '#333' }}>Retention &amp; Disposal</h1>

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

      {activeTab === 'policies' && (
        <div>
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ color: '#333' }}>Create Retention Policy</h3>
            <form onSubmit={handleCreatePolicy}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem' }}>Policy Name*</label>
                  <input
                    type="text"
                    value={policyForm.name}
                    onChange={(e) => setPolicyForm({...policyForm, name: e.target.value})}
                    required
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem' }}>Document Type</label>
                  <input
                    type="text"
                    value={policyForm.documentType}
                    onChange={(e) => setPolicyForm({...policyForm, documentType: e.target.value})}
                    placeholder="e.g. contract, memo, report"
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem' }}>Department</label>
                  <input
                    type="text"
                    value={policyForm.department}
                    onChange={(e) => setPolicyForm({...policyForm, department: e.target.value})}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem' }}>Retention Period*</label>
                  <select
                    value={policyForm.retentionPeriod}
                    onChange={(e) => setPolicyForm({...policyForm, retentionPeriod: e.target.value})}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                  >
                    <option value="30 days">30 days</option>
                    <option value="90 days">90 days</option>
                    <option value="180 days">180 days</option>
                    <option value="1 years">1 year</option>
                    <option value="3 years">3 years</option>
                    <option value="5 years">5 years</option>
                    <option value="7 years">7 years</option>
                    <option value="10 years">10 years</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem' }}>Description</label>
                  <textarea
                    value={policyForm.description}
                    onChange={(e) => setPolicyForm({...policyForm, description: e.target.value})}
                    placeholder="Policy description"
                    rows={2}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={policyForm.requiresApproval}
                      onChange={(e) => setPolicyForm({...policyForm, requiresApproval: e.target.checked})}
                    />
                    Requires Approval
                  </label>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: '1rem',
                  padding: '0.6rem 1.5rem',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {loading ? 'Creating...' : 'Create Policy'}
              </button>
            </form>
          </div>

          <h3 style={{ color: '#333' }}>Existing Policies</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>ID</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Name</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Type</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Department</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Retention</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Active</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Approval</th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {policies.map(policy => (
                <tr key={policy.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.75rem' }}>{policy.id}</td>
                  <td style={{ padding: '0.75rem' }}>{policy.name}</td>
                  <td style={{ padding: '0.75rem' }}>{policy.document_type || 'Any'}</td>
                  <td style={{ padding: '0.75rem' }}>{policy.department || 'Any'}</td>
                  <td style={{ padding: '0.75rem' }}>{policy.retention_period}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{ color: policy.is_active ? '#28a745' : '#dc3545' }}>
                      {policy.is_active ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem' }}>{policy.requires_approval ? 'Yes' : 'No'}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <button
                      onClick={() => handleTogglePolicy(policy)}
                      style={{
                        padding: '0.25rem 0.6rem',
                        backgroundColor: policy.is_active ? '#dc3545' : '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                    >
                      {policy.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'schedule' && (
        <div>
          <h3 style={{ color: '#333' }}>Retention Schedule</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Document</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>ID</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Policy</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Dispose At</th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Days Left</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.75rem' }}>{item.name}</td>
                  <td style={{ padding: '0.75rem' }}>{item.id}</td>
                  <td style={{ padding: '0.75rem' }}>{item.policy_name}</td>
                  <td style={{ padding: '0.75rem' }}>{new Date(item.dispose_at).toLocaleDateString()}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <span style={{
                      color: item.days_remaining <= 30 ? '#dc3545' :
                             item.days_remaining <= 90 ? '#ffc107' : '#28a745'
                    }}>
                      {item.days_remaining}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {schedule.length === 0 && <p style={{ color: '#999' }}>No documents with retention policies found</p>}
        </div>
      )}

      {activeTab === 'disposal' && (
        <div>
          <h3 style={{ color: '#333', marginBottom: '1rem' }}>Documents Due for Disposal</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Document</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>ID</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Policy</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Due Date</th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {dueForDisposal.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.75rem' }}>{item.name}</td>
                  <td style={{ padding: '0.75rem' }}>{item.document_id}</td>
                  <td style={{ padding: '0.75rem' }}>{item.policy_name}</td>
                  <td style={{ padding: '0.75rem' }}>{new Date(item.dispose_at).toLocaleDateString()}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <button
                      onClick={() => handleDisposal(item.document_id, 'Retention period expired')}
                      style={{
                        padding: '0.3rem 0.8rem',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                    >
                      Dispose
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {dueForDisposal.length === 0 && <p style={{ color: '#999' }}>No documents are currently due for disposal</p>}
        </div>
      )}
    </div>
  );
};

export default RetentionModule;