import React, { useState, useEffect } from 'react';

interface IndexingModuleProps {
  API_URL: string;
}

const IndexingModule: React.FC<IndexingModuleProps> = ({ API_URL }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [tagQuery, setTagQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string }>({ type: '', text: '' });
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`${API_URL}/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL.replace('/documents', '/index')}/search?q=${encodeURIComponent(searchQuery)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.data || []);
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Search failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleTagSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagQuery.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL.replace('/documents', '/index')}/search/tags?q=${encodeURIComponent(tagQuery)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.data || []);
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Tag search failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = async (docId: number) => {
    if (!newTag.trim()) return;

    try {
      const response = await fetch(`${API_URL.replace('/documents', '/index')}/tags/${docId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: newTag })
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Tag added successfully' });
        setNewTag('');
        fetchDocuments();
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to add tag' });
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ color: '#333' }}>Full-Text Search</h3>
        <form onSubmit={handleSearch} style={{ marginBottom: '1rem' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            style={{
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              width: '300px',
              marginRight: '0.5rem'
            }}
          />
          <button
            type="submit"
            disabled={loading || !searchQuery.trim()}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#6f42c1',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ color: '#333' }}>Tag Search</h3>
        <form onSubmit={handleTagSearch} style={{ marginBottom: '1rem' }}>
          <input
            type="text"
            value={tagQuery}
            onChange={(e) => setTagQuery(e.target.value)}
            placeholder="Search by tags..."
            style={{
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              width: '300px',
              marginRight: '0.5rem'
            }}
          />
          <button
            type="submit"
            disabled={loading || !tagQuery.trim()}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#6f42c1',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Search Tags
          </button>
        </form>
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

      {searchResults.length > 0 ? (
        <div>
          <h3 style={{ color: '#333' }}>Search Results</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Name</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Department</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Province</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {searchResults.map(doc => (
                <tr key={doc.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.75rem' }}>{doc.name}</td>
                  <td style={{ padding: '0.75rem' }}>{doc.department || 'N/A'}</td>
                  <td style={{ padding: '0.75rem' }}>{doc.province || 'N/A'}</td>
                  <td style={{ padding: '0.75rem' }}>{new Date(doc.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        documents.length > 0 && (
          <div>
            <h3 style={{ color: '#333' }}>All Documents</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>ID</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Name</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Add Tag</th>
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.75rem' }}>{doc.id}</td>
                    <td style={{ padding: '0.75rem' }}>{doc.name}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <input
                        type="text"
                        placeholder="Tag name"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        style={{ padding: '0.25rem', border: '1px solid #ddd', borderRadius: '4px', marginRight: '0.5rem' }}
                      />
                      <button
                        onClick={() => handleAddTag(doc.id)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          backgroundColor: '#fd7e14',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.8rem'
                        }}
                      >
                        Add
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
};

export default IndexingModule;