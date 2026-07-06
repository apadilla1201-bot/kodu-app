/**
 * Normalize gallery/camera picks for upload (HEIC→JPEG, missing names).
 */
import { fileExtension, isHeicFile, resolveImageContentType } from '@/lib/site-photos';

export async function prepareImageForUpload(file: File): Promise<File> {
  if (isHeicFile(file)) {
    try {
      const heic2any = (await import('heic2any')).default;
      const converted = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.85,
      });
      const blob = Array.isArray(converted) ? converted[0] : converted;
      const base = file.name.replace(/\.[^.]+$/i, '') || `photo-${Date.now()}`;
      return new File([blob as Blob], `${base}.jpg`, { type: 'image/jpeg' });
    } catch (err) {
      console.warn('HEIC conversion failed, uploading original:', err);
    }
  }

  const ext = fileExtension(file.name);
  if (!ext) {
    const type = resolveImageContentType(file);
    const suffix = type === 'image/png' ? 'png' : 'jpg';
    return new File([file], `photo-${Date.now()}.${suffix}`, { type });
  }

  return file;
}
