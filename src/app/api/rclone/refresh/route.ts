import { NextRequest, NextResponse } from 'next/server';

const RCLONE_RC_URL = process.env.RCLONE_RC_URL || 'http://127.0.0.1:5572';

export async function POST(request: NextRequest) {
  try {
    const { remote } = await request.json();
    
    if (!remote) {
      return NextResponse.json({ 
        error: 'Remote parameter is required',
        success: false 
      }, { status: 400 });
    }

    console.log(`Attempting to refresh token for remote: ${remote}`);

    // Use core/command to run config reconnect command
    const response = await fetch(`${RCLONE_RC_URL}/core/command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        command: 'config',
        arg: ['reconnect', `${remote}:`],
        opt: {
          'config': '/config/rclone.conf',
          'non-interactive': 'true'
        }
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Token refresh failed: ${response.status} - ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    
    console.log(`Successfully cleared fs cache, forcing token refresh for ${remote}`);
    return NextResponse.json({ 
      success: true,
      message: `Cleared connection cache - please try accessing ${remote} again`,
      data
    });

  } catch (error) {
    console.error('Token refresh failed:', error);
    
    return NextResponse.json({ 
      error: 'Token refresh failed',
      success: false,
      details: error instanceof Error ? error.message : 'Unknown error',
      suggestion: 'You may need to re-authenticate this remote manually'
    }, { 
      status: 500 
    });
  }
}