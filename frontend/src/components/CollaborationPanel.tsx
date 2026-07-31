import React, { useState, useEffect } from 'react';

interface CollaborationPanelProps {
  documentId: number;
  API_URL: string;
}

const CollaborationPanel: React.FC<CollaborationPanelProps> = ({ documentId, API_URL }) => {
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [workflowStatus, setWorkflowStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string }>({ type: '', text: '' });
  const [showAddComment, setShowAddComment] = useState(false);

  const versioningUrl = API_URL.replace('/documents', '/versioning');

  useEffect(() => {
    fetchComments();
    fetchWorkflowStatus();
  }, [documentId]);

  const fetchComments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${versioningUrl}/documents/${documentId}/comments`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (response.ok) {
        const data = await response.json();
        setComments(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  };

  const fetchWorkflowStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${versioningUrl}/documents/${documentId}/workflow`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (response.ok) {
        const data = await response.json();
        setWorkflowStatus(data.data || { status: 'draft' });
      }
    } catch (error) {
      console.error('Failed to fetch workflow status:', error);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const token = localStorage.getItem('token');
    if (!token) {
      setMessage({ type: 'error', text: 'Authentication required to add comments' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch(`${versioningUrl}/documents/${documentId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ comment: newComment })
      });

      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'Comment added successfully' });
        setNewComment('');
        setShowAddComment(false);
        fetchComments();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to add comment' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setLoading(false);
    }
  };

  const handleWorkflowUpdate = async (status: string, notes = '') => {
    const token = localStorage.getItem('token');
    if (!token) {
      setMessage({ type: 'error', text: 'Authentication required' });
      return;
    }

    try {
      const response = await fetch(`${versioningUrl}/documents/${documentId}/workflow`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status, notes })
      });

      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: `Workflow status updated to ${status}` });
        fetchWorkflowStatus();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update workflow' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Connection error' });
    }
  };

  const workflowOptions = [
    { value: 'in_review', label: 'Submit for Review', color: '#ffc107' },
    { value: 'approved', label: 'Approve', color: '#28a745' },
    { value: 'rejected', label: 'Reject', color: '#dc3545' },
  ];

  return (
    <div style={{
      padding: '1.5rem',
      backgroundColor: 'white',
      borderRadius: '8px',
      border: '1px solid #ddd'
    }}>
      <h2 style={{ color: '#333', marginTop: '0' }}>Collaboration Panel (Doc: {documentId})</h2>

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

      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ color: '#333' }}>Workflow Status</h3>
        <div style={{
          padding: '0.75rem',
          backgroundColor: '#f9f9f9',
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          Current Status: <strong style={{
            color: workflowStatus?.status === 'approved' ? '#28a745' :
                   workflowStatus?.status === 'rejected' ? '#dc3545' :
                   workflowStatus?.status === 'in_review' ? '#ffc107' : '#6c757d'
          }}>{workflowStatus?.status || 'draft'}</strong>
          {workflowStatus?.reviewer_full_name && (
            <span style={{ marginLeft: '1rem', color: '#666', fontSize: '0.9rem' }}>
              Reviewed by: {workflowStatus.reviewer_full_name}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {workflowOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleWorkflowUpdate(opt.value)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: opt.color,
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ color: '#333', margin: 0 }}>Comments ({comments.length})</h3>
          <button
            onClick={() => setShowAddComment(!showAddComment)}
            style={{
              padding: '0.4rem 0.75rem',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            {showAddComment ? '✕ Cancel' : '+ Add Comment'}
          </button>
        </div>

        {showAddComment && (
          <form onSubmit={handleAddComment} style={{ marginBottom: '1.5rem' }}>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Enter your comment..."
              rows={3}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                marginBottom: '0.5rem'
              }}
              disabled={loading}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="submit"
                disabled={loading || !newComment.trim()}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {loading ? 'Posting...' : 'Post Comment'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddComment(false)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {comments.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {comments.map(comment => (
              <div key={comment.id} style={{
                padding: '0.75rem',
                backgroundColor: '#f9f9f9',
                borderRadius: '6px',
                borderLeft: '3px solid #007bff'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <strong style={{ color: '#333' }}>
                    {comment.username || 'Anonymous'}
                  </strong>
                  <span style={{ fontSize: '0.8rem', color: '#999' }}>
                    {new Date(comment.created_at).toLocaleString()}
                  </span>
                </div>
                <p style={{ margin: 0, color: '#555', whiteSpace: 'pre-wrap' }}>{comment.comment}</p>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#999' }}>No comments yet. Be the first to comment!</p>
        )}
      </div>
    </div>
  );
};

export default CollaborationPanel;