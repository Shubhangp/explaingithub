import { NextResponse } from 'next/server'
import { google } from 'googleapis'

// Define interface for the write result
interface WriteResult {
  success: boolean;
  message: string;
  error?: string; // Making error optional with ?
}

export async function GET(request: Request) {
  console.log('test-sheets API called');
  
  try {
    // Initialize the Google Sheets API client
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    // Log environment variables (without revealing sensitive data)
    console.log('Environment check:', {
      hasClientEmail: !!process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      hasPrivateKey: !!process.env.GOOGLE_SHEETS_PRIVATE_KEY,
      hasSheetId: !!process.env.GOOGLE_SHEETS_ID,
      clientEmailPreview: process.env.GOOGLE_SHEETS_CLIENT_EMAIL 
        ? `${process.env.GOOGLE_SHEETS_CLIENT_EMAIL.substring(0, 5)}...` 
        : null,
      privateKeyLength: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.length || 0,
    });
    
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    
    if (!spreadsheetId) {
      throw new Error('Google Sheets ID not configured');
    }

    // List all sheets in the spreadsheet
    const sheetsResponse = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties'
    });
    
    // Extract sheet names
    const sheetNames = sheetsResponse.data.sheets?.map(
      sheet => sheet.properties?.title
    ) || [];
    
    console.log('Sheets in spreadsheet:', sheetNames);
    
    // Check if Login Info sheet exists
    const loginInfoSheetExists = sheetNames.includes('Login Info');
    
    // Create test data
    const testData = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
    };
    
    // Try to write to Login Info sheet if it exists
    let writeResult: WriteResult = { success: false, message: 'Sheet does not exist' };
    
    if (loginInfoSheetExists) {
      try {
        // Write test data
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: 'Login Info!A:C',
          valueInputOption: 'RAW',
          requestBody: {
            values: [['test@example.com', '127.0.0.1', testData.timestamp]],
          },
        });
        
        writeResult = { success: true, message: 'Successfully wrote test data' };
      } catch (writeError) {
        writeResult = { 
          success: false, 
          message: 'Failed to write test data',
          error: writeError instanceof Error ? writeError.message : String(writeError)
        };
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        sheets: sheetNames,
        loginInfoSheetExists,
        testData,
        writeResult
      }
    });
  } catch (error) {
    console.error('Error in test-sheets API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
} 