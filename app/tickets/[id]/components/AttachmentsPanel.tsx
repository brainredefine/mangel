// app/tickets/[id]/components/AttachmentsPanel.tsx

'use client';

import { useState, ChangeEvent, DragEvent } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { formatDateShort } from '../utils';
import { Card, Spinner, cn } from '@/components/ui';
import type { AttachmentWithUrl, Attachment } from '../types';

type Props = {
  ticketId: string;
  tenantId: number;
  attachments: AttachmentWithUrl[];
  setAttachments: React.Dispatch<React.SetStateAction<AttachmentWithUrl[]>>;
  currentUserId: string | null;
  isAdminAm: boolean;
};

export function AttachmentsPanel({
  ticketId,
  tenantId,
  attachments,
  setAttachments,
  currentUserId,
  isAdminAm,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const uploadFile = async (file: File, privacy: 'private' | 'public' = 'public') => {
    if (!currentUserId) return;

    setUploading(true);
    setUploadError(null);

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const path = `${tenantId}/${ticketId}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('ticket_attachments')
        .upload(path, file, {
          contentType: file.type || undefined,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: insertData, error: dbError } = await supabase
        .from('ticket_attachments')
        .insert({
          ticket_id: ticketId,
          uploaded_by: currentUserId,
          file_path: path,
          original_name: file.name,
          mime_type: file.type || 'application/octet-stream',
          privacy: privacy,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Utiliser signedUrl pour bucket privé (expire dans 1h)
      const { data: signedData } = await supabase.storage
        .from('ticket_attachments')
        .createSignedUrl(path, 3600);

      const newAtt: AttachmentWithUrl = {
        ...(insertData as Attachment),
        url: signedData?.signedUrl ?? null,
      };

      setAttachments((prev) => [...prev, newAtt]);
    } catch (err) {
      console.error('Upload attachment error', err);
      setUploadError('Upload fehlgeschlagen.');
    } finally {
      setUploading(false);
      setIsDragging(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>, privacy: 'private' | 'public' = 'public') => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file, privacy);
    e.target.value = '';
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (uploading) return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      // Par défaut public pour drag & drop, admin peut changer après
      uploadFile(files[0], isAdminAm ? 'private' : 'public');
    }
  };

  return (
    <Card className="flex h-full flex-col p-5">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <svg className="h-3.5 w-3.5 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
        </svg>
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
          Anhänge
        </h2>
        <span className="ml-auto font-mono text-[10px] font-medium text-zinc-400">
          {attachments.length}
        </span>
      </div>

      {/* Upload Zone */}
      <div className="mb-4 space-y-2">
        {/* Zone drag & drop */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'flex items-center justify-center gap-3 rounded-xl border border-dashed p-4 transition-all',
            isDragging
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-zinc-200 bg-zinc-50 hover:border-indigo-400'
          )}
        >
          <svg
            className={cn('h-5 w-5 transition-colors', isDragging ? 'text-indigo-500' : 'text-zinc-300')}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>

          {uploading ? (
            <span className="flex items-center gap-2 text-xs font-medium text-zinc-600">
              <Spinner className="h-3 w-3 text-indigo-500" />
              Upload...
            </span>
          ) : (
            <span className="text-xs font-medium text-zinc-600">
              {isDragging ? 'Ablegen' : 'Datei hierher ziehen'}
            </span>
          )}
        </div>

        {/* Boutons upload - Admin voit les deux options */}
        <div className={cn('grid gap-2', isAdminAm ? 'grid-cols-2' : 'grid-cols-1')}>
          {/* Upload Public */}
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {isAdminAm ? 'Public (Mieter sieht)' : '+ Datei / Foto'}
            <input
              type="file"
              className="hidden"
              onChange={(e) => handleFileChange(e, 'public')}
              disabled={uploading}
            />
          </label>

          {/* Upload Privé - Admin only */}
          {isAdminAm && (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
              Privat (intern)
              <input
                type="file"
                className="hidden"
                onChange={(e) => handleFileChange(e, 'private')}
                disabled={uploading}
              />
            </label>
          )}
        </div>

        {uploadError && (
          <p className="mt-2 text-center text-xs text-red-600">{uploadError}</p>
        )}
      </div>

      {/* Attachments List */}
      <div className="flex-1 space-y-1 overflow-y-auto">
        {attachments.length === 0 ? (
          <div className="py-8 text-center">
            <svg className="mx-auto mb-2 h-8 w-8 text-zinc-200" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
            <p className="text-xs font-medium text-zinc-500">Keine Dateien</p>
          </div>
        ) : (
          attachments.map((att) => (
            <AttachmentItem
              key={att.id}
              attachment={att}
              isAdminAm={isAdminAm}
              setAttachments={setAttachments}
            />
          ))
        )}
      </div>
    </Card>
  );
}

function AttachmentItem({
  attachment,
  isAdminAm,
  setAttachments,
}: {
  attachment: AttachmentWithUrl;
  isAdminAm: boolean;
  setAttachments: React.Dispatch<React.SetStateAction<AttachmentWithUrl[]>>;
}) {
  const [loading, setLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);

  const isPrivate = attachment.privacy === 'private';
  const isImage = attachment.mime_type?.startsWith('image/');
  const isPdf = attachment.mime_type === 'application/pdf';

  // Toggle privacy (admin only)
  const togglePrivacy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAdminAm || loading) return;

    setLoading(true);
    const newPrivacy = isPrivate ? 'public' : 'private';

    const { error } = await supabase
      .from('ticket_attachments')
      .update({ privacy: newPrivacy })
      .eq('id', attachment.id);

    if (!error) {
      setAttachments((prev) =>
        prev.map((att) =>
          att.id === attachment.id ? { ...att, privacy: newPrivacy } : att
        )
      );
    }
    setLoading(false);
  };

  // Télécharger avec signed URL
  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    setDownloadLoading(true);

    try {
      const { data, error } = await supabase.storage
        .from('ticket_attachments')
        .createSignedUrl(attachment.file_path, 60); // 60 secondes

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err) {
      console.error('Download error', err);
    } finally {
      setDownloadLoading(false);
    }
  };

  return (
    <div className="group flex items-center gap-3 rounded-lg border-b border-zinc-100 px-1 py-2 transition-colors hover:bg-zinc-50">
      {/* Thumbnail (Bild) oder Datei-Icon */}
      {isImage && attachment.url ? (
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block h-10 w-10 flex-shrink-0 overflow-hidden rounded border border-zinc-200"
          title="Öffnen"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={attachment.url} alt={attachment.original_name} className="h-full w-full object-cover" />
        </a>
      ) : (
        <div className="flex h-6 w-6 items-center justify-center text-zinc-400 transition-colors group-hover:text-indigo-500">
          {isImage ? (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          ) : isPdf ? (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          )}
        </div>
      )}

      {/* File Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-xs text-zinc-700 transition-colors group-hover:text-indigo-600">
            {attachment.original_name}
          </p>
        </div>
        <p className="text-[10px] font-medium text-zinc-400">
          {formatDateShort(attachment.created_at)}
        </p>
      </div>

      {/* Privacy Badge + Toggle (Admin only) */}
      {isAdminAm && (
        <button
          onClick={togglePrivacy}
          disabled={loading}
          className={cn(
            'flex items-center gap-1 rounded px-2 py-1 text-[8px] uppercase tracking-wider transition-colors',
            isPrivate
              ? 'bg-zinc-100 text-zinc-600 hover:bg-red-100 hover:text-red-700'
              : 'bg-emerald-100 text-emerald-700 hover:bg-zinc-100 hover:text-zinc-600',
            loading && 'opacity-50'
          )}
          title={isPrivate ? 'Klicken → Public' : 'Klicken → Privat'}
        >
          {loading ? (
            <Spinner className="h-2 w-2" />
          ) : isPrivate ? (
            <>
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
              Privat
            </>
          ) : (
            <>
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Public
            </>
          )}
        </button>
      )}

      {/* Download Button */}
      <button
        onClick={handleDownload}
        disabled={downloadLoading}
        className="p-1 text-zinc-300 transition-colors hover:text-indigo-500"
        title="Herunterladen"
      >
        {downloadLoading ? (
          <Spinner className="h-3 w-3" />
        ) : (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        )}
      </button>
    </div>
  );
}
