import React, { useState, useEffect } from 'react';
import { getAuthHeaders } from '../utils/auth';

interface FileNumber {
  id: number;
  file_number: string;
  description?: string;
  folio_count?: number;
  document_count?: number;
}

interface ClassNode {
  id: number;
  name: string;
  description?: string;
  file_number_count?: number;
  document_count?: number;
  file_numbers: FileNumber[];
}

interface FolderTreeProps {
  API_URL: string;
  selectedFolderId: number | null;
  onSelectFolder: (folderId: number | null) => void;
}

const FolderTree: React.FC<FolderTreeProps> = ({ API_URL, selectedFolderId, onSelectFolder }) => {
  const [tree, setTree] = useState<ClassNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const foldersUrl = API_URL.replace('/documents', '/folders');

  const fetchTree = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${foldersUrl}/folders/classification-tree`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setTree(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch classification tree:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTree();
  }, []);

  const toggleExpand = (classId: number) => {
    setExpanded(prev => ({ ...prev, [classId]: !prev[classId] }));
  };

  return (
    <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: '#333' }}>Browse by File Number</h3>
        <button
          onClick={fetchTree}
          style={{
            padding: '0.3rem 0.6rem',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.8rem'
          }}
        >
          Refresh
        </button>
      </div>

      <div
        onClick={() => onSelectFolder(null)}
        style={{
          padding: '0.4rem 0.5rem',
          cursor: 'pointer',
          marginBottom: '0.5rem',
          backgroundColor: selectedFolderId === null ? '#e7f1ff' : 'transparent',
          borderRadius: '4px',
          fontSize: '0.9rem',
          color: selectedFolderId === null ? '#0056b3' : '#333'
        }}
      >
        🏠 All Documents
      </div>

      {loading && <p style={{ fontSize: '0.85rem', color: '#666' }}>Loading...</p>}
      {!loading && tree.length === 0 && (
        <p style={{ fontSize: '0.85rem', color: '#999' }}>No classification data available.</p>
      )}

      {tree.map(cls => {
        const isClassExpanded = expanded[cls.id];
        const classDocumentCount = cls.document_count || 0;

        return (
          <div key={cls.id} style={{ marginBottom: '0.25rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0.4rem 0.5rem',
              backgroundColor: selectedFolderId === null ? '#e7f1ff' : 'transparent',
              borderRadius: '4px',
              cursor: 'pointer'
            }}>
              <button
                onClick={(e) => { e.stopPropagation(); toggleExpand(cls.id); }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0 0.3rem',
                  fontSize: '0.75rem',
                  color: '#666'
                }}
              >
                {isClassExpanded ? '▼' : '▶'}
              </button>
              <span
                onClick={() => onSelectFolder(null)}
                style={{ flex: 1, fontSize: '0.9rem', color: '#333', fontWeight: 500 }}
              >
                📂 {cls.name}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#888', marginRight: '0.5rem' }}>
                {classDocumentCount} doc{classDocumentCount !== 1 ? 's' : ''}
              </span>
            </div>

            {isClassExpanded && cls.file_numbers.length > 0 && (
              <div style={{ marginLeft: '1.2rem' }}>
                {cls.file_numbers.map(fn => {
                  const fnDocCount = fn.document_count || 0;
                  const isSelected = selectedFolderId === fn.id;

                  return (
                    <div
                      key={fn.id}
                      onClick={() => onSelectFolder(fn.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.35rem 0.5rem',
                        backgroundColor: isSelected ? '#d1e7dd' : 'transparent',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        marginTop: '0.15rem'
                      }}
                    >
                      <span style={{ width: '1rem', display: 'inline-block' }}></span>
                      <span style={{ flex: 1, fontSize: '0.85rem', color: isSelected ? '#0f5132' : '#333' }}>
                        📁 {fn.file_number}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#888', marginRight: '0.5rem' }}>
                        {fnDocCount} doc{fnDocCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {isClassExpanded && cls.file_numbers.length === 0 && (
              <p style={{ marginLeft: '1.2rem', fontSize: '0.8rem', color: '#999', padding: '0.25rem 0' }}>
                No file numbers
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default FolderTree;
