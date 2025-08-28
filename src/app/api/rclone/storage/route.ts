import { NextResponse } from 'next/server';

const RCLONE_RC_URL = process.env.RCLONE_RC_URL || 'http://127.0.0.1:5572';

// In-memory cache for storage data (shared globally)
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

// Use global state to share with SSE endpoint
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
    
    // Schedule next run in 5 minutes
    if (global.backgroundJobTimer) {
      clearTimeout(global.backgroundJobTimer);
    }
    global.backgroundJobTimer = setTimeout(runStorageCheckJob, 300000);
  }
}

// Start background job if not already running
function startBackgroundJob() {
  if (!global.backgroundJobTimer) {
    console.log('Starting storage monitoring background job...');
    runStorageCheckJob(); // Run immediately
  }
}

// GET endpoint to retrieve cached storage data
export async function GET() {
  try {
    // Start background job if not running
    startBackgroundJob();

    // Return cached data
    const response = {
      success: true,
      data: global.storageCache || {},
      lastUpdated: Object.keys(global.storageCache || {}).length > 0 
        ? Math.min(...Object.values(global.storageCache || {}).map(d => d.lastUpdated))
        : null
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Storage API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get storage data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST endpoint to trigger immediate refresh
export async function POST() {
  try {
    // Trigger immediate background job
    if (global.backgroundJobTimer) {
      clearTimeout(global.backgroundJobTimer);
      global.backgroundJobTimer = null;
    }
    
    // Run job in background (don't await)
    runStorageCheckJob();
    
    return NextResponse.json({
      success: true,
      message: 'Storage refresh triggered'
    });
  } catch (error) {
    console.error('Storage refresh error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to trigger storage refresh',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}