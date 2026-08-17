const MIME_TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'Word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.template': 'Excel Template',
  'application/vnd.openxmlformats-officedocument.presentationml.template': 'PowerPoint Template',
  'application/vnd.ms-excel': 'Excel',
  'application/vnd.ms-excel.sheet.macroEnabled.12': 'Excel',
  'application/vnd.ms-powerpoint': 'PowerPoint',
  'application/vnd.ms-powerpoint.presentation.macroEnabled.12': 'PowerPoint',
  'application/vnd.ms-word.document.macroEnabled.12': 'Word',
  'application/vnd.openxmlformats-package.xps': 'XPS',
  'application/rtf': 'RTF',
  'text/plain': 'Text',
  'text/csv': 'CSV',
  'text/html': 'HTML',
  'text/xml': 'XML',
  'application/json': 'JSON',
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/gif': 'GIF',
  'image/bmp': 'BMP',
  'image/tiff': 'TIFF',
  'image/webp': 'WebP',
  'image/svg+xml': 'SVG',
  'application/zip': 'ZIP',
  'application/x-rar-compressed': 'RAR',
  'application/x-7z-compressed': '7Z',
  'application/x-tar': 'TAR',
  'application/gzip': 'GZIP',
  'application/x-bzip2': 'BZIP2',
  'application/x-iso9660-image': 'ISO',
  'application/x-diskcopy': 'Disk Image',
  'application/x-font-ttf': 'TTF Font',
  'application/x-font-woff': 'WOFF Font',
  'application/vnd.ms-fontobject': 'Font',
};

export function getFriendlyTypeName(mimeType: string | undefined): string {
  if (!mimeType) return 'Unknown';
  const label = MIME_TYPE_LABELS[mimeType.toLowerCase()];
  if (label) return label;

  const ext = mimeType.split('/').pop();
  if (ext) return ext.charAt(0).toUpperCase() + ext.slice(1);

  return 'Unknown';
}
