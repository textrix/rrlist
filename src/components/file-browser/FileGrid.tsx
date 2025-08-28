'use client';

import { FileItem } from '@/lib/types/files';

interface FileGridProps {
  files: FileItem[];
  onFileClick: (file: FileItem) => void;
  onFileDoubleClick: (file: FileItem) => void;
}

function getFileIcon(file: FileItem) {
  if (file.IsDir) {
    return (
      <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
      </svg>
    );
  }

  // File type icons based on extension
  const extension = file.Name.split('.').pop()?.toLowerCase();
  
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension || '')) {
    return (
      <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
      </svg>
    );
  }

  if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(extension || '')) {
    return (
      <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
      </svg>
    );
  }

  if (['mp4', 'avi', 'mkv', 'mp3', 'wav', 'flac'].includes(extension || '')) {
    return (
      <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
        <path d="M2 6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        <path d="M8 8v4l3-2-3-2z" />
      </svg>
    );
  }

  // Default file icon
  return (
    <svg className="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
    </svg>
  );
}

function formatFileSize(bytes?: number) {
  if (!bytes) return '';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

export default function FileGrid({ files, onFileClick, onFileDoubleClick }: FileGridProps) {
  return (
    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-16 gap-2 p-2">
      {files.map((file, index) => (
        <div
          key={`${file.Name}-${index}`}
          className="group flex flex-col items-center p-1 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
          onClick={() => onFileClick(file)}
          onDoubleClick={() => onFileDoubleClick(file)}
        >
          <div className="mb-1">
            {getFileIcon(file)}
          </div>
          
          <div className="text-center w-full">
            <div className="text-xs font-medium text-gray-900 truncate group-hover:text-blue-600 leading-tight" title={file.Name}>
              {file.Name}
            </div>
            
            {!file.IsDir && file.Size && file.Size > 0 && (
              <div className="text-xs text-gray-500">
                {formatFileSize(file.Size)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}