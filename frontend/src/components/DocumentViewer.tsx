import React, { useState, useEffect } from 'react';
import { getFriendlyTypeName } from '../utils/format';

interface DocumentViewerProps {
  documentId: number;
  API_URL: string;
  onClose: () => void;
}

interface Document {
  id: number;
  name: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  department: string;
  province: string;
  created_at: string;
  bucketUrl: string;
}

interface Comment {
  id: number;
  comment: string;
  username: string;
  full_name: string;
  created_at: string;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ documentId, API_URL, onClose }) => {
  const [document, setDocument] = useState<Document | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string }>({ type: '', text: '' });

  const versioningUrl = API_URL.replace('/documents', '/versioning');

  useEffect(() => {
    fetchDocument();
    fetchComments();
  }, [documentId]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const fetchDocument = async () => {
    try {
      const response = await fetch(`${API_URL}/documents/${documentId}`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setDocument(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch document:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await fetch(`${versioningUrl}/documents/${documentId}/comments`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setComments(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch(`${versioningUrl}/documents/${documentId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ comment: newComment })
      });

      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'Comment added successfully' });
        setNewComment('');
        fetchComments();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to add comment' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewDocument = () => {
    if (document?.bucketUrl) {
      window.open(document.bucketUrl, '_blank');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        Loading document...
      </div>
    );
  }

  if (!document) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Document not found</p>
        <button onClick={onClose} style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}>Close</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ color: '#333', margin: 0 }}>{document.name}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#999' }}>✕</button>
      </div>

      <div style={{ padding: '1rem', backgroundColor: '#ffffff', borderRadius: '8px', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <strong>File:</strong> {document.original_filename}
          </div>
          <div>
            <strong>Size:</strong> {document.file_size ? `${(document.file_size / 1024).toFixed(1)} KB` : 'N/A'}
          </div>
          <div>
            <strong>Type:</strong> {getFriendlyTypeName(document.mime_type)}
          </div>
          <div>
            <strong>Department:</strong> {document.department || 'N/A'}
          </div>
          <div>
            <strong>Province:</strong> {document.province || 'N/A'}
          </div>
          <div>
            <strong>Created:</strong> {new Date(document.created_at).toLocaleString()}
          </div>
        </div>
        <button
          onClick={handleViewDocument}
          style={{
            padding: '0.6rem 1.2rem',
            backgroundColor: '#6f42c1',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          Open Document
        </button>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ color: '#333', marginBottom: '1rem' }}>Comments</h3>
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

        <form onSubmit={handleAddComment} style={{ marginBottom: '1.5rem' }}>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            rows={3}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              marginBottom: '0.5rem'
            }}
            disabled={submitting}
          />
          <button
            type="submit"
            disabled={submitting || !newComment.trim()}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#fd7e14',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {submitting ? 'Posting...' : 'Post Comment'}
          </button>
        </form>

        {comments.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {comments.map(comment => (
              <div key={comment.id} style={{
                padding: '0.75rem',
                backgroundColor: '#ffffff',
                borderRadius: '6px',
                borderLeft: '3px solid #6f42c1'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <strong style={{ color: '#333' }}>
                    {comment.full_name || comment.username}
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
          <p style={{ color: '#999', textAlign: 'center', padding: '1rem' }}>No comments yet. Be the first to comment!</p>
        )}
      </div>

      <div style={{ textAlign: 'center' }}>
        <button
          onClick={onClose}
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
  );
};

export default DocumentViewer;
