import fs from 'fs/promises';
import path from 'path';
import { appBaseUrl } from '@/lib/app-url';

const DATA_DIR = path.join(process.cwd(), 'data');

export function isS3Configured(): boolean {
  return Boolean(process.env.AWS_BUCKET_NAME?.trim());
}

export function localFilePath(storagePath: string): string {
  const relative = storagePath.startsWith('local:')
    ? storagePath.slice('local:'.length)
    : storagePath;
  const normalized = relative.replace(/^\/+/, '');
  const full = path.join(DATA_DIR, normalized);
  const resolved = path.resolve(full);
  if (!resolved.startsWith(path.resolve(DATA_DIR))) {
    throw new Error('Ruta de archivo no válida');
  }
  return resolved;
}

export function isLocalStoragePath(storagePath: string): boolean {
  return storagePath.startsWith('local:') || storagePath.startsWith('uploads/');
}

export async function saveLocalFile(
  storagePath: string,
  body: Buffer
): Promise<void> {
  const fullPath = localFilePath(storagePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, body);
}

export async function readLocalFile(storagePath: string): Promise<Buffer> {
  const fullPath = localFilePath(storagePath);
  return fs.readFile(fullPath);
}

export async function localFileExists(storagePath: string): Promise<boolean> {
  try {
    await fs.access(localFilePath(storagePath));
    return true;
  } catch {
    return false;
  }
}

export function buildLocalStoragePath(fileName: string): string {
  const safeName = (fileName ?? 'file').replace(/[/\\]/g, '_');
  return `uploads/${Date.now()}-${safeName}`;
}

export function buildLocalUploadUrl(storagePath: string): string {
  return `${appBaseUrl()}/api/upload/put?key=${encodeURIComponent(storagePath)}`;
}

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  bmp: 'image/bmp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
};

export function guessMimeType(fileName: string, fallback = 'application/octet-stream'): string {
  const ext = (fileName.split('.').pop() ?? '').toLowerCase();
  return MIME_BY_EXT[ext] ?? fallback;
}
