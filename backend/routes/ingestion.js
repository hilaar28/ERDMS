import express from 'express';
import path from 'path';
import multer from 'multer';
import cron from 'node-cron';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { validateFile } from '../utils/fileValidation.js';
import { saveDocumentMetadata } from '../models/ingestion.js';

const router = express.Router();

// Store uploads on disk (not memory) so validateFile can inspect the bytes,
// and keep the original extension so downstream type checks / previews work.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${ext}`);
  }
});
const upload = multer({ storage });

/* Document Ingestion & Capture Module
Validates and processes multi-file uploads, email attachments, and scanner integrations.
Auto-routes files through categorization engine based on content/metadata.
*/

// Email attachment monitoring is opt-in: it requires real IMAP credentials,
// which most dev/test environments won't have configured. Previously this
// cron job ran unconditionally and called APIs that don't exist on
// nodemailer (nodemailer only sends mail, it cannot read an inbox), so it
// threw on every single run. It now uses imapflow (a real IMAP client) and
// only starts if credentials are present.
const emailMonitoringEnabled =
  process.env.EMAIL_MONITORING_ENABLED === 'true' &&
  process.env.EMAIL_HOST &&
  process.env.EMAIL_USER &&
  process.env.EMAIL_PASS;

if (emailMonitoringEnabled) {
  cron.schedule('*/5 * * * *', async () => {
    await checkEmailAttachments();
  });
} else {
  console.log('Email attachment monitoring disabled (set EMAIL_MONITORING_ENABLED=true and EMAIL_HOST/EMAIL_USER/EMAIL_PASS to enable)');
}

// Document processing queue (in-memory for now, use RabbitMQ in production)
const processingQueue = [];

// Email checker function - polls an IMAP inbox for unseen messages with
// attachments and feeds them into the same processing queue as uploads.
async function checkEmailAttachments() {
  const client = new ImapFlow({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 993),
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    logger: false
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    try {
      const messages = client.fetch({ seen: false }, { source: true, uid: true });

      for await (const message of messages) {
        const parsed = await simpleParser(message.source);

        for (const attachment of parsed.attachments || []) {
          processingQueue.push({
            source: 'email',
            filename: attachment.filename,
            content: attachment.content, // Buffer
            mimeType: attachment.contentType,
            timestamp: new Date()
          });
        }

        // Mark as seen so we don't reprocess it on the next poll.
        await client.messageFlagsAdd(message.uid, ['\\Seen'], { uid: true });
      }
    } finally {
      lock.release();
    }

    await processQueue();
  } catch (error) {
    console.error('Email monitoring error:', error);
  } finally {
    await client.logout().catch(() => {});
  }
}

// Bulk file ingestion endpoint
router.post('/upload', upload.array('files', 10), async (req, res) => {
  try {
    const files = req.files;
    const metadata = req.body;
    const rejected = [];

    for (const file of files) {
      const validation = await validateFile(file);

      if (!validation.valid) {
        rejected.push({ file: file.originalname, reason: validation.reason });
        continue; // skip invalid files
      }

      processingQueue.push({
        source: 'upload',
        fileId: file.filename,
        originalName: file.originalname,
        storedPath: file.path,
        size: file.size,
        mimeType: file.mimetype,
        department: metadata.department,
        province: metadata.province
      });
    }

    const queuedCount = processingQueue.length;
    await processQueue();

    res.status(202).json({
      message: `${queuedCount} file(s) queued for processing`,
      rejected
    });
  } catch (error) {
    console.error('Ingestion upload error:', error);
    res.status(500).json({ error: 'Upload processing failed' });
  }
});

// Process file queue - categorizes each task and persists its metadata.
// Previously this loop only computed a category and left three TODO
// comments; nothing was ever written to the database, so uploaded files and
// their categorization were silently discarded.
async function processQueue() {
  while (processingQueue.length > 0) {
    const task = processingQueue.shift();
    const category = categorizeFile(task);

    try {
      await saveDocumentMetadata({
        name: task.originalName || task.filename || 'Untitled',
        originalFilename: task.originalName || task.filename,
        storedFilename: task.fileId || task.filename,
        filePath: task.storedPath ? path.relative(process.cwd(), task.storedPath) : null,
        fileSize: task.size ?? null,
        mimeType: task.mimeType ?? null,
        bucketName: process.env.MINIO_BUCKET || 'erkms-bucks',
        category,
        source: task.source,
        department: task.department ?? null,
        province: task.province ?? null
      });
    } catch (err) {
      console.error(`Failed to persist metadata for "${task.originalName || task.filename}":`, err);
    }

    // In production: also send the file bytes to MinIO/S3 storage and emit
    // an event for workflow routing (still on the project roadmap).
  }
}

// Categorization engine - determine file type/department
function categorizeFile(task) {
  const fileName = (task.originalName || task.filename || '').toLowerCase();

  if (fileName.includes('finance') || fileName.includes('budget')) {
    return 'Finance';
  }

  if (fileName.includes('legal') || fileName.includes('case')) {
    return 'Legal';
  }

  if (fileName.includes('gender') || fileName.includes('research')) {
    return 'Gender Equality';
  }

  return 'General';
}

export default router;
