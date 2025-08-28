'use client';

import { useEffect, useState } from 'react';

interface RemoteListResponse {
  remotes: string[];
  remoteDetails: {[key: string]: {name: string, type: string}};
  success: boolean;
  error?: string;
  details?: string;
}

interface StorageInfo {
  [remote: string]: {
    total?: number;
    used?: number;
    free?: number;
    error?: string;
  };
}

interface StorageResponse {
  success: boolean;
  data: StorageInfo;
  lastUpdated: number | null;
}

export default function Home() {
  const [remotes, setRemotes] = useState<string[]>([]);
  const [remoteDetails, setRemoteDetails] = useState<{[key: string]: {name: string, type: string}}>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageInfo>({});
  const [storageLoading, setStorageLoading] = useState(true);
  const [hoveredRemote, setHoveredRemote] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    fetchRemotes();
    fetchStorageInfo();
  }, []);

  const fetchRemotes = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/rclone/remotes');
      const data: RemoteListResponse = await response.json();
      
      if (data.success) {
        setRemotes(data.remotes);
        setRemoteDetails(data.remoteDetails || {});
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch remotes');
      }
    } catch (err) {
      setError('Network error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchStorageInfo = async () => {
    try {
      setStorageLoading(true);
      const response = await fetch('/api/rclone/storage');
      const data: StorageResponse = await response.json();
      
      if (data.success && data.data) {
        setStorageInfo(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch storage info:', err);
    } finally {
      setStorageLoading(false);
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStorageGauge = (remote: string) => {
    const storage = storageInfo[remote];
    if (!storage || storage.error || !storage.total || !storage.used) {
      return (
        <div className="w-full h-2 bg-gray-200 rounded-full">
          <div className="h-full bg-gray-400 rounded-full" style={{ width: '0%' }}></div>
        </div>
      );
    }

    const usagePercent = (storage.used / storage.total) * 100;
    let gaugeColor = 'bg-green-500';
    
    if (usagePercent > 90) {
      gaugeColor = 'bg-red-500';
    } else if (usagePercent > 75) {
      gaugeColor = 'bg-yellow-500';
    } else if (usagePercent > 50) {
      gaugeColor = 'bg-blue-500';
    }

    return (
      <div className="w-full h-2 bg-gray-200 rounded-full">
        <div 
          className={`h-full ${gaugeColor} rounded-full transition-all duration-300`}
          style={{ width: `${Math.min(usagePercent, 100)}%` }}
        ></div>
      </div>
    );
  };

  const getStorageText = (remote: string) => {
    const storage = storageInfo[remote];
    if (!storage || storage.error) {
      return 'Storage info unavailable';
    }
    if (!storage.total || !storage.used) {
      return 'Loading storage info...';
    }
    
    const usagePercent = Math.round((storage.used / storage.total) * 100);
    return `${formatBytes(storage.used)} / ${formatBytes(storage.total)} (${usagePercent}%)`;
  };

  const getRemoteTypeColor = (type: string) => {
    const colorMap: {[key: string]: string} = {
      'drive': 'bg-blue-500',
      'onedrive': 'bg-purple-500', 
      's3': 'bg-orange-500',
      'dropbox': 'bg-blue-600',
      'box': 'bg-blue-400',
      'pcloud': 'bg-green-500',
      'mega': 'bg-red-500',
      'ftp': 'bg-yellow-500',
      'sftp': 'bg-gray-500',
      'webdav': 'bg-indigo-500',
      'unknown': 'bg-gray-400'
    };
    return colorMap[type] || colorMap['unknown'];
  };

  const getRemoteTypeLabel = (type: string) => {
    const labelMap: {[key: string]: string} = {
      'drive': 'GDrive',
      'onedrive': 'OneDrive',
      's3': 'S3',
      'dropbox': 'Dropbox', 
      'box': 'Box',
      'pcloud': 'pCloud',
      'mega': 'MEGA',
      'ftp': 'FTP',
      'sftp': 'SFTP',
      'webdav': 'WebDAV',
      'unknown': 'Unknown'
    };
    return labelMap[type] || type.toUpperCase();
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            RRList - Remote Storage Manager
          </h1>
          <p className="text-gray-600">
            {remotes.length} remote{remotes.length !== 1 ? 's' : ''} configured
          </p>
        </div>

        {/* Remote Status Matrix */}
        {!loading && remotes.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Remote Status</h2>
            <div className="relative">
              <div className="grid grid-cols-8 sm:grid-cols-12 md:grid-cols-16 lg:grid-cols-20 gap-2">
                {remotes.map((remote) => {
                  const storage = storageInfo[remote];
                  const remoteType = remoteDetails[remote]?.type || 'unknown';
                  const hasStorageData = storage && !storage.error && storage.total && storage.used;
                  const usagePercent = hasStorageData ? (storage.used! / storage.total!) * 100 : 0;
                  const statusColor = storage?.error ? 'border-red-500' : hasStorageData ? 'border-green-500' : 'border-gray-300';
                  
                  return (
                    <div
                      key={remote}
                      className={`relative aspect-square border-2 ${statusColor} rounded-lg p-1 hover:shadow-md transition-all cursor-pointer group ${getRemoteTypeColor(remoteType)} hover:z-10`}
                      onClick={() => window.location.href = `/${encodeURIComponent(remote)}`}
                      onMouseEnter={(e) => {
                        setHoveredRemote(remote);
                        setMousePosition({ x: e.clientX, y: e.clientY });
                      }}
                      onMouseMove={(e) => {
                        if (hoveredRemote === remote) {
                          setMousePosition({ x: e.clientX, y: e.clientY });
                        }
                      }}
                      onMouseLeave={() => setHoveredRemote(null)}
                    >
                      <div className="flex flex-col items-center justify-center h-full text-white text-xs font-medium">
                        <div className="truncate w-full text-center px-1 leading-tight">
                          {remote}
                        </div>
                        <div className="text-xs opacity-75 mt-1">
                          {getRemoteTypeLabel(remoteType)}
                        </div>
                        
                        {/* Storage usage gauge bar */}
                        {hasStorageData && (
                          <div className="w-full px-1 mt-2">
                            <div className="w-full h-1 bg-white/30 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-500 ${
                                  usagePercent > 90 ? 'bg-red-400' : 
                                  usagePercent > 75 ? 'bg-yellow-400' : 
                                  usagePercent > 50 ? 'bg-blue-400' : 'bg-green-400'
                                }`}
                                style={{ width: `${Math.min(usagePercent, 100)}%` }}
                              ></div>
                            </div>
                            <div className="text-xs opacity-90 mt-1 text-center font-bold">
                              {Math.round(usagePercent)}%
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Status dot */}
                      <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                        storage?.error ? 'bg-red-300' : hasStorageData ? 'bg-green-300' : 'bg-gray-300'
                      }`}></div>
                    </div>
                  );
                })}
              </div>
              
              {/* Hover Card Popup */}
              {hoveredRemote && (
                <div 
                  className="fixed z-50 pointer-events-none"
                  style={{
                    left: `${mousePosition.x + 10}px`,
                    top: `${mousePosition.y + 10}px`,
                    transform: mousePosition.x > window.innerWidth - 320 ? 'translateX(-100%)' : 'none'
                  }}
                >
                  <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 w-80 animate-in fade-in duration-200">
                    {(() => {
                      const storage = storageInfo[hoveredRemote];
                      const remoteType = remoteDetails[hoveredRemote]?.type || 'unknown';
                      const hasStorageData = storage && !storage.error && storage.total && storage.used;
                      const usagePercent = hasStorageData ? (storage.used! / storage.total!) * 100 : 0;
                      
                      return (
                        <>
                          <div className="flex items-center space-x-3 mb-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${getRemoteTypeColor(remoteType)}`}>
                              <span className="text-sm font-bold">
                                {getRemoteTypeLabel(remoteType).substring(0, 2)}
                              </span>
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 text-lg">{hoveredRemote}</div>
                              <div className="text-sm text-gray-500">{getRemoteTypeLabel(remoteType)}</div>
                            </div>
                            
                            {/* Status indicator */}
                            <div className="ml-auto flex items-center space-x-2">
                              <div className={`w-3 h-3 rounded-full ${
                                storage?.error ? 'bg-red-500' : hasStorageData ? 'bg-green-500' : 'bg-gray-400'
                              }`}></div>
                              <span className="text-xs text-gray-500">
                                {storage?.error ? 'Error' : hasStorageData ? 'Connected' : 'Checking...'}
                              </span>
                            </div>
                          </div>
                          
                          {/* Storage Information */}
                          <div className="space-y-3">
                            {storage?.error ? (
                              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                <div className="text-sm text-red-800 font-medium">Connection Error</div>
                                <div className="text-xs text-red-600 mt-1">{storage.error}</div>
                              </div>
                            ) : hasStorageData ? (
                              <>
                                {/* Storage Usage Bar */}
                                <div>
                                  <div className="flex justify-between text-sm mb-2">
                                    <span className="text-gray-600">Storage Usage</span>
                                    <span className="font-medium">{Math.round(usagePercent)}%</span>
                                  </div>
                                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full transition-all duration-300 ${
                                        usagePercent > 90 ? 'bg-red-500' : 
                                        usagePercent > 75 ? 'bg-yellow-500' : 
                                        usagePercent > 50 ? 'bg-blue-500' : 'bg-green-500'
                                      }`}
                                      style={{ width: `${Math.min(usagePercent, 100)}%` }}
                                    ></div>
                                  </div>
                                </div>
                                
                                {/* Storage Details */}
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <div className="text-gray-500">Used</div>
                                    <div className="font-medium">{formatBytes(storage.used)}</div>
                                  </div>
                                  <div>
                                    <div className="text-gray-500">Total</div>
                                    <div className="font-medium">{formatBytes(storage.total)}</div>
                                  </div>
                                  <div>
                                    <div className="text-gray-500">Free</div>
                                    <div className="font-medium">{formatBytes(storage.free || (storage.total! - storage.used!))}</div>
                                  </div>
                                  <div>
                                    <div className="text-gray-500">Type</div>
                                    <div className="font-medium">{getRemoteTypeLabel(remoteType)}</div>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                <div className="text-sm text-gray-600">Loading storage information...</div>
                                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mt-2">
                                  <div className="h-full bg-gray-400 animate-pulse"></div>
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Remote Storage Details */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Remote Storage Details</h2>
            </div>
            <div>
              <button
                onClick={fetchRemotes}
                disabled={loading}
                className="bg-gray-500 hover:bg-gray-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded transition-colors"
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
          
          {loading && (
            <div className="text-gray-500">Loading remotes...</div>
          )}
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              Error: {error}
            </div>
          )}
          
          {!loading && !error && remotes.length === 0 && (
            <div className="text-gray-500">
              No remote storage configured. Check your rclone configuration.
            </div>
          )}
          
          {!loading && remotes.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {remotes.map((remote) => {
                const storage = storageInfo[remote];
                const remoteType = remoteDetails[remote]?.type || 'unknown';
                const hasStorageData = storage && !storage.error && storage.total && storage.used;
                
                return (
                  <a
                    key={remote}
                    href={`/${encodeURIComponent(remote)}`}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer block bg-white"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${getRemoteTypeColor(remoteType)}`}>
                          <span className="text-xs font-bold">
                            {getRemoteTypeLabel(remoteType).substring(0, 2)}
                          </span>
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{remote}</div>
                          <div className="text-xs text-gray-500">{getRemoteTypeLabel(remoteType)}</div>
                        </div>
                      </div>
                      
                      {/* Status indicator */}
                      <div className="flex items-center space-x-1">
                        {storage?.error ? (
                          <div className="w-2 h-2 bg-red-500 rounded-full" title={`Error: ${storage.error}`}></div>
                        ) : hasStorageData ? (
                          <div className="w-2 h-2 bg-green-500 rounded-full" title="Connected"></div>
                        ) : (
                          <div className="w-2 h-2 bg-gray-400 rounded-full" title="Checking..."></div>
                        )}
                      </div>
                    </div>
                    
                    {/* Storage info */}
                    <div className="space-y-2">
                      {getStorageGauge(remote)}
                      <div className="text-xs text-gray-600">
                        {getStorageText(remote)}
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>RRList v0.1.0 - Built with Next.js 15, TypeScript, and Tailwind CSS</p>
          <p className="mt-1">
            <span className="mx-2">&bull;</span>
            <strong>rclone</strong> for cloud storage management
            <span className="mx-2">&bull;</span>
            <strong>restic</strong> for backup solutions
            <span className="mx-2">&bull;</span>
          </p>
        </div>
      </div>
    </main>
  )
}