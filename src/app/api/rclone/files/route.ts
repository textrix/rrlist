import { NextRequest, NextResponse } from 'next/server';

const RCLONE_RC_URL = process.env.RCLONE_RC_URL || 'http://127.0.0.1:5572';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const remote = searchParams.get('remote');
  const path = searchParams.get('path') || '';

  if (!remote) {
    return NextResponse.json({ 
      error: 'Remote parameter is required',
      success: false 
    }, { status: 400 });
  }

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Listing files for ${remote}:${path} (attempt ${attempt}/${maxRetries})`);
      
      const remotePath = path ? `${remote}:${path}` : `${remote}:`;
      const response = await fetch(`${RCLONE_RC_URL}/operations/list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fs: remotePath,
          remote: '',
          opt: {
            recurse: false,
            noModTime: false,
            showEncrypted: false,
            showOrigIDs: false,
            showHash: false
          }
        }),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Check for token expiration
        if (response.status === 500 && errorData.error && 
            (errorData.error.includes('invalid_grant') || 
             errorData.error.includes('token expired') ||
             errorData.error.includes("couldn't fetch token"))) {
          throw new Error(`EXPIRED_TOKEN:${errorData.error}`);
        }
        
        throw new Error(`rclone RC API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const files = data.list || [];

      console.log(`Successfully retrieved ${files.length} files`);
      return NextResponse.json({ 
        files,
        remote,
        path,
        success: true 
      });
    } catch (error) {
      lastError = error as Error;
      console.error(`Attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  console.error('All retry attempts failed:', lastError);
  
  // Check if it's a token expiration error
  const isTokenExpired = lastError?.message?.includes('EXPIRED_TOKEN');
  
  return NextResponse.json({ 
    error: isTokenExpired ? 'Authentication token expired' : 'Failed to list files',
    files: [],
    success: false,
    details: lastError?.message || 'Unknown error',
    tokenExpired: isTokenExpired,
    remote: remote
  }, { 
    status: isTokenExpired ? 401 : 500
  });
}