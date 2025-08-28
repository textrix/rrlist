'use client';

import { FileItem } from '@/lib/types/files';
import { useState, useMemo } from 'react';

type SortField = 'name' | 'modified' | 'size';
type SortOrder = 'asc' | 'desc';

interface FileListProps {
  files: FileItem[];
  onFileClick: (file: FileItem, event: React.MouseEvent) => void;
  onFileDoubleClick: (file: FileItem) => void;
  selectedFiles: Set<string>;
  onFileSelect: (file: FileItem, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  currentRemote: string;
  currentPath: string;
}

function getFileIcon(file: FileItem) {
  if (file.IsDir) {
    return (
      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
      </div>
    );
  }

  // Get file extension
  const extension = file.Name.split('.').pop()?.toLowerCase();
  
  // Image files
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension || '')) {
    return (
      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
        </svg>
      </div>
    );
  }

  // Document files
  if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(extension || '')) {
    return (
      <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      </div>
    );
  }

  // Video/Audio files
  if (['mp4', 'avi', 'mkv', 'mp3', 'wav', 'flac'].includes(extension || '')) {
    return (
      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          <path d="M8 8v4l3-2-3-2z" />
        </svg>
      </div>
    );
  }

  // Archive files
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension || '')) {
    return (
      <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2zM3.293 7.707L9 2l5.707 5.707A1 1 0 0114 9H4a1 1 0 01-.707-1.293z" clipRule="evenodd" />
        </svg>
      </div>
    );
  }

  // Default file icon
  return (
    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
      <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
      </svg>
    </div>
  );
}

function formatFileSize(bytes?: number) {
  if (!bytes) return '-';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(dateString?: string) {
  if (!dateString) return '-';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '-';
  }
}

