import React from 'react';

interface Document {
  id: number;
  name: string;
  original_filename?: string;
  file_size?: number;
  mime_type?: string;
  created_at: string;
}

interface DocumentListProps {
  documents: Document[];
}

const DocumentList: React.FC<DocumentListProps> = ({ documents }) => {
  return (
    <div>
      <h2>Registered Documents</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5' }}>
            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>ID</th>
            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Name</th>
            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Original File</th>
            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Size</th>
            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Type</th>
            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Created</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.75rem' }}>{doc.id}</td>
              <td style={{ padding: '0.75rem', fontWeight: 500 }}>{doc.name}</td>
              <td style={{ padding: '0.75rem' }}>{doc.original_filename || 'N/A'}</td>
              <td style={{ padding: '0.75rem' }}>{doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : 'N/A'}</td>
              <td style={{ padding: '0.75rem' }}>{doc.mime_type || 'N/A'}</td>
              <td style={{ padding: '0.75rem' }}>{new Date(doc.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {documents.length === 0 && <p style={{ textAlign: 'center', color: '#666', marginTop: '2rem' }}>No documents registered yet</p>}
    </div>
  );
};

export default DocumentList;