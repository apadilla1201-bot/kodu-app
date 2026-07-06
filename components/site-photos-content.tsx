'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  Camera,
  ImageIcon,
  Loader2,
  MapPin,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { uploadFileToStorage } from '@/lib/upload-client';
import { prepareImageForUpload } from '@/lib/prepare-image-upload';
import {
  PHOTO_TAGS,
  groupPhotosByDate,
  isImageFile,
  photoTagLabel,
  photoTagStyle,
  resolveImageContentType,
  type PhotoTagId,
} from '@/lib/site-photos';

interface ProjectOpt {
  id: string;
  projectNumber: string;
  projectName: string;
}

interface SitePhotoRow {
  id: string;
  fileName: string;
  caption: string | null;
  area: string | null;
  trade: string | null;
  tag: string;
  takenAt: string;
  uploadedBy: string | null;
  imageUrl: string;
}

export function SitePhotosContent({
  projects,
  initialProjectId,
}: {
  projects: ProjectOpt[];
  initialProjectId?: string;
}) {
  const { toast } = useToast();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [projectId, setProjectId] = useState(initialProjectId || projects[0]?.id || '');
  const [photos, setPhotos] = useState<SitePhotoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [selected, setSelected] = useState<SitePhotoRow | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editArea, setEditArea] = useState('');
  const [editTrade, setEditTrade] = useState('');
  const [editTag, setEditTag] = useState<PhotoTagId>('progress');
  const [pendingTag, setPendingTag] = useState<PhotoTagId>('progress');
  const [pendingCaption, setPendingCaption] = useState('');

  const selectedProject = projects.find((p) => p.id === projectId);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const qs = tagFilter !== 'all' ? `?tag=${tagFilter}` : '';
      const res = await fetch(`/api/projects/${projectId}/photos${qs}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setPhotos(data.photos || []);
    } catch {
      toast({ title: 'No se pudieron cargar las fotos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [projectId, tagFilter, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (selected) {
      setEditCaption(selected.caption ?? '');
      setEditArea(selected.area ?? '');
      setEditTrade(selected.trade ?? '');
      setEditTag((selected.tag as PhotoTagId) || 'progress');
    }
  }, [selected]);

  const uploadFiles = async (files: FileList | File[]) => {
    if (!projectId) {
      toast({ title: 'Selecciona un proyecto', variant: 'destructive' });
      return;
    }
    const list = Array.from(files);
    if (!list.length) return;

    setUploading(true);
    let ok = 0;
    let skipped = 0;
    try {
      for (const raw of list) {
        if (!isImageFile(raw)) {
          skipped++;
          continue;
        }
        const file = await prepareImageForUpload(raw);
        const uploaded = await uploadFileToStorage(file, false);
        const fileType = resolveImageContentType(file);
        const res = await fetch(`/api/projects/${projectId}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            cloudStoragePath: uploaded.cloud_storage_path,
            fileName: file.name || `photo-${Date.now()}.jpg`,
            fileType,
            caption: pendingCaption || null,
            tag: pendingTag,
            takenAt: new Date().toISOString(),
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || 'Upload failed');
        }
        ok++;
      }
      if (ok > 0) {
        toast({ title: ok === 1 ? 'Foto subida' : `${ok} fotos subidas` });
        setPendingCaption('');
        await load();
      } else if (skipped > 0) {
        toast({
          title: 'Formato no soportado',
          description: 'Usa JPG, PNG o HEIC desde la galería.',
          variant: 'destructive',
        });
      }
    } catch (e: any) {
      toast({ title: e?.message ?? 'Error al subir', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    void uploadFiles(files);
  };

  const openFilePicker = (ref: React.RefObject<HTMLInputElement | null>) => {
    const input = ref.current;
    if (!input) return;
    input.value = '';
    input.click();
  };

  const savePhoto = async () => {
    if (!selected || !projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/photos/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          caption: editCaption,
          area: editArea,
          trade: editTrade,
          tag: editTag,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: 'Foto actualizada' });
      setSelected(null);
      await load();
    } catch {
      toast({ title: 'Error al guardar', variant: 'destructive' });
    }
  };

  const deletePhoto = async (photo: SitePhotoRow) => {
    if (!confirm('¿Eliminar esta foto del sitio?')) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/photos/${photo.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: 'Foto eliminada' });
      if (selected?.id === photo.id) setSelected(null);
      await load();
    } catch {
      toast({ title: 'Error al eliminar', variant: 'destructive' });
    }
  };

  const groups = groupPhotosByDate(photos);

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Camera className="w-6 h-6 text-[#C9A96E]" /> Site Photos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Fotos diarias de obra — progreso, issues, safety, entregas
          </p>
        </div>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="px-3 py-2 border rounded-lg bg-background text-sm min-w-[220px]"
        >
          {(projects ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              #{p.projectNumber} — {p.projectName}
            </option>
          ))}
        </select>
      </div>

      {/* Upload bar — sticky on mobile */}
      <div className="bg-card border rounded-xl p-4 shadow-sm space-y-3 lg:sticky lg:top-4 lg:z-10">
        <p className="text-sm font-medium">
          {selectedProject ? `#${selectedProject.projectNumber} — ${selectedProject.projectName}` : 'Select project'}
        </p>
        <div className="flex flex-wrap gap-2">
          {PHOTO_TAGS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setPendingTag(t.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                pendingTag === t.id ? t.color + ' ring-2 ring-[#C9A96E]' : 'bg-muted text-muted-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          value={pendingCaption}
          onChange={(e) => setPendingCaption(e.target.value)}
          placeholder="Nota opcional (ej. Grid B4 slab pour)"
          className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
            multiple
            capture="environment"
            className="hidden"
            onChange={handleFilePick}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
            multiple
            className="hidden"
            onChange={handleFilePick}
          />
          <button
            type="button"
            disabled={uploading || !projectId}
            onClick={() => openFilePicker(cameraInputRef)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#C9A96E] hover:bg-[#B8944F] text-white rounded-lg font-semibold text-sm disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            {uploading ? 'Subiendo…' : 'Tomar foto'}
          </button>
          <button
            type="button"
            disabled={uploading || !projectId}
            onClick={() => openFilePicker(galleryInputRef)}
            className="inline-flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <Upload className="w-4 h-4" /> Galería
          </button>
        </div>
      </div>

      {/* Tag filter */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTagFilter('all')}
          className={`px-3 py-1 rounded-full text-xs font-medium ${tagFilter === 'all' ? 'bg-[#0F1B33] text-[#C9A96E]' : 'bg-muted'}`}
        >
          All ({photos.length})
        </button>
        {PHOTO_TAGS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTagFilter(t.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${tagFilter === t.id ? t.color + ' ring-1 ring-[#C9A96E]' : 'bg-muted text-muted-foreground'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : photos.length === 0 ? (
        <div className="text-center py-16 bg-card border rounded-xl">
          <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-medium">Sin fotos todavía</p>
          <p className="text-sm text-muted-foreground mt-1">Sube la primera foto del sitio con el botón de arriba</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <div key={group.date}>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 sticky top-0 bg-background/95 py-1 backdrop-blur">
                {group.label}
                <span className="ml-2 font-normal">({group.photos.length})</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {group.photos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setSelected(photo)}
                    className="group relative aspect-square rounded-lg overflow-hidden border bg-muted text-left focus:ring-2 focus:ring-[#C9A96E]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.imageUrl}
                      alt={photo.caption || photo.fileName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <span className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-semibold ${photoTagStyle(photo.tag)}`}>
                      {photoTagLabel(photo.tag)}
                    </span>
                    {photo.caption && (
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6">
                        <p className="text-white text-xs line-clamp-2">{photo.caption}</p>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
          <div className="bg-card w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-xl shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Detalle de foto</h3>
              <button type="button" onClick={() => setSelected(null)} className="p-1 rounded hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.imageUrl} alt="" className="w-full max-h-[40vh] object-contain bg-black" />
            <div className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                {new Date(selected.takenAt).toLocaleString('en-US')}
                {selected.uploadedBy ? ` · ${selected.uploadedBy}` : ''}
              </p>
              <div>
                <label className="text-xs font-medium">Tag</label>
                <select
                  value={editTag}
                  onChange={(e) => setEditTag(e.target.value as PhotoTagId)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm"
                >
                  {PHOTO_TAGS.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Caption</label>
                <textarea
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  rows={2}
                  className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Area
                  </label>
                  <input
                    value={editArea}
                    onChange={(e) => setEditArea(e.target.value)}
                    placeholder="Level 2 / Grid B"
                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Trade</label>
                  <input
                    value={editTrade}
                    onChange={(e) => setEditTrade(e.target.value)}
                    placeholder="Concrete"
                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={savePhoto}
                  className="flex-1 py-2.5 bg-[#0F1B33] text-[#C9A96E] rounded-lg font-semibold text-sm"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => deletePhoto(selected)}
                  className="px-4 py-2.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
