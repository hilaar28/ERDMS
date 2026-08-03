import React, { useState, useEffect } from 'react';
import DocumentList from './DocumentList';

interface DocumentRegistrationProps {
  API_URL: string;
}

const DocumentRegistration: React.FC<DocumentRegistrationProps> = ({ API_URL }) => {
  const [newDocName, setNewDocName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [department, setDepartment] = useState('');
  const [province, setProvince] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string }>({ type: '', text: '' });
  const [documents, setDocuments] = useState<any[]>([]);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`${API_URL}/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.data || []);
      }
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : 'Failed to fetch documents';
      setMessage({ type: 'error', text });
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newDocName.trim()) {
      setMessage({ type: 'error', text: 'Please enter a document name' });
      return;
    }

    if (!selectedFile) {
      setMessage({ type: 'error', text: 'Please select a file to upload' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const formData = new FormData();
      formData.append('document', selectedFile);
      formData.append('documentMetadata', JSON.stringify({
        name: newDocName.trim(),
        department: department.trim(),
        province: province.trim()
      }));

      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData
      });

      let responseBody: any = null;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        responseBody = await response.json();
      }

      if (!response.ok) {
        const errorMsg = responseBody?.error || responseBody?.message || `HTTP ${response.status}: Registration failed`;
        throw new Error(errorMsg);
      }

      setMessage({ type: 'success', text: 'Document registered successfully!' });
      setNewDocName('');
      setSelectedFile(null);
      setDepartment('');
      setProvince('');
      fetchDocuments();
    } catch (error: unknown) {
      let text: string;
      if (error instanceof Error) {
        text = error.message;
      } else if (typeof error === 'string') {
        text = error;
      } else {
        text = 'Registration failed - please check your connection and try again';
      }
      setMessage({ type: 'error', text });
      console.error('Document registration error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="documentName" style={{ display: 'block', marginBottom: '0.5rem' }}>
              Document Name
            </label>
            <input
              id="documentName"
              type="text"
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              placeholder="Enter document name"
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
              disabled={loading}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="fileUpload" style={{ display: 'block', marginBottom: '0.5rem' }}>
              Document File
            </label>
            <input
              id="fileUpload"
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setSelectedFile(e.target.files[0]);
                }
              }}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
            {selectedFile && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
              </div>
            )}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="department" style={{ display: 'block', marginBottom: '0.5rem' }}>
              Department
            </label>
            <select
              id="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
              disabled={loading}
            >
              <option value="">-- Select Department --</option>
              <option value="Finance">Finance</option>
              <option value="Legal">Legal</option>
              <option value="Gender Equality">Gender Equality</option>
              <option value="General">General</option>
            </select>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="province" style={{ display: 'block', marginBottom: '0.5rem' }}>
              Province
            </label>
            <input
              id="province"
              type="text"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              placeholder="Enter province"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !newDocName.trim() || !selectedFile}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: loading ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading || !newDocName.trim() || !selectedFile ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Uploading...' : 'Register Document'}
          </button>
        </form>

        {message.text && (
          <div style={{
            padding: '1rem',
            borderRadius: '4px',
            marginTop: '1rem',
            backgroundColor: message.type === 'error' ? '#f8d7da' : '#d4edda',
            color: message.type === 'error' ? '#721c24' : '#155724'
          }}>
            {message.text}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ color: '#333', margin: 0 }}>Documents</h2>
        <button
          onClick={fetchDocuments}
          style={{
            padding: '0.4rem 0.75rem',
            backgroundColor: '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.85rem'
          }}
        >
          Refresh
        </button>
      </div>
      <DocumentList documents={documents} />
    </div>
  );
};

export default DocumentRegistration;