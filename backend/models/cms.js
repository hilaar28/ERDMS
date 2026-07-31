import axios from 'axios';
import pool from '../db.js';

export async function fetchCaseById(caseId) {
  try {
    const response = await axios.get(`${process.env.CMS_API_URL}/cases/${caseId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.CMS_API_KEY}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('CMS fetch error:', error);
    throw new Error('Failed to fetch case from CMS');
  }
}

export async function syncCaseDocuments(caseId) {
  const caseData = await fetchCaseById(caseId);
  return caseData.documents || [];
}

export async function linkDocumentToCase(documentId, caseId, metadata) {
  const result = await pool.query(
    `INSERT INTO document_cms_links (document_id, case_id, case_system, metadata)
     VALUES ($1, $2, 'external_cms', $3)
     ON CONFLICT (document_id, case_id) DO UPDATE SET metadata = EXCLUDED.metadata
     RETURNING id`,
    [documentId, caseId, JSON.stringify(metadata || {})]
  );
  return result.rows[0];
}

export async function getCaseDocuments(caseId) {
  const result = await pool.query(
    `SELECT d.id, d.name, d.original_filename, d.created_at, l.metadata
     FROM document_cms_links l
     JOIN documents d ON l.document_id = d.id
     WHERE l.case_id = $1 AND l.case_system = 'external_cms'`,
    [caseId]
  );
  return result.rows;
}

export default {
  fetchCaseById,
  syncCaseDocuments,
  linkDocumentToCase,
  getCaseDocuments
};