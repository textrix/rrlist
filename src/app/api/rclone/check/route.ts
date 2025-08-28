import { NextRequest, NextResponse } from 'next/server';

const RCLONE_RC_URL = process.env.RCLONE_RC_URL || 'http://127.0.0.1:5572';

export async function POST(request: NextRequest) {
  let remote = '';
  
  try {
    const body = await request.json();
    remote = body.remote;
    
    if (!remote) {
      return NextResponse.json({ 
        error: 'Remote parameter is required',
        success: false 
      }, { status: 400 });
    }

    console.log(`Checking health for remote: ${remote}`);

    // Use rclone's about command to check if remote is accessible
    const response = await fetch(`${RCLONE_RC_URL}/operations/about`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fs: `${remote}:`
      }),
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Check for token expiration
      if (response.status === 500 && errorData.error && 
          (errorData.error.includes('invalid_grant') || 
           errorData.error.includes('token expired') ||
           errorData.error.includes("couldn't fetch token"))) {
        return NextResponse.json({
          success: false,
          status: 'token_expired',
          error: 'Authentication token expired',
          remote
        });
      }
      
      return NextResponse.json({
        success: false,
        status: 'error',
        error: `Failed to check remote: ${errorData.error || response.statusText}`,
        remote
      }, { status: response.status });
    }

    const data = await response.json();
    
    console.log(`Remote ${remote} is healthy`);
    return NextResponse.json({
      success: true,
      status: 'healthy',
      remote,
      data: {
        total: data.total,
        used: data.used,
        free: data.free
      }
    });

  } catch (error) {
    console.error('Health check failed:', error);
    
    // Handle timeout errors specifically
    let errorMessage = 'Health check failed';
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
        errorMessage = 'Remote connection timeout';
        statusCode = 408;
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Cannot connect to rclone daemon';
        statusCode = 503;
      } else {
        errorMessage = error.message;
      }
    }
    
    return NextResponse.json({
      success: false,
      status: 'error',
      error: errorMessage,
      remote
    }, { status: statusCode });
  }
}