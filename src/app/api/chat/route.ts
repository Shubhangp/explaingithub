import { NextResponse } from 'next/server'

/**
 * Redirects to the centralized API endpoint in app/api/chat/route.ts
 * This ensures we have a single source of truth for OpenAI interactions
 */
export async function POST(req: Request) {
  try {
    // Get the request body
    const body = await req.json();
    
    // Forward to the main API endpoint
    const response = await fetch(new URL('/api/chat', req.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    // Get the response data
    const data = await response.json();
    
    // Return the response
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('API Redirect Error:', error);
    return NextResponse.json(
      { error: 'Failed to redirect to main API endpoint', details: error.message },
      { status: 500 }
    );
  }
} 