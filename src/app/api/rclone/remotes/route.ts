import { NextResponse } from 'next/server';

const RCLONE_RC_URL = process.env.RCLONE_RC_URL || 'http://127.0.0.1:5572';

export async function GET() {
  // Retry logic for rclone RC connection
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to connect to rclone RC (attempt ${attempt}/${maxRetries})`);
      
      // Use rclone RC API to list remotes
      const response = await fetch(`${RCLONE_RC_URL}/config/listremotes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) {
        throw new Error(`rclone RC API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const remotes = data.remotes || [];

      // Get remote types/providers
      const remoteDetails: {[key: string]: {name: string, type: string}} = {};
      
      for (const remote of remotes) {
        try {
          const configResponse = await fetch(`${RCLONE_RC_URL}/config/get`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: remote }),
            signal: AbortSignal.timeout(3000),
          });
          
          if (configResponse.ok) {
            const configData = await configResponse.json();
            const type = configData.type || 'unknown';
            remoteDetails[remote] = { name: remote, type };
          } else {
            remoteDetails[remote] = { name: remote, type: 'unknown' };
          }
        } catch (error) {
          console.error(`Failed to get config for ${remote}:`, error);
          remoteDetails[remote] = { name: remote, type: 'unknown' };
        }
      }

      console.log(`Successfully retrieved ${remotes.length} remotes with types`);
      return NextResponse.json({ 
        remotes,
        remoteDetails,
        success: true 
      });
    } catch (error) {
      lastError = error as Error;
      console.error(`Attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  
  console.error('All retry attempts failed:', lastError);
  return NextResponse.json({ 
    error: 'Failed to connect to rclone RC daemon',
    remotes: [],
    success: false,
    details: lastError?.message || 'Unknown error',
    suggestion: 'Check if rclone RC daemon is running and accessible'
  }, { 
    status: 500 
  });
}