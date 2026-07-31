import React, { useState, useEffect } from 'react';

interface CmsModuleProps {
  API_URL: string;
}

const CmsModule: React.FC<CmsModuleProps> = ({ API_URL }) => {
  const [caseId, setCaseId] = useState('');
  const [caseData, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string }>({ type: '', text: '' });
  const [documentName, setDocumentName] = useState('');
  const [linkedDocuments, setLinkedDocuments] = useState<any[]>([]);

  const fetchCase = async () => {
    if (!caseId.trim()) return;

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch(`${API_URL.replace('/documents', '/index')}/search?q=${encodeURIComponent(caseId)}`);
      if (response.ok) {
        const data = await response.json();
        setCaseData(data.data?.[0] || null);
        setLinkedDocuments([]);
        setMessage({ type: 'success', text: 'Case retrieved successfully' });
      } else {
        setMessage({ type: 'error', text: 'Case not found' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to retrieve case' });
    } finally {
      setLoading(false);
    }
  };

  const fetchCaseDocuments = async () => {
    if (!caseId.trim()) return;

    try {
      const response = await fetch(`${API_URL.replace('/documents', '/cms')}/cases/${caseId}/documents`);
      if (response.ok) {
        const data = await response.json();
        setLinkedDocuments(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch case documents:', error);
    }
  };

  const handleSyncDocuments = async () => {
    if (!caseId.trim()) {
      setMessage({ type: 'error', text: 'Please enter a case ID' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch(`${API_URL.replace('/documents', '/cms')}/cases/${caseId}/sync`, {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        setMessage({ type: 'success', text: `Synced ${data.synced || 0} documents` });
        fetchCaseDocuments();
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Sync failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Connection error - please check your CMS configuration' });
    } finally {
      setLoading(false);
    }
  };

  const handleLinkDocument = async () => {
    if (!caseId.trim() || !documentName.trim()) {
      setMessage({ type: 'error', text: 'Please enter both case ID and document name' });
      return;
    }

    try {
      const response = await fetch(`${API_URL.replace('/documents', '/cms')}/cases/${caseId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentName })
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Document linked successfully' });
        setDocumentName('');
        fetchCaseDocuments();
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Linking failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Connection error' });
    }
  };

  useEffect(() => {
    if (caseId) {
      fetchCaseDocuments();
    }
  }, [caseId]);

  return (
    <div>
      <h1 style={{ color: '#333' }}>Legal CMS Integration</h1>

      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ color: '#333' }}>Get Case</h3>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="text"
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
            placeholder="Enter Case ID"
            style={{
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              flex: 1
            }}
          />
          <button
            onClick={fetchCase}
            disabled={loading || !caseId.trim()}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {loading ? 'Loading...' : 'Fetch'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleSyncDocuments}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Sync Documents
          </button>
        </div>
      </div>

      {caseData && (
        <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
          <h3 style={{ color: '#333' }}>Case Details: {caseId || caseData.id}</h3>
          <pre style={{ backgroundColor: '#f0f0f0', padding: '1rem', borderRadius: '4px', overflowX: 'auto' }}>
            {JSON.stringify(caseData, null, 2)}
          </pre>
        </div>
      )}

      {linkedDocuments.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ color: '#333' }}>Linked Documents</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>ID</th>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Name</th>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {linkedDocuments.map(doc => (
                <tr key={doc.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.5rem' }}>{doc.id}</td>
                  <td style={{ padding: '0.5rem' }}>{doc.name}</td>
                  <td style={{ padding: '0.5rem' }}>{new Date(doc.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ color: '#333' }}>Link Document to Case</h3>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="text"
            value={documentName}
            onChange={(e) => setDocumentName(e.target.value)}
            placeholder="Enter document name"
            style={{
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              flex: 1
            }}
          />
          <button
            onClick={handleLinkDocument}
            disabled={!caseId.trim() || !documentName.trim()}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Link
          </button>
        </div>
      </div>

      {message.text && (
        <div style={{
          padding: '1rem',
          borderRadius: '4px',
          backgroundColor: message.type === 'error' ? '#f8d7da' : '#d4edda',
          color: message.type === 'error' ? '#721c24' : '#155724'
        }}>
          {message.text}
        </div>
      )}
    </div>
  );
};

export default CmsModule;