export default function FileList({ 
  files, 
  onFileClick, 
  onFileDoubleClick, 
  selectedFiles, 
  onFileSelect, 
  onSelectAll,
  currentRemote,
  currentPath
}: FileListProps) {
  const hasSelectedFiles = selectedFiles.size > 0;
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [lastClickedIndex, setLastClickedIndex] = useState<number>(-1);
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());

  const handleDownload = async (file: FileItem) => {
    if (file.IsDir) return; // 폴더는 다운로드할 수 없음
    
    const fileKey = `${currentRemote}:${file.Path}`;
    setDownloadingFiles(prev => new Set([...prev, fileKey]));
    
    try {
      // Construct full path: currentPath + fileName
      const fullPath = currentPath ? `${currentPath.replace(/\/+$/, '')}/${file.Name}` : file.Name;
      const downloadUrl = `/api/rclone/download?remote=${encodeURIComponent(currentRemote)}&path=${encodeURIComponent(fullPath)}`;
      
      console.log(`Download URL: ${downloadUrl}`);
      
      // Create hidden link and trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = file.Name;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Remove loading state after a short delay
      setTimeout(() => {
        setDownloadingFiles(prev => {
          const newSet = new Set(prev);
          newSet.delete(fileKey);
          return newSet;
        });
      }, 1000);
      
    } catch (error) {
      console.error('Download failed:', error);
      setDownloadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileKey);
        return newSet;
      });
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => {
      // 디렉토리 우선 정렬
      if (a.IsDir && !b.IsDir) return -1;
      if (!a.IsDir && b.IsDir) return 1;
      
      // 같은 타입(디렉토리 또는 파일)끼리 정렬
      let comparison = 0;
      
      switch (sortField) {
        case 'name':
          comparison = a.Name.localeCompare(b.Name, undefined, { numeric: true, sensitivity: 'base' });
          break;
        case 'modified':
          const aTime = a.ModTime ? new Date(a.ModTime).getTime() : 0;
          const bTime = b.ModTime ? new Date(b.ModTime).getTime() : 0;
          comparison = aTime - bTime;
          break;
        case 'size':
          const aSize = a.Size || 0;
          const bSize = b.Size || 0;
          comparison = aSize - bSize;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [files, sortField, sortOrder]);

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    
    return sortOrder === 'asc' ? (
      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  const handleFileClick = (file: FileItem, index: number, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd + 클릭: 개별 토글
      const isSelected = selectedFiles.has(file.Path);
      onFileSelect(file, !isSelected);
      setLastClickedIndex(index);
    } else if (event.shiftKey && lastClickedIndex >= 0) {
      // Shift + 클릭: 범위 선택
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      
      for (let i = start; i <= end; i++) {
        if (i < sortedFiles.length) {
          onFileSelect(sortedFiles[i], true);
        }
      }
    } else {
      // 일반 클릭: 기존 동작
      onFileClick(file, event);
      setLastClickedIndex(index);
    }
  };

  const handleCheckboxChange = (file: FileItem, checked: boolean) => {
    onFileSelect(file, checked);
  };

  const isAllSelected = files.length > 0 && files.every(file => selectedFiles.has(file.Path));
  const isIndeterminate = !isAllSelected && files.some(file => selectedFiles.has(file.Path));

  return (
    <div className="bg-white">
      {/* Header */}
      <div className="flex items-center pl-2 pr-4 py-3 border-b border-gray-200 text-sm font-medium text-gray-500 bg-white">
        <input
          type="checkbox"
          checked={isAllSelected}
          ref={(input) => {
            if (input) input.indeterminate = isIndeterminate;
          }}
          onChange={(e) => onSelectAll(e.target.checked)}
          className={`w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 transition-opacity mr-3 ${
            hasSelectedFiles ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
          }`}
        />
        <button 
          className="flex-1 min-w-0 flex items-center hover:text-gray-700 transition-colors"
          onClick={() => handleSort('name')}
        >
          <span>Name</span>
          <span className="ml-1">{getSortIcon('name')}</span>
        </button>
        <div className="w-16"></div>
        <button 
          className="w-40 text-right hidden sm:flex sm:items-center sm:justify-end sm:space-x-1 hover:text-gray-700 transition-colors"
          onClick={() => handleSort('modified')}
        >
          <span>Modified</span>
          {getSortIcon('modified')}
        </button>
        <button 
          className="w-24 text-right hidden sm:flex sm:items-center sm:justify-end sm:space-x-1 hover:text-gray-700 transition-colors"
          onClick={() => handleSort('size')}
        >
          <span>File size</span>
          {getSortIcon('size')}
        </button>
      </div>
      
      {/* File List */}
      <div>
        {sortedFiles.map((file, index) => {
          const isSelected = selectedFiles.has(file.Path);
          return (
            <div
              key={`${file.Name}-${index}`}
              className={`flex items-center pl-2 pr-4 py-4 cursor-pointer group transition-colors border-b border-gray-100 last:border-b-0 ${
                isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'
              }`}
              onClick={(e) => handleFileClick(file, index, e)}
              onDoubleClick={() => onFileDoubleClick(file)}
            >
              {/* Checkbox + File Icon + Name */}
              <div className="flex-1 min-w-0 flex items-center space-x-3">
                <div 
                  className="flex items-center space-x-3 cursor-pointer hover:bg-gray-100 rounded px-1 py-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCheckboxChange(file, !isSelected);
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}} // 빈 함수로 React 경고 방지
                    className={`w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 pointer-events-none transition-opacity ${
                      isSelected ? 'opacity-100' : hasSelectedFiles ? 'opacity-60' : 'opacity-0 group-hover:opacity-60'
                    }`}
                  />
                  {getFileIcon(file)}
                </div>
                <span className="truncate text-sm text-gray-900 font-medium" title={file.Name}>
                  {file.Name}
                </span>
              </div>
            
              {/* Action Buttons */}
              <div className="w-16 flex justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('Share:', file.Name);
                  }}
                  title="Share"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                  </svg>
                </button>
                
                {!file.IsDir && (
                  <button 
                    className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(file);
                    }}
                    disabled={downloadingFiles.has(`${currentRemote}:${file.Path}`)}
                    title={downloadingFiles.has(`${currentRemote}:${file.Path}`) ? "Downloading..." : "Download"}
                  >
                    {downloadingFiles.has(`${currentRemote}:${file.Path}`) ? (
                      <svg className="w-4 h-4 text-blue-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                  </button>
                )}
                
                <button 
                  className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('More options:', file.Name);
                  }}
                  title="More options"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                </button>
              </div>
              
              {/* Modified Date */}
              <div className="w-40 text-right text-sm text-gray-500 hidden sm:block">
                {formatDate(file.ModTime)}
              </div>
              
              {/* Size */}
              <div className="w-24 text-right text-sm text-gray-600 font-medium hidden sm:block">
                {file.IsDir ? '-' : formatFileSize(file.Size)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}