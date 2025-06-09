import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/options';

export async function GET() {
  try {
    // Get the current session
    const session = await getServerSession(authOptions);
    
    // Check if the user is signed in
    if (!session || !session.user) {
      return NextResponse.json({ 
        error: 'User not signed in',
        accessToken: null,
      }, { status: 401 });
    }
    
    // Check if email exists in the session
    if (!session.user.email) {
      return NextResponse.json({ 
        error: 'No email in session',
        accessToken: null,
      }, { status: 400 });
    }
    
    const email = session.user.email;
    
    if (!process.env.GOOGLE_SHEETS_CLIENT_EMAIL || 
        !process.env.GOOGLE_SHEETS_PRIVATE_KEY || 
        !process.env.GOOGLE_SHEETS_ID) {
      console.error('Missing required Google Sheets environment variables');
      return NextResponse.json(
        { error: 'Google Sheets configuration is missing' },
        { status: 500 }
      );
    }

    // Initialize Google Sheets
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    // Find the user's row by email
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: 'Sheet1!A:H',
    });
    
    const rows = response.data.values || [];
    let accessToken = null;
    
    for (let i = 0; i < rows.length; i++) {
      // Check if the second column (index 1) contains the email
      if (rows[i][1] === email) {
        // Access token is in column H (index 7)
        accessToken = rows[i][7];
        break;
      }
    }
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access token not found for user', accessToken: null },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      accessToken,
      success: true 
    });
  } catch (error) {
    console.error('Error retrieving access token:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error', accessToken: null },
      { status: 500 }
    );
  }
} 