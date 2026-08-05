import React, { useState, useEffect, useRef } from 'react';
import DocumentList from './DocumentList';
import DocumentRegistration from './DocumentRegistration';
import AuthModule from './AuthModule';
import IndexingModule from './IndexingModule';
import CmsModule from './CmsModule';
import VersionHistory from './VersionHistory';
import CollaborationPanel from './CollaborationPanel';
import RetentionModule from './RetentionModule';
import AuditTrail from './AuditTrail';
import TaskAssignment from './TaskAssignment';
import NotificationCenter from './NotificationCenter';
import DocumentViewer from './DocumentViewer';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/documents';

const Dashboard: React.FC<{ onLogout?: () => void }> = ({ onLogout }) => {
  const [activeModule, setActiveModule] = useState('dashboard');
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string }>({ type: '', text: '' });
  const [user, setUser] = useState<any>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [modalMode, setModalMode] = useState<'history' | 'collab' | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationDropdown, setNotificationDropdown] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState<any[]>([]);
  const [viewingDocumentId, setViewingDocumentId] = useState<number | null>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setNotificationDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setUser({ token });
    }
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await fetch(`${API_URL.replace('/documents', '/tasks')}/me/notifications/unread/count`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count || 0);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  const fetchRecentNotifications = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await fetch(`${API_URL.replace('/documents', '/tasks')}/me/notifications?limit=5&unread=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setRecentNotifications(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const handleMarkAllRead = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      await fetch(`${API_URL.replace('/documents', '/tasks')}/me/notifications/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setRecentNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all read:', error);
    }
  };

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
    if (onLogout) onLogout();
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
    { id: 'retention', label: 'Retention & Disposal', icon: '🗑️' },
    { id: 'audit', label: 'Immutable Audit Trail', icon: '🔐' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'tasks', label: 'Task Management', icon: '📋' },
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
      case 'retention':
        return <RetentionModule API_URL={API_URL} />;
      case 'audit':
        return <AuditTrail API_URL={API_URL} />;
      case 'notifications':
        return <NotificationCenter API_URL={API_URL} />;
      case 'tasks':
        return <TaskAssignment API_URL={API_URL} />;
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
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.5rem',
          borderBottom: '1px solid #34495e',
          marginBottom: '1rem'
        }}>
          <img
            src="/logo.jpg"
            alt="Logo"
            style={{ width: '40px', height: '40px', objectFit: 'contain' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <h2 style={{ padding: 0, borderBottom: 'none', margin: 0 }}>ERDMS</h2>
        </div>
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
              {item.id === 'notifications' && unreadCount > 0 && (
                <span style={{
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  borderRadius: '50%',
                  padding: '0.15rem 0.5rem',
                  fontSize: '0.75rem',
                  marginLeft: '0.5rem'
                }}>
                  {unreadCount}
                </span>
              )}
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
        <div style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          zIndex: '1000'
        }}>
          <div ref={notificationRef} style={{ position: 'relative', display: 'inline-block' }}>
            <button
              onClick={() => { setNotificationDropdown(!notificationDropdown); fetchRecentNotifications(); }}
              style={{
                position: 'relative',
                padding: '0.5rem 0.75rem',
                backgroundColor: '#2c3e50',
                color: 'white',
                border: 'none',
                borderRadius: '50px',
                cursor: 'pointer',
                fontSize: '1.1rem'
              }}
              title="Notifications"
            >
              🔔
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  borderRadius: '50%',
                  padding: '0.1px 6px',
                  fontSize: '0.7rem',
                  minWidth: '18px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {notificationDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: '0',
                width: '320px',
                maxHeight: '400px',
                backgroundColor: 'white',
                border: '1px solid #ddd',
                borderRadius: '8px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
                zIndex: '1001',
                overflow: 'hidden'
              }}>
                <div style={{
                  padding: '0.5rem 1rem',
                  borderBottom: '1px solid #eee',
                  backgroundColor: '#f5f5f5',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#333' }}>Notifications</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      style={{
                        padding: '0.2rem 0.5rem',
                        backgroundColor: 'transparent',
                        color: '#007bff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                    >
                      Mark All Read
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  {recentNotifications.length > 0 ? (
                    recentNotifications.map(notif => (
                      <div
                        key={notif.id}
                        onClick={() => {
                          if (notif.document_id) {
                            setViewingDocumentId(notif.document_id);
                            setNotificationDropdown(false);
                          }
                        }}
                        style={{
                          padding: '0.75rem',
                          borderBottom: '1px solid #eee',
                          backgroundColor: notif.is_read ? 'white' : '#e3f2fd',
                          cursor: notif.document_id ? 'pointer' : 'default'
                        }}
                      >
                        <div style={{ fontSize: '0.8rem', color: '#555', marginBottom: '0.25rem' }}>
                          {notif.message}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#999' }}>
                          {new Date(notif.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '1rem', textAlign: 'center', color: '#999', fontSize: '0.85rem' }}>
                      No new notifications
                    </div>
                  )}
                </div>

                {recentNotifications.length > 0 && (
                  <div style={{ padding: '0.5rem', textAlign: 'center', borderTop: '1px solid #eee' }}>
                    <button
                      onClick={() => { setNotificationDropdown(false); setActiveModule('notifications'); }}
                      style={{
                        padding: '0.3rem 0.75rem',
                        backgroundColor: 'transparent',
                        color: '#007bff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                    >
                      View All
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
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

        {viewingDocumentId && (
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
              width: '90vw',
              maxWidth: '900px',
              maxHeight: '85vh',
              overflow: 'auto',
              margin: '1rem'
            }}>
              <DocumentViewer
                documentId={viewingDocumentId}
                API_URL={API_URL}
                onClose={() => setViewingDocumentId(null)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;