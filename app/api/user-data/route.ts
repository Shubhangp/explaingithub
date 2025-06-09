import { NextResponse } from 'next/server';
import { saveToSpreadsheet } from '@/app/utils/spreadsheet';

export async function POST(request: Request) {
  try {
    const userData = await request.json();
    
    if (!process.env.GOOGLE_SHEETS_CLIENT_EMAIL || !process.env.GOOGLE_SHEETS_PRIVATE_KEY || !process.env.GOOGLE_SHEETS_ID) {
      console.error('Missing required Google Sheets environment variables');
      return NextResponse.json(
        { error: 'Google Sheets configuration is missing' },
        { status: 500 }
      );
    }

    const success = await saveToSpreadsheet(userData);
    
    if (!success) {
      console.error('Failed to save data to Google Sheets');
      return NextResponse.json(
        { error: 'Failed to save user data to spreadsheet' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in user-data API route:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
} 