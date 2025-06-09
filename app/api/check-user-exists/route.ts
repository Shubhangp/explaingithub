import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
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
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

    // Check if the email exists in the Sheet1
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!B:B', // Column B contains emails
    });

    const rows = response.data.values || [];
    const exists = rows.some((row) => row[0] === email);

    console.log(`Checking if email ${email} exists in Sheet1: ${exists}`);
    
    return NextResponse.json({ exists });
  } catch (error) {
    console.error('Error checking if user exists:', error);
    return NextResponse.json({ error: 'Failed to check if user exists' }, { status: 500 });
  }
} 