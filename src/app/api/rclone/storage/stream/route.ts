import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const RCLONE_RC_URL = process.env.RCLONE_RC_URL || 'http://127.0.0.1:5572';

// Shared storage cache and subscribers
interface StorageData {
  total?: number;
  used?: number;
  free?: number;
  lastUpdated: number;
  error?: string;
}

interface StorageCache {
  [remote: string]: StorageData;
}

// Global state shared with the main storage API
declare global {
  var storageCache: StorageCache | undefined;
  var storageSubscribers: Set<(data: StorageCache) => void> | undefined;
  var backgroundJobRunning: boolean | undefined;
  var backgroundJobTimer: NodeJS.Timeout | null | undefined;
}

if (!global.storageCache) {
  global.storageCache = {};
}

if (!global.storageSubscribers) {
  global.storageSubscribers = new Set();
}

// Check storage for a single remote
async function checkRemoteStorage(remote: string): Promise<StorageData> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`${RCLONE_RC_URL}/operations/about`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fs: `${remote}:`
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API error: ${response.status} - ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    
    return {
      total: data.total,
      used: data.used,
      free: data.free,
      lastUpdated: Date.now()
    };
  } catch (error) {
    console.error(`Storage check failed for ${remote}:`, error);
    return {
      lastUpdated: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Get list of all remotes
async function getRemotesList(): Promise<string[]> {
  try {
    const response = await fetch(`${RCLONE_RC_URL}/config/listremotes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Failed to get remotes list: ${response.status}`);
    }

    const data = await response.json();
    return data.remotes || [];
  } catch (error) {
    console.error('Failed to get remotes list:', error);
    return [];
  }
}

// Notify all subscribers about cache updates
function notifySubscribers() {
  if (global.storageSubscribers && global.storageCache) {
    global.storageSubscribers.forEach(callback => {
      try {
        callback(global.storageCache!);
      } catch (error) {
        console.error('Error notifying subscriber:', error);
      }
    });
  }
}

// Background job to check all remotes storage
async function runStorageCheckJob() {
  if (global.backgroundJobRunning) {
    return;
  }

  console.log('Starting background storage check job...');
  global.backgroundJobRunning = true;

  try {
    const remotes = await getRemotesList();
    if (remotes.length === 0) {
      console.log('No remotes found, skipping storage check');
      return;
    }

    const concurrentLimit = 5;
    const remotesToCheck = [...remotes];
    let hasUpdates = false;
    
    while (remotesToCheck.length > 0) {
      const batch = remotesToCheck.splice(0, concurrentLimit);
      const results = await Promise.allSettled(
        batch.map(async (remote) => {
          const result = await checkRemoteStorage(remote);
          
          // Check if data actually changed
          const oldData = global.storageCache![remote];
          const hasChanged = !oldData || 
            oldData.total !== result.total ||
            oldData.used !== result.used ||
            oldData.error !== result.error;
          
          if (hasChanged) {
            global.storageCache![remote] = result;
            hasUpdates = true;
          }
          
          return { remote, result };
        })
      );
      
      // Log results for debugging
      results.forEach((result, index) => {
        const remote = batch[index];
        if (result.status === 'fulfilled') {
          const data = result.value.result;
          if (data.error) {
            console.log(`Storage check failed for ${remote}: ${data.error}`);
          } else {
            console.log(`Storage check completed for ${remote}: ${data.used}/${data.total}`);
          }
        } else {
          console.error(`Storage check rejected for ${remote}:`, result.reason);
        }
      });
    }

    // Notify subscribers only if there are updates
    if (hasUpdates) {
      console.log('Storage data updated, notifying subscribers...');
      notifySubscribers();
    }

    console.log(`Background storage check completed for ${remotes.length} remotes`);
  } catch (error) {
    console.error('Background storage check job failed:', error);
  } finally {
    global.backgroundJobRunning = false;
    
    // Schedule next run in 1 minute
    if (global.backgroundJobTimer) {
      clearTimeout(global.backgroundJobTimer);
    }
    global.backgroundJobTimer = setTimeout(runStorageCheckJob, 60000);
  }
}

// Start background job if not already running
function startBackgroundJob() {
  if (!global.backgroundJobTimer) {
    console.log('Starting storage monitoring background job...');
    runStorageCheckJob(); // Run immediately
  }
}

// SSE endpoint for real-time storage updates
export async function GET(request: NextRequest) {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  console.log('New SSE connection established');

  // Start background job if not running
  startBackgroundJob();

  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      // Send initial data immediately
      const initialData = {
        type: 'initial',
        data: global.storageCache || {},
        timestamp: Date.now()
      };
      
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(initialData)}\n\n`)
      );

      // Subscribe to storage updates
      const handleStorageUpdate = (updatedCache: StorageCache) => {
        const updateData = {
          type: 'update',
          data: updatedCache,
          timestamp: Date.now()
        };
        
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(updateData)}\n\n`)
          );
        } catch (error) {
          console.log('SSE connection closed:', error);
          // Remove subscriber if connection is closed
          if (global.storageSubscribers) {
            global.storageSubscribers.delete(handleStorageUpdate);
          }
        }
      };

      // Add to subscribers
      if (global.storageSubscribers) {
        global.storageSubscribers.add(handleStorageUpdate);
      }

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`)
          );
        } catch (error) {
          console.log('Heartbeat failed, cleaning up:', error);
          clearInterval(heartbeatInterval);
          if (global.storageSubscribers) {
            global.storageSubscribers.delete(handleStorageUpdate);
          }
        }
      }, 30000);

      // Cleanup on connection close
      request.signal?.addEventListener('abort', () => {
        console.log('SSE connection aborted');
        clearInterval(heartbeatInterval);
        if (global.storageSubscribers) {
          global.storageSubscribers.delete(handleStorageUpdate);
        }
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
}