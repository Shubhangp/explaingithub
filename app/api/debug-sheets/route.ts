import { NextResponse } from 'next/server';
import { logUserChatQuestion } from '@/app/lib/google-sheets';

export async function GET() {
  try {
    console.log('DEBUG: Testing direct chat logging');
    
    // Test direct logging (this happens on server side)
    const result = await logUserChatQuestion({
      email: 'debug-test@example.com',
      question: 'This is a debug test at ' + new Date().toISOString()
    });
    
    return NextResponse.json({
      success: result.success,
      message: 'Debug test completed',
      result
    });
  } catch (error) {
    console.error('DEBUG: Error testing chat logging:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to test chat logging',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 