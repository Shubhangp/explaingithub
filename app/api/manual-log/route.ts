import { logUserChatQuestion } from '@/app/lib/google-sheets';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const searchParams = new URL(req.url).searchParams;
    const message = searchParams.get('message') || 'Test message from manual logger';
    const email = searchParams.get('email') || 'test@example.com';
    
    console.log('🧪 Manual logger: Logging message for', email);
    
    const result = await logUserChatQuestion({
      email,
      question: message
    });
    
    return NextResponse.json({
      success: true,
      message: 'Manual logger executed successfully',
      result
    });
  } catch (error) {
    console.error('Manual logger error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
} 