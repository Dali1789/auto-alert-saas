import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV,
      uptime: process.uptime(),
      api: {
        backend: process.env.NEXT_PUBLIC_API_URL,
        websocket: process.env.NEXT_PUBLIC_WS_URL,
      },
      features: {
        voiceAlerts: process.env.NEXT_PUBLIC_ENABLE_VOICE_ALERTS === 'true',
        analytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
        notifications: process.env.NEXT_PUBLIC_ENABLE_NOTIFICATIONS === 'true',
      }
    };

    return NextResponse.json(healthData, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Health check error:', error);
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Internal server error',
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  }
}

export async function HEAD(request: NextRequest) {
  return new NextResponse(null, { status: 200 });
}