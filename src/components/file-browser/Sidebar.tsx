'use client';

import { useState, useEffect } from 'react';

interface RemoteHealth {
  [remote: string]: {
    status: 'healthy' | 'token_expired' | 'error' | 'checking';
    error?: string;
  };
}

interface RemoteStorage {
  [remote: string]: {
    total?: number;
    used?: number;
    free?: number;
    loading: boolean;
    error?: string;
  };
}

interface StorageAPIResponse {
  success: boolean;
  data: {
    [remote: string]: {
      total?: number;
      used?: number;
      free?: number;
      lastUpdated: number;
      error?: string;
    };
  };
  lastUpdated: number | null;
}

interface SidebarProps {
  remotes: string[];
  selectedRemote: string | null;
  onRemoteSelect: (remote: string) => void;
  recentRemotes?: string[];
}

export default function Sidebar({ 
  remotes, 
  selectedRemote, 
  onRemoteSelect, 
  recentRemotes = [] 
}: SidebarProps) {
  const [healthStatus, setHealthStatus] = useState<RemoteHealth>({});
  const [storageStatus, setStorageStatus] = useState<RemoteStorage>({});
  const [refreshTimer, setRefreshTimer] = useState<NodeJS.Timeout | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  const updateStorageFromServerData = (serverData: any) => {
    // Convert server data to client format
    const newStorageStatus: RemoteStorage = {};
    
    Object.entries(serverData).forEach(([remote, storageData]: [string, any]) => {
      newStorageStatus[remote] = {
        total: storageData.total,
        used: storageData.used,
        free: storageData.free,
        loading: false,
        error: storageData.error
      };
    });
    
    // Add any missing remotes as loading
    remotes.forEach(remote => {
      if (!newStorageStatus[remote]) {
        newStorageStatus[remote] = { loading: true };
      }
    });
    
    setStorageStatus(newStorageStatus);
    setLastFetchTime(Date.now());
  };

  const setupSSEConnection = () => {
    if (eventSource) {
      eventSource.close();
    }

    const es = new EventSource('/api/rclone/storage/stream');
    
    es.onopen = () => {
      console.log('SSE connection established');
    };
    
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'initial' || data.type === 'update') {
          console.log('Received storage update:', data.type);
          updateStorageFromServerData(data.data);
        } else if (data.type === 'heartbeat') {
          // Just keep the connection alive
          console.log('SSE heartbeat received');
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };
    
    es.onerror = (error) => {
      console.error('SSE connection error:', error);
      es.close();
      
      // Retry connection after 5 seconds
      setTimeout(() => {
        if (remotes.length > 0) {
          setupSSEConnection();
        }
      }, 5000);
    };
    
    setEventSource(es);
    return es;
  };

  // Fallback polling in case SSE fails
  const setupFallbackPolling = () => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
    
    const timer = setTimeout(async () => {
      // Only use fallback if SSE is not connected
      if (!eventSource || eventSource.readyState !== EventSource.OPEN) {
        try {
          const response = await fetch('/api/rclone/storage');
          const data: StorageAPIResponse = await response.json();
          if (data.success && data.data) {
            updateStorageFromServerData(data.data);
          }
        } catch (error) {
          console.error('Fallback polling failed:', error);
        }
      }
      setupFallbackPolling(); // Schedule next fallback check
    }, 10000); // Fallback every 10 seconds
    
    setRefreshTimer(timer);
  };

  // Initialize SSE connection and fallback polling
  useEffect(() => {
    if (remotes.length > 0) {
      // Set loading state for all remotes
      const initialStatus: RemoteStorage = {};
      remotes.forEach(remote => {
        initialStatus[remote] = { loading: true };
      });
      setStorageStatus(initialStatus);
      
      // Setup SSE connection for real-time updates
      setupSSEConnection();
      
      // Setup fallback polling
      setupFallbackPolling();
    }
    
    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [remotes]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSource) {
        console.log('Closing SSE connection on unmount');
        eventSource.close();
      }
    };
  }, [eventSource]);

  const handleRemoteClick = (remote: string) => {
    onRemoteSelect(remote);
  };

  const getStorageGauge = (remote: string) => {
    const storage = storageStatus[remote];
    if (!storage || storage.loading || storage.error || !storage.total || !storage.used) {
      if (storage?.loading) {
        return (
          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-gray-400 animate-pulse"></div>
          </div>
        );
      }
      if (storage?.error) {
        return (
          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-red-300"></div>
          </div>
        );
      }
      return null;
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
      <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={`h-full ${gaugeColor} transition-all duration-300`}
          style={{ width: `${Math.min(usagePercent, 100)}%` }}
        ></div>
      </div>
    );
  };

  const formatStorageInfo = (remote: string) => {
    const storage = storageStatus[remote];
    if (!storage || storage.loading) {
      return 'Loading...';
    }
    if (storage.error) {
      return 'Error: ' + storage.error;
    }
    if (!storage.total || !storage.used) {
      return 'No data';
    }

    const formatBytes = (bytes: number) => {
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      if (bytes === 0) return '0 B';
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    };

    const usagePercent = Math.round((storage.used / storage.total) * 100);
    return `${formatBytes(storage.used)} / ${formatBytes(storage.total)} (${usagePercent}%)`;
  };

  const getStatusIcon = (remote: string) => {
    const health = healthStatus[remote];
    if (!health) return null;

    switch (health.status) {
      case 'healthy':
        return (
          <div className="w-2 h-2 bg-green-500 rounded-full" title="Remote is healthy" />
        );
      case 'token_expired':
        return (
          <div className="w-2 h-2 bg-yellow-500 rounded-full" title="Token expired" />
        );
      case 'error':
        return (
          <div className="w-2 h-2 bg-red-500 rounded-full" title={`Error: ${health.error}`} />
        );
      case 'checking':
        return (
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" title="Checking..." />
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-4 h-full">
      {/* Recent/Favorites */}
      {recentRemotes.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Recent</h3>
          <div className="space-y-1">
            {recentRemotes.slice(0, 5).map((remote) => (
              <button
                key={remote}
                onClick={() => handleRemoteClick(remote)}
                className={`w-full text-left px-3 py-3 rounded-lg text-sm transition-colors ${
                  selectedRemote === remote
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <div className="w-full">
                  <div className="flex items-center space-x-2 mb-1">
                    <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                    </svg>
                    <span className="font-medium">{remote}</span>
                  </div>
                  {getStorageGauge(remote)}
                  <div className="text-xs text-gray-500 mt-1 truncate" title={formatStorageInfo(remote)}>
                    {formatStorageInfo(remote)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* All Remotes */}
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-3">
          All Remotes ({remotes.length})
        </h3>
        {remotes.length === 0 ? (
          <div className="text-gray-500 text-sm py-2">
            No remotes available or loading...
          </div>
        ) : (
          <div className="space-y-1">
            {remotes.map((remote) => (
              <button
                key={remote}
                onClick={() => handleRemoteClick(remote)}
                className={`w-full text-left px-3 py-3 rounded-lg text-sm transition-colors ${
                  selectedRemote === remote
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <div className="w-full">
                  <div className="flex items-center space-x-2 mb-1">
                    <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                    </svg>
                    <span className="truncate font-medium">{remote}</span>
                  </div>
                  {getStorageGauge(remote)}
                  <div className="text-xs text-gray-500 mt-1 truncate" title={formatStorageInfo(remote)}>
                    {formatStorageInfo(remote)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}