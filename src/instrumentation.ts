// This file is automatically loaded by Next.js when the server starts
// Perfect place to initialize background services

export async function register() {
  // Only run in Node.js environment (server-side)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('🔧 Server instrumentation: Initializing background services...');
    
    // Import and initialize background storage monitoring
    // This will start the background job automatically
    await import('./lib/background-storage');
    
    console.log('✅ Server instrumentation: Background services initialized');
  }
}