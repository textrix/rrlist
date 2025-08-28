'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { FileItem, BreadcrumbItem, FileViewMode } from '@/lib/types/files';
import Breadcrumb from '@/components/file-browser/Breadcrumb';
import ViewToggle from '@/components/file-browser/ViewToggle';
import FileGrid from '@/components/file-browser/FileGrid';
import FileList from '@/components/file-browser/FileList';
import Sidebar from '@/components/file-browser/Sidebar';

interface FilesResponse {
  files: FileItem[];
  remote: string;
  path: string;
  success: boolean;
  error?: string;
  tokenExpired?: boolean;
}

interface RemotesResponse {
  remotes: string[];
  success: boolean;
  error?: string;
}

export default function FileBrowser() {
  const searchParams = useSearchParams();
  const [remotes, setRemotes] = useState<string[]>([]);
  const [selectedRemote, setSelectedRemote] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [viewMode, setViewMode] = useState<FileViewMode['mode']>('list');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [refreshingToken, setRefreshingToken] = useState<boolean>(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  // Load remotes on mount
  useEffect(() => {
    fetchRemotes();
  }, []);

  // Set selected remote from URL parameter
  useEffect(() => {
    const remoteParam = searchParams.get('remote');
    if (remoteParam && remotes.length > 0 && remotes.includes(remoteParam)) {
      setSelectedRemote(remoteParam);
    }
  }, [searchParams, remotes]);

  // Load files when remote or path changes
  useEffect(() => {
    if (selectedRemote) {
      fetchFiles(selectedRemote, currentPath);
    }
  }, [selectedRemote, currentPath]);

  const fetchRemotes = async () => {
    try {
      const response = await fetch('/api/rclone/remotes');
      const data: RemotesResponse = await response.json();
      
      if (data.success) {
        setRemotes(data.remotes);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch remotes');
      }
    } catch (err) {
      setError('Network error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const fetchFiles = async (remote: string, path: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ remote });
      if (path) params.append('path', path);
      
      const response = await fetch(`/api/rclone/files?${params}`);
      const data: FilesResponse = await response.json();
      
      if (data.success) {
        setFiles(data.files);
        setError(null);
      } else {
        if (data.tokenExpired) {
          setError(`${data.error} - Click "Refresh Token" to re-authenticate`);
        } else {
          setError(data.error || 'Failed to fetch files');
        }
      }
    } catch (err) {
      setError('Network error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoteSelect = (remote: string) => {
    setSelectedRemote(remote);
    setCurrentPath('');
  };

  const handleFileClick = (file: FileItem, event: React.MouseEvent) => {
    // Ctrl/Cmd나 Shift 키가 눌린 경우 선택 처리는 FileList에서 담당
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    
    if (file.IsDir) {
      const newPath = currentPath ? `${currentPath}/${file.Name}` : file.Name;
      setCurrentPath(newPath);
    } else {
      console.log('File clicked:', file.Name);
    }
  };

  const handleFileDoubleClick = (file: FileItem) => {
    if (file.IsDir) {
      const newPath = currentPath ? `${currentPath}/${file.Name}` : file.Name;
      setCurrentPath(newPath);
    } else {
      console.log('Download file:', file.Name);
      // TODO: Implement file download
    }
  };

  const handleBreadcrumbNavigate = (path: string) => {
    setCurrentPath(path);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const refreshToken = async () => {
    if (!selectedRemote) return;
    
    setRefreshingToken(true);
    try {
      const response = await fetch('/api/rclone/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remote: selectedRemote })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setError(null);
        // Retry fetching files
        fetchFiles(selectedRemote, currentPath);
      } else {
        setError(`Token refresh failed: ${data.details}`);
      }
    } catch (err) {
      setError('Failed to refresh token: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setRefreshingToken(false);
    }
  };

  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    if (!selectedRemote || !currentPath) return [];
    
    const pathParts = currentPath.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [
      { name: selectedRemote, path: '' }
    ];
    
    pathParts.forEach((part, index) => {
      const path = pathParts.slice(0, index + 1).join('/');
      breadcrumbs.push({ name: part, path });
    });
    
    return breadcrumbs;
  };

  const handleFileSelect = (file: FileItem, selected: boolean) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(file.Path);
      } else {
        newSet.delete(file.Path);
      }
      return newSet;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedFiles(new Set(filteredFiles.map(file => file.Path)));
    } else {
      setSelectedFiles(new Set());
    }
  };

  const filteredFiles = files.filter(file =>
    file && file.Name && typeof file.Name === 'string' && 
    file.Name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 경로가 변경되면 선택 해제
  useEffect(() => {
    setSelectedFiles(new Set());
  }, [currentPath, selectedRemote]);


  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0 overflow-y-auto">
        <Sidebar
          remotes={remotes}
          selectedRemote={selectedRemote}
          onRemoteSelect={handleRemoteSelect}
        />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="p-4 overflow-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">
                RRList File Manager
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <svg className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>

          {/* Content Area */}
          {!selectedRemote ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No remote selected</h3>
              <p className="mt-1 text-sm text-gray-500">
                Choose a remote storage from the sidebar to browse files.
              </p>
            </div>
          ) : (
            <>
              {/* Breadcrumb */}
              <Breadcrumb
                items={generateBreadcrumbs()}
                onNavigate={handleBreadcrumbNavigate}
              />

              {/* Error Display */}
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                  <div className="flex items-center justify-between">
                    <span>Error: {error}</span>
                    {error.includes('token expired') && selectedRemote && (
                      <button
                        onClick={refreshToken}
                        disabled={refreshingToken}
                        className="ml-4 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium py-1 px-3 rounded text-sm transition-colors"
                      >
                        {refreshingToken ? 'Refreshing...' : 'Refresh Token'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Loading */}
              {loading && (
                <div className="text-center py-8">
                  <div className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading files...
                  </div>
                </div>
              )}

              {/* Selected Files Action Bar */}
              {selectedFiles.size > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <span className="text-sm font-medium text-blue-900">
                        {selectedFiles.size} item{selectedFiles.size > 1 ? 's' : ''} selected
                      </span>
                      <div className="text-sm text-blue-700">
                        {(() => {
                          const selectedFileItems = filteredFiles.filter(file => selectedFiles.has(file.Path));
                          const totalSize = selectedFileItems.reduce((sum, file) => sum + (file.Size || 0), 0);
                          const folders = selectedFileItems.filter(file => file.IsDir).length;
                          const files = selectedFileItems.length - folders;
                          
                          let description = '';
                          if (folders > 0) description += `${folders} folder${folders > 1 ? 's' : ''}`;
                          if (files > 0) {
                            if (description) description += ', ';
                            description += `${files} file${files > 1 ? 's' : ''}`;
                          }
                          if (totalSize > 0) {
                            description += ` (${formatFileSize(totalSize)})`;
                          }
                          
                          return description;
                        })()}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          const selectedFileItems = filteredFiles.filter(file => selectedFiles.has(file.Path));
                          console.log('Download selected:', selectedFileItems.map(f => f.Name));
                        }}
                        className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-md transition-colors"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download
                      </button>
                      
                      <button
                        onClick={() => {
                          const selectedFileItems = filteredFiles.filter(file => selectedFiles.has(file.Path));
                          console.log('Move selected:', selectedFileItems.map(f => f.Name));
                        }}
                        className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        Move
                      </button>
                      
                      <button
                        onClick={() => {
                          const selectedFileItems = filteredFiles.filter(file => selectedFiles.has(file.Path));
                          console.log('Delete selected:', selectedFileItems.map(f => f.Name));
                        }}
                        className="inline-flex items-center px-3 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md transition-colors"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                      
                      <button
                        onClick={() => setSelectedFiles(new Set())}
                        className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 rounded-md transition-colors"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* File Display */}
              {!loading && !error && filteredFiles.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No files found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    This directory appears to be empty or no files match your search.
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200">
                  <FileList
                    files={filteredFiles}
                    onFileClick={handleFileClick}
                    onFileDoubleClick={handleFileDoubleClick}
                    selectedFiles={selectedFiles}
                    onFileSelect={handleFileSelect}
                    onSelectAll={handleSelectAll}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}