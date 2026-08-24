'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/hooks/use-i18n';
import {
  Bug,
  Camera,
  ImageIcon,
  Loader2,
  MapPin,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { uploadSitePhoto } from '@/lib/upload-site-photo';
import { prepareImageForUpload } from '@/lib/prepare-image-upload';
import {
  PHOTO_TAGS,
  AREA_PRESETS,
  TRADE_PRESETS,
  groupPhotosByDate,
  isImageFile,
  photoLocationLine,
  photoTagLabel,
  photoTagStyle,
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
  const { t, locale } = useI18n();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [projectId, setProjectId] = useState(initialProjectId || projects[0]?.id || '');
  const [photos, setPhotos] = useState<SitePhotoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [selected, setSelected] = useState<SitePhotoRow | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editArea, setEditArea] = useState('');
  const [editTrade, setEditTrade] = useState('');
  const [editTag, setEditTag] = useState<PhotoTagId>('progress');
  const [pendingTag, setPendingTag] = useState<PhotoTagId>('progress');
  const [pendingCaption, setPendingCaption] = useState('');
  const [pendingArea, setPendingArea] = useState('');
  const [pendingTrade, setPendingTrade] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  const selectedProject = projects.find((p) => p.id === projectId);

  const addDebug = useCallback((msg: string) => {
    setDebugLog((prev) => [...prev, `${new Date().toLocaleTimeString()}  ${msg}`]);
  }, []);

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
      toast({ title: t('sitePhotos.loadFailed'), variant: 'destructive' });
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

  const uploadFiles = async (files: FileList | File[]): Promise<boolean> => {
    addDebug(`[UPLOAD] start projectId=${projectId} fileCount=${Array.from(files).length}`);
    if (!projectId) {
      toast({ title: t('sitePhotos.selectProjectFirst'), variant: 'destructive' });
      return false;
    }
    const area = pendingArea.trim();
    const caption = pendingCaption.trim();
    addDebug(`[UPLOAD] validation area="${area}" caption="${caption}" hasId=${!!(area || caption)}`);
    if (!area && !caption) {
      toast({
        title: t('sitePhotos.missingId'),
        description: t('sitePhotos.missingIdDesc'),
        variant: 'destructive',
      });
      addDebug('[UPLOAD] ABORTED: missing area or description');
      return false;
    }
    const list = Array.from(files);
    if (!list.length) {
      addDebug('[UPLOAD] abort: no files');
      return false;
    }

    setUploading(true);
    setUploadError(null);
    let ok = 0;
    let skipped = 0;
    try {
      for (let i = 0; i < list.length; i++) {
        const raw = list[i];
        addDebug(`[UPLOAD] file ${i} name=${raw.name} type=${raw.type} size=${raw.size}`);
        if (!isImageFile(raw)) {
          addDebug(`[UPLOAD] file ${i} SKIPPED (not image)`);
          skipped++;
          continue;
        }
        setUploadStatus(
          list.length > 1
            ? `Preparing photo ${i + 1} of ${list.length}…`
            : 'Preparing photo…',
        );
        let file: File;
        try {
          file = await prepareImageForUpload(raw);
          addDebug(`[UPLOAD] prepared ${file.name} size=${file.size}`);
        } catch (prepErr: any) {
          addDebug(`[UPLOAD] prepare failed, using raw: ${prepErr?.message || prepErr}`);
          file = raw;
        }
        setUploadStatus(
          list.length > 1
            ? `Uploading photo ${i + 1} of ${list.length}…`
            : 'Uploading photo…',
        );
        addDebug('[UPLOAD] calling API…');
        const result = await uploadSitePhoto(
          projectId,
          file,
          {
            caption: caption || null,
            area: area || null,
            trade: pendingTrade.trim() || null,
            tag: pendingTag,
          },
          addDebug,
        );
        addDebug(`[UPLOAD] API result ${JSON.stringify(result)}`);
        ok++;
      }
      addDebug(`[UPLOAD] loop done ok=${ok} skipped=${skipped}`);
      if (ok > 0) {
        setUploadStatus(null);
        toast({ title: ok === 1 ? t('sitePhotos.photoUploaded') : t('sitePhotos.photosUploaded', { count: ok }) });
        setPendingCaption('');
        setPendingArea('');
        setPendingTrade('');
        addDebug('[UPLOAD] refreshing list…');
        await load();
        addDebug('[UPLOAD] refresh done');
        return true;
      } else if (skipped > 0) {
        const msg = t('sitePhotos.invalidFormat');
        setUploadError(msg);
        toast({ title: t('sitePhotos.unsupportedFormat'), description: msg, variant: 'destructive' });
        return false;
      }
      return false;
    } catch (e: any) {
      addDebug(`[UPLOAD] ERROR: ${e?.message || e}`);
      const msg = e?.message ?? t('sitePhotos.uploadError');
      setUploadError(msg);
      setUploadStatus(null);
      toast({ title: msg, variant: 'destructive' });
      return false;
    } finally {
      setUploading(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const list = Array.from(files).filter(isImageFile);
    if (!list.length) {
      toast({ title: t('sitePhotos.invalidFormat'), variant: 'destructive' });
      return;
    }
    setPendingFiles(list);
    const previews = list.map((f) => URL.createObjectURL(f));
    setPendingPreviews(previews);
    if (e.target) e.target.value = '';
  };

  const clearPending = () => {
    pendingPreviews.forEach((url) => URL.revokeObjectURL(url));
    setPendingFiles([]);
    setPendingPreviews([]);
  };

  const executeUpload = async () => {
    if (!pendingFiles.length) return;
    const success = await uploadFiles(pendingFiles);
    if (success) clearPending();
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
      toast({ title: t('sitePhotos.photoUpdated') });
      setSelected(null);
      await load();
    } catch {
      toast({ title: t('sitePhotos.saveError'), variant: 'destructive' });
    }
  };

  const deletePhoto = async (photo: SitePhotoRow) => {
    if (!confirm(t('sitePhotos.deleteConfirm'))) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/photos/${photo.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: t('sitePhotos.photoDeleted') });
      if (selected?.id === photo.id) setSelected(null);
      await load();
    } catch {
      toast({ title: t('sitePhotos.deleteError'), variant: 'destructive' });
    }
  };

  const groups = groupPhotosByDate(photos);

  const selectedLabel = (count: number) =>
    count === 1 ? t('sitePhotos.photoSelected') : t('sitePhotos.photosSelected', { count });

  const uploadLabel = (count: number) =>
    count === 1 ? t('sitePhotos.uploadOne') : t('sitePhotos.uploadN', { count });

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Camera className="w-6 h-6 text-[#C9A96E]" /> {t('sitePhotos.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('sitePhotos.subtitle')}
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
      <div className="bg-card border rounded-xl p-4 shadow-sm space-y-4 lg:sticky lg:top-4 lg:z-10">
        <div>
          <p className="text-sm font-medium">
            {selectedProject ? `#${selectedProject.projectNumber} — ${selectedProject.projectName}` : t('sitePhotos.selectProject')}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('sitePhotos.identificationHint')}
          </p>
        </div>

        {/* What is it */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('sitePhotos.whatIsIt')}
          </label>
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
                {photoTagLabel(t.id, locale)}
              </button>
            ))}
          </div>
        </div>

        {/* Where */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {t('sitePhotos.whereArea')}
          </label>
          <input
            value={pendingArea}
            onChange={(e) => setPendingArea(e.target.value)}
            placeholder={t('sitePhotos.phLocation')}
            className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
          />
          <div className="flex flex-wrap gap-1.5">
            {AREA_PRESETS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setPendingArea(a)}
                className={`px-2 py-0.5 rounded text-[11px] border ${
                  pendingArea === a ? 'bg-[#0F1B33] text-[#C9A96E] border-[#C9A96E]' : 'bg-muted/50 text-muted-foreground'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Trade */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('sitePhotos.tradeLabel')}
          </label>
          <input
            value={pendingTrade}
            onChange={(e) => setPendingTrade(e.target.value)}
            placeholder={t('sitePhotos.phTrades')}
            className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
          />
          <div className="flex flex-wrap gap-1.5">
            {TRADE_PRESETS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setPendingTrade(t)}
                className={`px-2 py-0.5 rounded text-[11px] border ${
                  pendingTrade === t ? 'bg-[#0F1B33] text-[#C9A96E] border-[#C9A96E]' : 'bg-muted/50 text-muted-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('sitePhotos.whatShowsDesc')}
          </label>
          <textarea
            value={pendingCaption}
            onChange={(e) => setPendingCaption(e.target.value)}
            rows={2}
            placeholder={t('sitePhotos.phDescription')}
            className="w-full px-3 py-2 border rounded-lg bg-background text-sm resize-none"
          />
          <p className="text-[11px] text-muted-foreground">{t('sitePhotos.requiredHint')}</p>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {/* Use sr-only instead of hidden so iOS Safari allows programmatic input.click() */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            className="sr-only"
            onChange={handleFilePick}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={handleFilePick}
          />
          <button
            type="button"
            disabled={uploading || !projectId}
            onClick={() => openFilePicker(cameraInputRef)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#C9A96E] hover:bg-[#B8944F] text-white rounded-lg font-semibold text-sm disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            {uploading ? t('sitePhotos.uploading') : t('sitePhotos.takePhoto')}
          </button>
          <button
            type="button"
            disabled={uploading || !projectId}
            onClick={() => openFilePicker(galleryInputRef)}
            className="inline-flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <Upload className="w-4 h-4" /> {t('sitePhotos.gallery')}
          </button>
          <button
            type="button"
            onClick={() => setShowDebug((s) => !s)}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 border rounded-lg text-xs font-medium hover:bg-muted"
            title={showDebug ? t('sitePhotos.hide') : t('sitePhotos.debug')}
          >
            <Bug className="w-3.5 h-3.5" /> {showDebug ? t('sitePhotos.hide') : t('sitePhotos.debug')}
          </button>
        </div>

        {/* Debug panel */}
        {showDebug && (
          <div className="border rounded-lg bg-slate-900 text-slate-100 text-[11px] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#C9A96E]">{t('sitePhotos.debugPanel')}</span>
              <button
                type="button"
                onClick={() => setDebugLog([])}
                className="text-[10px] underline opacity-70 hover:opacity-100"
              >
                {t('common.clear')}
              </button>
            </div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono leading-relaxed">
              {debugLog.length === 0 ? t('sitePhotos.waitingAction') : debugLog.join('\n')}
            </pre>
          </div>
        )}

        {/* Preview of selected files — shows BEFORE upload so user can confirm */}
        {pendingFiles.length > 0 && (
          <div className="space-y-3 border-t pt-3">
            <p className="text-sm font-medium text-muted-foreground">
              {pendingFiles.length} {selectedLabel(pendingFiles.length)}:
            </p>
            <div className="flex flex-wrap gap-2">
              {pendingPreviews.map((url, i) => (
                <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] text-center py-0.5 truncate px-1">
                    {pendingFiles[i]?.name}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={executeUpload}
                className="flex-1 bg-[#C9A96E] hover:bg-[#B8944F] text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {uploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> {t('sitePhotos.uploading')}
                  </span>
                ) : (
                  uploadLabel(pendingFiles.length)
                )}
              </button>
              <button
                type="button"
                disabled={uploading}
                onClick={clearPending}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-muted disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}

        {uploadStatus && (
          <p className="flex items-center gap-2 text-sm text-[#C9A96E] font-medium">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            {uploadStatus}
          </p>
        )}
        {uploadError && !uploading && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {uploadError}
          </p>
        )}
      </div>

      {/* Tag filter */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTagFilter('all')}
          className={`px-3 py-1 rounded-full text-xs font-medium ${tagFilter === 'all' ? 'bg-[#0F1B33] text-[#C9A96E]' : 'bg-muted'}`}
        >
          {t('common.all')} ({photos.length})
        </button>
        {PHOTO_TAGS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTagFilter(t.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${tagFilter === t.id ? t.color + ' ring-1 ring-[#C9A96E]' : 'bg-muted text-muted-foreground'}`}
          >
            {photoTagLabel(t.id, locale)}
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
          <p className="font-medium">{t('sitePhotos.noPhotosYet')}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('sitePhotos.firstPhotoHint')}</p>
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
                {group.photos.map((photo) => {
                  const location = photoLocationLine(photo);
                  return (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setSelected(photo)}
                    className="group relative aspect-square rounded-lg overflow-hidden border bg-muted text-left focus:ring-2 focus:ring-[#C9A96E]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.imageUrl}
                      alt={photo.caption || location || photo.fileName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <span className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-semibold ${photoTagStyle(photo.tag)}`}>
                      {photoTagLabel(photo.tag, locale)}
                    </span>
                    {(location || photo.caption) && (
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-8 space-y-0.5">
                        {location && (
                          <p className="text-white text-[10px] font-semibold flex items-center gap-1 line-clamp-1">
                            <MapPin className="w-2.5 h-2.5 shrink-0" /> {location}
                          </p>
                        )}
                        {photo.caption && (
                          <p className="text-white/90 text-[10px] line-clamp-2">{photo.caption}</p>
                        )}
                      </div>
                    )}
                  </button>
                  );
                })}
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
              <h3 className="font-semibold">{t('sitePhotos.photoDetail')}</h3>
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
                <label className="text-xs font-medium">{t('sitePhotos.typeLabel')}</label>
                <select
                  value={editTag}
                  onChange={(e) => setEditTag(e.target.value as PhotoTagId)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm"
                >
                  {PHOTO_TAGS.map((t) => (
                    <option key={t.id} value={t.id}>{photoTagLabel(t.id, locale)}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {t('sitePhotos.area')}
                  </label>
                  <input
                    value={editArea}
                    onChange={(e) => setEditArea(e.target.value)}
                    placeholder={t('sitePhotos.phLocationShort')}
                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">{t('sitePhotos.trade')}</label>
                  <input
                    value={editTrade}
                    onChange={(e) => setEditTrade(e.target.value)}
                    placeholder={t('sitePhotos.phTradesShort')}
                    className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium">{t('sitePhotos.descLabel')}</label>
                <textarea
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  rows={2}
                  placeholder={t('sitePhotos.whatShows')}
                  className="w-full mt-1 px-3 py-2 border rounded-lg bg-background text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={savePhoto}
                  className="flex-1 py-2.5 bg-[#0F1B33] text-[#C9A96E] rounded-lg font-semibold text-sm"
                >
                  {t('common.save')}
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
