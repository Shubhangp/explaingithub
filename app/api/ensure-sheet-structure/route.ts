import { NextResponse } from 'next/server';
import { ensureSheet1Exists } from '@/app/lib/google-sheets';

export async function GET() {
  try {
    const result = await ensureSheet1Exists();
    
    if (result.success) {
      return NextResponse.json({ 
        success: true,
        message: 'Sheet1 structure has been verified or created'
      });
    } else {
      return NextResponse.json(
        { 
          success: false,
          error: result.error instanceof Error ? result.error.message : String(result.error)
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error ensuring Sheet1 structure:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 