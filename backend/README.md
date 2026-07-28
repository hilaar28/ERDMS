# ERDMS - Document Ingestion & Capture Module

## Overview
The Document Ingestion & Capture Module handles multi-file uploads, email attachment monitoring, and scanner integration. It automatically validates files and routes them through the categorization engine based on content and metadata.

## Features
- Multi-file drag-and-drop uploads (up to 10 files, 50MB each)
- Email attachment monitoring (every 5 minutes)
- File format validation (PDF, DOC, DOCX, images, TXT)
- Automatic categorization engine
- Metadata extraction and indexing

## Supported File Types
| Type | MIME | Category |
|------|------|----------|
| PDF | application/pdf | Legal/Finance |
| DOC | application/msword | General |
| DOCX | application/vnd.openxmlformats-officedocument.wordprocessingml.document | General |
| JPEG/PNG | image/jpeg, image/png | Images |
| TXT | text/plain | General |

## API Endpoints

### Upload Documents
```
POST /api/ingestion/upload
Content-Type: multipart/form-data
Files: files[]
Body: { department, province }

Response: 202 Accepted
{
  "message": "5 files queued for processing",
  "queueLength": 5
}
```

### Health Check
```
GET /health
Response: 200 OK
{
  "status": "OK",
  "timestamp": "2026-07-20T13:30:00.000Z"
}
```

## Database Schema
```sql
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  original_filename VARCHAR(512),
  stored_filename VARCHAR(512),
  file_path VARCHAR(1024),
  file_size BIGINT,
  mime_type VARCHAR(255),
  bucket_name VARCHAR(255),
  category VARCHAR(100),
  source VARCHAR(50),
  department VARCHAR(100),
  province VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Environment Variables
Required:
- `DATABASE_URL`: PostgreSQL connection string
- `EMAIL_HOST`: SMTP server for email monitoring
- `EMAIL_USER`: Email account username
- `EMAIL_PASS`: Email account password

## Architecture Notes
- Production: Use RabbitMQ for processing queue
- Production: Integrate Apache Tika for metadata extraction
- Production: Add virus scanning with ClamAV

## Testing
```bash
npm run dev
# or
npm start
```

Visit `http://localhost:3000/health` to verify service status.