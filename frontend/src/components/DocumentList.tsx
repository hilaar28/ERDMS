import React from 'react';
import { getFriendlyTypeName } from '../utils/format';

interface Document {
  id: number;
  name: string;
  original_filename?: string;
  file_size?: number;
  mime_type?: string;
  created_at: string;
  class?: string;
  file_number?: string;
  folio_number?: string;
}

interface DocumentListProps {
  documents: Document[];
  onAction?: (documentId: number, action: 'history' | 'collab') => void;
  onOpen?: (documentId: number) => void;
  showType?: boolean;
}

const DocumentList: React.FC<DocumentListProps> = ({ documents, onAction, onOpen, showType = true }) => {
  return (
    <div>
      <h2>Registered Documents</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
        <thead>
          <tr style={{ backgroundColor: '#f8fafc' }}>
            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>ID</th>
            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Name</th>
            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Original File</th>
            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Size</th>
            {showType && (
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Type</th>
            )}
             <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Created</th>
             <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Class</th>
             <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>File No.</th>
             <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Folio No.</th>
             {onAction && (
                <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Actions</th>
              )}
              {onOpen && (
                <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '2px solid #ddd' }}>View</th>
              )}
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.75rem' }}>{doc.id}</td>
              <td style={{ padding: '0.75rem', fontWeight: 500 }}>{doc.name}</td>
              <td style={{ padding: '0.75rem' }}>{doc.original_filename || 'N/A'}</td>
              <td style={{ padding: '0.75rem' }}>{doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : 'N/A'}</td>
              {showType && (
                <td style={{ padding: '0.75rem' }}>{getFriendlyTypeName(doc.mime_type)}</td>
              )}
              <td style={{ padding: '0.75rem' }}>{new Date(doc.created_at).toLocaleString()}</td>
              <td style={{ padding: '0.75rem' }}>{doc.class || 'N/A'}</td>
              <td style={{ padding: '0.75rem' }}>{doc.file_number || 'N/A'}</td>
              <td style={{ padding: '0.75rem' }}>{doc.folio_number || 'N/A'}</td>
              {onAction && (
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  <button
                    onClick={() => onAction(doc.id, 'history')}
                    style={{
                      padding: '0.3rem 0.6rem',
                      marginRight: '0.3rem',
                      backgroundColor: '#6f42c1',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                    title="View version history & audit log"
                  >
                    History
                  </button>
                  <button
                    onClick={() => onAction(doc.id, 'collab')}
                    style={{
                      padding: '0.3rem 0.6rem',
                      backgroundColor: '#17a2b8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                    title="View comments & workflow"
                  >
                    Collaborate
                  </button>
                </td>
              )}
              {onOpen && (
                <td style={{ padding: '0.75rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button
                      onClick={() => onOpen(doc.id)}
                      style={{
                        padding: '0.3rem 0.6rem',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                      title="Open document"
                    >
                      Open
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {documents.length === 0 && <p style={{ textAlign: 'center', color: '#666', marginTop: '2rem' }}>No documents registered yet</p>}
      </div>
  );
};

export default DocumentList;