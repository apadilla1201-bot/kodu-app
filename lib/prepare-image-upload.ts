/**
 * Normalize gallery/camera picks for upload (HEIC→JPEG, resize for mobile).
 */
import { fileExtension, isHeicFile, isImageFile, resolveImageContentType } from '@/lib/site-photos';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo leer la imagen'));
    img.src = src;
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Compresión falló'))),
      'image/jpeg',
      quality,
    );
  });
}

/** iOS Safari decodes HEIC locally via Image + canvas (more reliable than heic2any). */
async function heicViaCanvas(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas no disponible');
    ctx.drawImage(img, 0, 0);
    const blob = await canvasToJpeg(canvas, 0.88);
    const base = file.name.replace(/\.[^.]+$/i, '') || `photo-${Date.now()}`;
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function heicViaLibrary(file: File): Promise<File> {
  const heic2any = (await import('heic2any')).default;
  const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  const base = file.name.replace(/\.[^.]+$/i, '') || `photo-${Date.now()}`;
  return new File([blob as Blob], `${base}.jpg`, { type: 'image/jpeg' });
}

async function convertToJpeg(file: File): Promise<File> {
  if (isHeicFile(file)) {
    try {
      return await heicViaCanvas(file);
    } catch {
      try {
        return await heicViaLibrary(file);
      } catch {
        throw new Error('No se pudo convertir HEIC — prueba tomar la foto con la cámara');
      }
    }
  }
  return file;
}

/** Resize/compress so uploads stay under Vercel body limits and load fast on mobile. */
export async function compressImageForUpload(
  file: File,
  maxDim = 2048,
  maxBytes = 3_500_000,
): Promise<File> {
  if (!isImageFile(file)) return file;

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    let scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    let quality = 0.88;

    for (let attempt = 0; attempt < 6; attempt++) {
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) break;
      ctx.drawImage(img, 0, 0, w, h);
      const blob = await canvasToJpeg(canvas, quality);
      const base = file.name.replace(/\.[^.]+$/i, '') || `photo-${Date.now()}`;
      const out = new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
      if (out.size <= maxBytes || quality <= 0.55) return out;
      quality -= 0.08;
      scale *= 0.85;
    }

    const base = file.name.replace(/\.[^.]+$/i, '') || `photo-${Date.now()}`;
    const canvas = document.createElement('canvas');
    const fallbackScale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.max(1, Math.round(img.naturalWidth * fallbackScale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * fallbackScale));
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToJpeg(canvas, 0.75);
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function prepareImageForUpload(file: File): Promise<File> {
  let working = await convertToJpeg(file);

  const ext = fileExtension(working.name);
  if (!ext) {
    const type = resolveImageContentType(working);
    const suffix = type === 'image/png' ? 'png' : 'jpg';
    working = new File([working], `photo-${Date.now()}.${suffix}`, { type });
  }

  return compressImageForUpload(working);
}
