'use client';

import React from 'react';
import {
  FileText,
  FileCode,
  FileArchive,
  FileAudio,
  FileImage,
  File,
  Download,
} from 'lucide-react';
import VoiceNotePlayer from '../VoiceNotePlayer';

export interface FileAttachment {
  name: string;
  size: number;
  type: string;
  url?: string;
  isAudio?: boolean;
  audioDuration?: number;
}

interface FileAttachmentCardProps {
  attachment: FileAttachment;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default function FileAttachmentCard({
  attachment,
}: FileAttachmentCardProps) {
  const { name, size, type, url, isAudio, audioDuration } = attachment;

  if (isAudio && url) {
    return (
      <VoiceNotePlayer url={url} duration={audioDuration} fileName={name} />
    );
  }

  const ext = (name.split('.').pop() || '').toLowerCase();

  const isImage =
    type?.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext);

  const isCode = [
    'js',
    'jsx',
    'ts',
    'tsx',
    'py',
    'cpp',
    'c',
    'h',
    'hpp',
    'java',
    'cs',
    'go',
    'rs',
    'php',
    'rb',
    'swift',
    'kt',
    'html',
    'css',
    'scss',
    'json',
    'xml',
    'yaml',
    'yml',
    'sql',
    'sh',
    'bash',
    'ps1',
    'bat',
    'toml',
    'env',
  ].includes(ext);

  const isArchive = ['zip', 'tar', 'gz', 'bz2', '7z', 'rar'].includes(ext);

  const isAudioFile =
    type?.startsWith('audio/') ||
    ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'webm'].includes(ext);

  const isDocument = [
    'pdf',
    'doc',
    'docx',
    'xls',
    'xlsx',
    'ppt',
    'pptx',
    'txt',
    'md',
    'csv',
    'tsv',
  ].includes(ext);

  return (
    <div className="flex flex-col gap-2 max-w-sm rounded-xl bg-neutral-900/90 border border-neutral-700/80 p-2.5 text-neutral-200 shadow-md">
      {isImage && url && (
        <div className="relative rounded-lg overflow-hidden bg-neutral-950 border border-neutral-800 max-h-48 flex items-center justify-center">
          <img
            src={url}
            alt={name}
            className="w-full h-auto max-h-48 object-contain rounded-lg"
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-lg bg-neutral-800 border border-neutral-700/60 shrink-0">
            {isImage ? (
              <FileImage className="w-5 h-5 text-purple-400" />
            ) : isAudioFile ? (
              <FileAudio className="w-5 h-5 text-emerald-400" />
            ) : isCode ? (
              <FileCode className="w-5 h-5 text-emerald-400" />
            ) : isArchive ? (
              <FileArchive className="w-5 h-5 text-amber-400" />
            ) : isDocument ? (
              <FileText className="w-5 h-5 text-sky-400" />
            ) : (
              <File className="w-5 h-5 text-neutral-400" />
            )}
          </div>

          <div className="min-w-0">
            <p
              className="text-xs font-semibold text-neutral-100 truncate"
              title={name}
            >
              {name}
            </p>
            <p className="text-[10px] text-neutral-400">
              {formatBytes(size)} {ext ? `· .${ext.toUpperCase()}` : ''}
            </p>
          </div>
        </div>

        {url && (
          <a
            href={url}
            download={name}
            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition shrink-0"
            title="Download file"
          >
            <Download className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );
}
