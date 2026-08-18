import React, { useState, useEffect } from 'react';
import { getAuthHeaders } from '../utils/auth';

interface ClassItem {
  id: number;
  name: string;
  description?: string;
}

interface FileNumberItem {
  id: number;
  file_number: string;
  description?: string;
}

interface FolioNumberItem {
  id: number;
  folio_number: string;
  description?: string;
}

const ClassificationManagement: React.FC<{ API_URL: string }> = ({ API_URL }) => {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [fileNumbers, setFileNumbers] = useState<FileNumberItem[]>([]);
  const [selectedFileNumberId, setSelectedFileNumberId] = useState<number | null>(null);
  const [folioNumbers, setFolioNumbers] = useState<FolioNumberItem[]>([]);

  const [newClassName, setNewClassName] = useState('');
  const [newClassDescription, setNewClassDescription] = useState('');
  const [newFileNumber, setNewFileNumber] = useState('');
  const [newFileNumberDescription, setNewFileNumberDescription] = useState('');
  const [newFolioNumber, setNewFolioNumber] = useState('');
  const [newFolioNumberDescription, setNewFolioNumberDescription] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string }>({ type: '', text: '' });

  const fetchClasses = async () => {
    try {
      const response = await fetch(`${API_URL.replace('/documents', '/classification')}/classes`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setClasses(data.value || data);
      }
    } catch (error) {
      console.error('Failed to fetch classes:', error);
    }
  };

  const fetchFileNumbers = async (classId: number) => {
    try {
      const response = await fetch(`${API_URL.replace('/documents', '/classification')}/classes/${classId}/file-numbers`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setFileNumbers(data.value || data);
      }
    } catch (error) {
      console.error('Failed to fetch file numbers:', error);
    }
  };

  const fetchFolioNumbers = async (fileNumberId: number) => {
    try {
      const response = await fetch(`${API_URL.replace('/documents', '/classification')}/file-numbers/${fileNumberId}/folio-numbers`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setFolioNumbers(data.value || data);
      }
    } catch (error) {
      console.error('Failed to fetch folio numbers:', error);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, [API_URL]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await fetch(`${API_URL.replace('/documents', '/classification')}/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ name: newClassName.trim(), description: newClassDescription.trim() })
      });
      const data = await response.json();
      if (response.ok) {
        setClasses([...classes, data]);
        setNewClassName('');
        setNewClassDescription('');
        setMessage({ type: 'success', text: 'Class created successfully' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to create class' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFileNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileNumber.trim() || !selectedClassId) return;
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await fetch(`${API_URL.replace('/documents', '/classification')}/classes/${selectedClassId}/file-numbers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ fileNumber: newFileNumber.trim(), description: newFileNumberDescription.trim() })
      });
      const data = await response.json();
      if (response.ok) {
        setFileNumbers([...fileNumbers, data]);
        setNewFileNumber('');
        setNewFileNumberDescription('');
        setMessage({ type: 'success', text: 'File number created successfully' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to create file number' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolioNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolioNumber.trim() || !selectedFileNumberId) return;
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await fetch(`${API_URL.replace('/documents', '/classification')}/file-numbers/${selectedFileNumberId}/folio-numbers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ folioNumber: newFolioNumber.trim(), description: newFolioNumberDescription.trim() })
      });
      const data = await response.json();
      if (response.ok) {
        setFolioNumbers([...folioNumbers, data]);
        setNewFolioNumber('');
        setNewFolioNumberDescription('');
        setMessage({ type: 'success', text: 'Folio number created successfully' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to create folio number' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectClass = (classItem: ClassItem) => {
    setSelectedClassId(classItem.id);
    setSelectedFileNumberId(null);
    setFolioNumbers([]);
    fetchFileNumbers(classItem.id);
  };

  const handleSelectFileNumber = (fileNumber: FileNumberItem) => {
    setSelectedFileNumberId(fileNumber.id);
    setFolioNumbers([]);
    fetchFolioNumbers(fileNumber.id);
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ color: '#333', marginBottom: '1.5rem' }}>Classification Management</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Manage document classes, file numbers, and folio numbers.
      </p>

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        <div style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #ddd' }}>
          <h2 style={{ color: '#333', marginBottom: '1rem' }}>Classes</h2>
          <form onSubmit={handleCreateClass} style={{ marginBottom: '1rem' }}>
            <input
              type="text"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="New class name"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                marginBottom: '0.5rem'
              }}
            />
            <input
              type="text"
              value={newClassDescription}
              onChange={(e) => setNewClassDescription(e.target.value)}
              placeholder="Description (optional)"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                marginBottom: '0.5rem'
              }}
            />
            <button
              type="submit"
              disabled={loading || !newClassName.trim()}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: loading || !newClassName.trim() ? '#ccc' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading || !newClassName.trim() ? 'not-allowed' : 'pointer'
              }}
            >
              Create Class
            </button>
          </form>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {classes.map((cls) => (
              <div
                key={cls.id}
                onClick={() => handleSelectClass(cls)}
                style={{
                  padding: '0.75rem',
                  marginBottom: '0.5rem',
                  backgroundColor: selectedClassId === cls.id ? '#e9ecef' : '#f8fafc',
                  border: `1px solid ${selectedClassId === cls.id ? '#6f42c1' : '#ddd'}`,
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontWeight: 500 }}>{cls.name}</div>
                {cls.description && <div style={{ fontSize: '0.85rem', color: '#666' }}>{cls.description}</div>}
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #ddd' }}>
          <h2 style={{ color: '#333', marginBottom: '1rem' }}>File Numbers</h2>
          {selectedClassId ? (
            <form onSubmit={handleCreateFileNumber} style={{ marginBottom: '1rem' }}>
              <input
                type="text"
                value={newFileNumber}
                onChange={(e) => setNewFileNumber(e.target.value)}
                placeholder="New file number"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  marginBottom: '0.5rem'
                }}
              />
              <input
                type="text"
                value={newFileNumberDescription}
                onChange={(e) => setNewFileNumberDescription(e.target.value)}
                placeholder="Description (optional)"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  marginBottom: '0.5rem'
                }}
              />
              <button
                type="submit"
                disabled={loading || !newFileNumber.trim()}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: loading || !newFileNumber.trim() ? '#ccc' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading || !newFileNumber.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                Create File Number
              </button>
            </form>
          ) : (
            <p style={{ color: '#999', fontStyle: 'italic' }}>Select a class first</p>
          )}
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {fileNumbers.map((fn) => (
              <div
                key={fn.id}
                onClick={() => handleSelectFileNumber(fn)}
                style={{
                  padding: '0.75rem',
                  marginBottom: '0.5rem',
                  backgroundColor: selectedFileNumberId === fn.id ? '#e9ecef' : '#f8fafc',
                  border: `1px solid ${selectedFileNumberId === fn.id ? '#6f42c1' : '#ddd'}`,
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontWeight: 500 }}>{fn.file_number}</div>
                {fn.description && <div style={{ fontSize: '0.85rem', color: '#666' }}>{fn.description}</div>}
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #ddd' }}>
          <h2 style={{ color: '#333', marginBottom: '1rem' }}>Folio Numbers</h2>
          {selectedFileNumberId ? (
            <form onSubmit={handleCreateFolioNumber} style={{ marginBottom: '1rem' }}>
              <input
                type="text"
                value={newFolioNumber}
                onChange={(e) => setNewFolioNumber(e.target.value)}
                placeholder="New folio number"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  marginBottom: '0.5rem'
                }}
              />
              <input
                type="text"
                value={newFolioNumberDescription}
                onChange={(e) => setNewFolioNumberDescription(e.target.value)}
                placeholder="Description (optional)"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  marginBottom: '0.5rem'
                }}
              />
              <button
                type="submit"
                disabled={loading || !newFolioNumber.trim()}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: loading || !newFolioNumber.trim() ? '#ccc' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading || !newFolioNumber.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                Create Folio Number
              </button>
            </form>
          ) : (
            <p style={{ color: '#999', fontStyle: 'italic' }}>Select a file number first</p>
          )}
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {folioNumbers.map((folio) => (
              <div
                key={folio.id}
                style={{
                  padding: '0.75rem',
                  marginBottom: '0.5rem',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              >
                <div style={{ fontWeight: 500 }}>{folio.folio_number}</div>
                {folio.description && <div style={{ fontSize: '0.85rem', color: '#666' }}>{folio.description}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassificationManagement;
