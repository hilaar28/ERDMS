import fs from 'fs';

/*
 * The old validation only checked `file.mimetype`, which is a value the
 * *client* sets on the multipart form request and is trivially spoofable
 * (e.g. renaming a .exe to invoice.pdf and setting Content-Type by hand).
 * This module checks the actual file bytes ("magic numbers") for the file
 * types ERDMS claims to support, so the declared MIME type has to match
 * what the file actually is.
 */

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'text/plain'
];

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Signatures for binary formats we support. DOC/DOCX/PDF/JPEG/PNG all have
// well-known leading byte sequences.
const SIGNATURES = [
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // .docx is a zip container (PK\x03\x04); legacy .doc is an OLE compound file
  { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes: [0x50, 0x4b, 0x03, 0x04] },
  { mime: 'application/msword', bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }
];

function matchesSignature(buffer, signatureBytes) {
  if (buffer.length < signatureBytes.length) return false;
  return signatureBytes.every((byte, i) => buffer[i] === byte);
}

function looksLikePlainText(buffer) {
  // Heuristic: plain text files shouldn't contain NUL bytes or a high
  // proportion of non-printable characters in the first chunk.
  const sample = buffer.subarray(0, Math.min(buffer.length, 1024));
  if (sample.includes(0x00)) return false;
  let nonPrintable = 0;
  for (const byte of sample) {
    const isPrintable = (byte >= 0x20 && byte <= 0x7e) || byte === 0x09 || byte === 0x0a || byte === 0x0d;
    if (!isPrintable) nonPrintable++;
  }
  return sample.length === 0 || nonPrintable / sample.length < 0.05;
}

/**
 * Validate an uploaded file: size, declared MIME type, and actual content.
 * `file` is a multer file object; `file.path` must point at the file on disk
 * (i.e. multer must be configured with disk storage, not memory storage).
 */
export async function validateFile(file) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return { valid: false, reason: 'Unsupported file type' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, reason: 'File too large' };
  }

  let handle;
  try {
    handle = await fs.promises.open(file.path, 'r');
    const buffer = Buffer.alloc(16);
    await handle.read(buffer, 0, 16, 0);

    if (file.mimetype === 'text/plain') {
      if (!looksLikePlainText(buffer)) {
        return { valid: false, reason: 'File content does not match declared type (text/plain)' };
      }
      return { valid: true };
    }

    const signature = SIGNATURES.find((s) => s.mime === file.mimetype);
    if (signature && !matchesSignature(buffer, signature.bytes)) {
      return { valid: false, reason: 'File content does not match declared type' };
    }

    return { valid: true };
  } catch (err) {
    console.error('File signature check failed:', err);
    return { valid: false, reason: 'Could not verify file content' };
  } finally {
    await handle?.close();
  }
}
