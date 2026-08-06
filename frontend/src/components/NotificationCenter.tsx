import React, { useState, useEffect } from 'react';

interface Notification {
  id: number;
  task_id: number;
  document_id: number;
  message: string;
  notification_type: string;
  is_read: boolean;
  metadata: any;
  created_at: string;
  task_title: string;
  document_name: string;
}

interface NotificationCenterProps {
  API_URL: string;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ API_URL }) => {
  const tasksUrl = API_URL.replace('/documents', '/tasks');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string }>({ type: '', text: '' });
  const [unreadCount, setUnreadCount] = useState(0);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${tasksUrl}/me/notifications`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.data || []);
        setUnreadCount(data.data.filter((n: Notification) => !n.is_read).length);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await fetch(`${tasksUrl}/me/notifications/unread/count`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count || 0);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  const handleMarkRead = async (id: number) => {
    try {
      const response = await fetch(`${tasksUrl}/me/notifications/${id}/read`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (response.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to mark notification:', error);
    }
  };

  const handleMarkAllRead = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${tasksUrl}/me/notifications/read`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
        setMessage({ type: 'success', text: 'All notifications marked as read' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to mark notifications' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (!notifications.find(n => n.id === id)?.is_read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task_assignment': return '📋';
      case 'task_completed': return '✅';
      case 'task_comment': return '💬';
      case 'workflow_approved': return '✅';
      case 'workflow_rejected': return '❌';
      default: return '🔔';
    }
  };

  const getNotificationTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      task_assignment: 'Task Assignment',
      task_completed: 'Task Completed',
      task_comment: 'New Comment',
      workflow_approved: 'Document Approved',
      workflow_rejected: 'Document Rejected',
      document_upload: 'Document Uploaded',
      version_restore: 'Version Restored'
    };
    return labels[type] || type.replace('_', ' ');
  };

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          {unreadCount > 0 ? (
            <span style={{ color: '#fd7e14', fontSize: '1.1rem', fontWeight: 500 }}>{unreadCount} unread</span>
          ) : (
            <span style={{ color: '#666', fontSize: '0.9rem' }}>All caught up!</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={loading}
              style={{
                padding: '0.4rem 0.75rem',
                backgroundColor: '#6f42c1',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              {loading ? 'Processing...' : 'Mark All Read'}
            </button>
          )}
          <button
            onClick={fetchNotifications}
            style={{
              padding: '0.4rem 0.75rem',
              backgroundColor: '#6c757d',
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

      {notifications.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {notifications.map(notification => (
            <div
              key={notification.id}
              style={{
                padding: '1rem',
                backgroundColor: notification.is_read ? '#ffffff' : '#f3e8fd',
                borderRadius: '6px',
                borderLeft: `3px solid ${notification.is_read ? '#ddd' : '#6f42c1'}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '1rem'
              }}
            >
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>{getNotificationIcon(notification.notification_type)}</span>
                <div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <strong style={{ color: '#333' }}>{getNotificationTypeLabel(notification.notification_type)}</strong>
                    <span style={{ fontSize: '0.75rem', color: '#999' }}>
                      {new Date(notification.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p style={{ margin: '0.25rem 0', color: '#555' }}>{notification.message}</p>
                  {notification.task_title && (
                    <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: '#666' }}>
                      Task: {notification.task_title}
                    </p>
                  )}
                  {notification.document_name && (
                    <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: '#666' }}>
                      Document: {notification.document_name}
                    </p>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                {!notification.is_read && (
                  <button
                    onClick={() => handleMarkRead(notification.id)}
                    style={{
                      padding: '0.2rem 0.5rem',
                      backgroundColor: '#6f42c1',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.75rem'
                    }}
                    title="Mark as read"
                  >
                    Read
                  </button>
                )}
                <button
                  onClick={() => handleDeleteNotification(notification.id)}
                  style={{
                    padding: '0.2rem 0.5rem',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.75rem'
                  }}
                  title="Dismiss"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          color: '#999',
          backgroundColor: '#ffffff',
          borderRadius: '8px'
        }}>
          <span style={{ fontSize: '2rem', marginBottom: '0.5rem', display: 'block' }}>🔔</span>
          No notifications
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;