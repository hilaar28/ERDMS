import React, { useState, useEffect } from 'react';
import DocumentList from './DocumentList';
import DocumentRegistration from './DocumentRegistration';
import AuthModule from './AuthModule';
import IndexingModule from './IndexingModule';
import CmsModule from './CmsModule';
import VersionHistory from './VersionHistory';
import CollaborationPanel from './CollaborationPanel';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/documents';

const Dashboard: React.FC = () => {
  const [activeModule, setActiveModule] = useState('dashboard');
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string }>({ type: '', text: '' });
  const [user, setUser] = useState<any>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [modalMode, setModalMode] = useState<'history' | 'collab' | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setUser({ token });
    }
  }, []);

  useEffect(() => {
    if (activeModule === 'documents') {
      fetchDocuments();
    }
  }, [activeModule]);

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

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const handleDocumentAction = (documentId: number, action: 'history' | 'collab') => {
    setSelectedDocumentId(documentId);
    setModalMode(action);
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedDocumentId(null);
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'documents', label: 'Document Registration', icon: '📄' },
    { id: 'versioning', label: 'Version Control', icon: '🔖' },
    { id: 'indexing', label: 'Search & Index', icon: '🔍' },
    { id: 'cms', label: 'Legal CMS', icon: '🏛️' },
    { id: 'auth', label: 'User Management', icon: '👥' },
  ];

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return (
          <div>
            <h1 style={{ color: '#333', marginBottom: '1.5rem' }}>Welcome to ERDMS</h1>
            <p style={{ color: '#666', marginBottom: '2rem' }}>
              Electronic Records &amp; Document Management System
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
              {menuItems.filter(item => item.id !== 'dashboard').map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveModule(item.id)}
                  style={{
                    padding: '1.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    backgroundColor: '#f9f9f9',
                    cursor: 'pointer',
                    textAlign: 'center',
                    fontSize: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <span style={{ fontSize: '2rem' }}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        );
      case 'documents':
        return (
          <DocumentRegistration API_URL={API_URL} />
        );
      case 'versioning':
        return (
          <div>
            <h1 style={{ color: '#333', marginBottom: '1.5rem' }}>Document Versioning &amp; History</h1>
            <p style={{ color: '#666', marginBottom: '1rem' }}>
              View version history and audit logs for all documents.
            </p>
            {documents.length > 0 ? (
              <DocumentList documents={documents} onAction={handleDocumentAction} />
            ) : (
              <div style={{ padding: '1rem', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
                No documents found. Register documents first in the Document Registration module.
              </div>
            )}
          </div>
        );
      case 'indexing':
        return <IndexingModule API_URL={API_URL} />;
      case 'cms':
        return <CmsModule API_URL={API_URL} />;
      case 'auth':
        return <AuthModule API_URL={API_URL} />;
      default:
        return null;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <div style={{
        width: '250px',
        backgroundColor: '#2c3e50',
        color: 'white',
        padding: '1rem',
        position: 'fixed',
        height: '100vh',
        overflowY: 'auto'
      }}>
        <h2 style={{ padding: '0.5rem', borderBottom: '1px solid #34495e' }}>ERDMS Menu</h2>
        <nav style={{ marginTop: '1rem' }}>
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveModule(item.id)}
              style={{
                display: 'block',
                width: '100%',
                padding: '0.75rem',
                margin: '0.25rem 0',
                backgroundColor: activeModule === item.id ? '#3498db' : 'transparent',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '0.9rem'
              }}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>
        {user && (
          <div style={{ marginTop: '2rem', padding: '0.5rem', borderTop: '1px solid #34495e' }}>
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Logout
            </button>
          </div>
        )}
      </div>

      <div style={{
        marginLeft: '250px',
        padding: '2rem',
        width: '100%',
        maxWidth: '1200px'
      }}>
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

        {activeModule !== 'documents' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>{menuItems.find(i => i.id === activeModule)?.label || ''}</h2>
            {activeModule === 'documents' && (
              <button
                onClick={() => fetchDocuments()}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#17a2b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Refresh
              </button>
            )}
          </div>
        )}

        {renderModule()}

        {modalMode && selectedDocumentId && (
          <div style={{
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: '9999'
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              maxWidth: '80vw',
              maxHeight: '80vh',
              overflow: 'auto',
              margin: '1rem'
            }}>
              {modalMode === 'history' && (
                <VersionHistory
                  documentId={selectedDocumentId}
                  API_URL={API_URL}
                  onClose={closeModal}
                />
              )}
              {modalMode === 'collab' && (
                <CollaborationPanel
                  documentId={selectedDocumentId}
                  API_URL={API_URL}
                />
              )}
              <div style={{ padding: '1rem', textAlign: 'center' }}>
                <button
                  onClick={closeModal}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;