// Background storage monitoring service
// This module starts storage monitoring automatically when imported

const RCLONE_RC_URL = process.env.RCLONE_RC_URL || 'http://127.0.0.1:5572';
const STORAGE_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const STARTUP_DELAY = 10 * 1000; // 10 seconds delay after server start

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

// Use global state to share with API endpoints
declare global {
  var storageCache: StorageCache | undefined;
  var storageSubscribers: Set<(data: StorageCache) => void> | undefined;
  var backgroundJobRunning: boolean | undefined;
  var backgroundJobTimer: NodeJS.Timeout | null | undefined;
  var backgroundJobInitialized: boolean | undefined;
}

// Initialize global state
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
    console.log('Background storage job already running, skipping...');
    return;
  }

  console.log('🔄 Starting background storage check job...');
  global.backgroundJobRunning = true;

  try {
    const remotes = await getRemotesList();
    if (remotes.length === 0) {
      console.log('📝 No remotes configured, skipping storage check');
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
            console.log(`❌ Storage check failed for ${remote}: ${data.error}`);
          } else {
            const usedGB = data.used ? (data.used / (1024**3)).toFixed(2) : 'unknown';
            const totalGB = data.total ? (data.total / (1024**3)).toFixed(2) : 'unknown';
            console.log(`✅ Storage check completed for ${remote}: ${usedGB}GB/${totalGB}GB used`);
          }
        } else {
          console.error(`❌ Storage check rejected for ${remote}:`, result.reason);
        }
      });
    }

    // Notify subscribers only if there are updates
    if (hasUpdates) {
      console.log('📡 Storage data updated, notifying subscribers...');
      notifySubscribers();
    }

    console.log(`🎉 Background storage check completed for ${remotes.length} remotes`);
  } catch (error) {
    console.error('❌ Background storage check job failed:', error);
  } finally {
    global.backgroundJobRunning = false;
    
    // Schedule next run
    if (global.backgroundJobTimer) {
      clearTimeout(global.backgroundJobTimer);
    }
    global.backgroundJobTimer = setTimeout(() => {
      console.log(`⏰ Scheduled storage check starting (${new Date().toLocaleTimeString()})...`);
      runStorageCheckJob();
    }, STORAGE_CHECK_INTERVAL);
    
    console.log(`⏰ Next storage check scheduled in ${STORAGE_CHECK_INTERVAL / 60000} minutes`);
  }
}

// Initialize background job on server startup  
async function initializeBackgroundJob() {
  if (global.backgroundJobInitialized) {
    return;
  }
  
  global.backgroundJobInitialized = true;
  
  console.log(`🚀 Initializing background storage monitoring (delay: ${STARTUP_DELAY/1000}s)...`);
  
  // Wait for rclone daemon to be ready, then start immediately
  setTimeout(async () => {
    let retryCount = 0;
    const maxRetries = 6; // 6 attempts = 1 minute
    
    const tryStartJob = async () => {
      try {
        // Check if rclone daemon is responding
        const healthCheck = await fetch(`${RCLONE_RC_URL}/core/version`, {
          method: 'POST',
          signal: AbortSignal.timeout(5000),
        });
        
        if (healthCheck.ok) {
          console.log('✅ rclone daemon is ready, starting storage monitoring...');
          runStorageCheckJob(); // Start immediately without waiting for requests
        } else {
          throw new Error(`Health check failed: ${healthCheck.status}`);
        }
      } catch (error) {
        retryCount++;
        console.log(`⚠️ rclone daemon check attempt ${retryCount}/${maxRetries} failed:`, error instanceof Error ? error.message : 'Unknown error');
        
        if (retryCount < maxRetries) {
          setTimeout(tryStartJob, 10000); // Retry in 10 seconds
        } else {
          console.log('❌ Failed to start background storage monitoring after maximum retries');
        }
      }
    };
    
    tryStartJob();
  }, STARTUP_DELAY);
}

// Auto-start the background job when this module is imported
initializeBackgroundJob();

// Export functions for use by API endpoints
export { runStorageCheckJob, notifySubscribers };
export type { StorageCache, StorageData };