import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const RCLONE_RC_URL = process.env.RCLONE_RC_URL || 'http://127.0.0.1:5572';

export async function GET(request: NextRequest) {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const remote = searchParams.get('remote');
  const path = searchParams.get('path');

  if (!remote || !path) {
    return NextResponse.json(
      { error: 'Remote and path parameters are required' },
      { status: 400 }
    );
  }

  console.log(`Download request: remote=${remote}, path=${path}`);
  
  try {
    // Direct download using standard rclone RC serve format
    const cleanPath = path.replace(/^\/+/, ''); // Remove leading slashes
    const downloadUrl = `${RCLONE_RC_URL}/[${remote}:]/${encodeURI(cleanPath)}`;
    
    console.log(`Attempting download: ${downloadUrl}`);
    
    const response = await fetch(downloadUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(30000), // 30초 타임아웃
    });
    
    if (response.ok && response.body) {
      const filename = path.split('/').pop() || 'download';
      const contentLength = response.headers.get('content-length');
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      
      console.log(`✅ Download successful: ${downloadUrl}`);
      
      const headers = {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'no-cache',
      };
      
      if (contentLength) {
        headers['Content-Length'] = contentLength;
      }
      
      return new Response(response.body, {
        status: 200,
        headers,
      });
    }

    console.log(`❌ Download failed (${response.status}): ${downloadUrl}`);
    
    // Return error with response details
    const filename = path.split('/').pop() || 'download';
    
    return NextResponse.json(
      { 
        error: 'File not found or not accessible',
        details: `HTTP ${response.status}: ${response.statusText}`,
        filename: filename,
        remote: remote,
        path: path
      },
      { status: response.status === 404 ? 404 : 500 }
    );
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Failed to download file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}