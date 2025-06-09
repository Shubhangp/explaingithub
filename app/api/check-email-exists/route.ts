import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// Support for GET requests (for easier debugging)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    return await checkEmailExists(email);
  } catch (error) {
    console.error('Error in GET check-email-exists:', error);
    return NextResponse.json({ error: 'Failed to check if email exists' }, { status: 500 });
  }
}

// Original POST handler
export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    return await checkEmailExists(email);
  } catch (error) {
    console.error('Error in POST check-email-exists:', error);
    return NextResponse.json({ error: 'Failed to check if email exists' }, { status: 500 });
  }
}

// Shared function to check email existence
async function checkEmailExists(email: string) {
  console.log(`Checking if email exists during sign-in: ${email}`);

  // Initialize Google Sheets
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

  if (!spreadsheetId) {
    console.error('Google Sheets ID not configured');
    return NextResponse.json({ error: 'Google Sheets configuration is missing' }, { status: 500 });
  }

  // Check if the email exists in Sheet1, column B (which contains emails)
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Sheet1!B:B', // Column B contains emails
  });

  const rows = response.data.values || [];
  const exists = rows.some((row) => row[0] === email);

  console.log(`Email ${email} exists in Sheet1: ${exists}`);
  
  return NextResponse.json({ exists });
} 