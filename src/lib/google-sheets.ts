import { google } from 'googleapis';

// Initialize the Google Sheets API client
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

function getISTDateTime() {
  // Get current date in UTC
  const now = new Date();
  
  // Add 5 hours and 30 minutes to get IST
  const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  
  // Manually format date as DD/MM/YYYY
  const day = String(istTime.getUTCDate()).padStart(2, '0');
  const month = String(istTime.getUTCMonth() + 1).padStart(2, '0'); // UTC months are 0-indexed
  const year = istTime.getUTCFullYear();
  
  // Manually format time as HH:MM:SS AM/PM
  let hours = istTime.getUTCHours();
  const minutes = String(istTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(istTime.getUTCSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  // Convert to 12-hour format
  hours = hours % 12;
  hours = hours ? hours : 12; // Convert 0 to 12 for 12 AM
  const formattedHours = String(hours).padStart(2, '0');
  
  const formattedDate = `${day}/${month}/${year}`;
  const formattedTime = `${formattedHours}:${minutes}:${seconds} ${ampm}`;

  // Return both date and time separately
  return {
    date: formattedDate,
    time: `${formattedTime} IST`,
    // Keep the full timestamp for backward compatibility if needed
    fullTimestamp: `${formattedDate} ${formattedTime} IST`
  };
}

export async function logUserLogin({
  email,
  name,
  ipAddress,
}: {
  email: string;
  name: string;
  ipAddress: string;
}) {
  try {
    console.log('Starting logUserLogin with:', { email, name, ipAddress });
    
    const timestamp = getISTDateTime();
    console.log('Generated timestamp:', timestamp);
    
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    console.log('Spreadsheet ID:', spreadsheetId);

    if (!spreadsheetId) {
      throw new Error('Google Sheets ID not configured');
    }

    if (!process.env.GOOGLE_SHEETS_CLIENT_EMAIL || !process.env.GOOGLE_SHEETS_PRIVATE_KEY) {
      throw new Error('Google Sheets credentials not configured');
    }

    // Log the values being appended - now with separate date and time columns
    const values = [[email, name, timestamp.date, timestamp.time, ipAddress]];
    console.log('Appending values:', values);

    // Append the login data to the sheet - updated range to include the new column
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'User Logins!A:E',  // Updated to include E column for the IP address
      valueInputOption: 'RAW',
      requestBody: {
        values,
      },
    });

    console.log('Google Sheets API response:', response.data);
    return { success: true };
  } catch (error) {
    console.error('Detailed error in logUserLogin:', {
      error,
      credentials: {
        hasClientEmail: !!process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
        hasPrivateKey: !!process.env.GOOGLE_SHEETS_PRIVATE_KEY,
        hasSpreadsheetId: !!process.env.GOOGLE_SHEETS_ID,
      }
    });
    return { success: false, error };
  }
}

/**
 * Logs detailed user login information to the "Login Info" sheet in the same spreadsheet
 */
export async function saveUserLoginInfo({
  email,
  ipAddress,
}: {
  email: string;
  ipAddress: string;
}) {
  try {
    console.log('Starting saveUserLoginInfo with:', { email, ipAddress });
    
    // Get current IST time
    const istTimestamp = getISTDateTime();
    console.log('Generated IST timestamp:', istTimestamp);
    
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    console.log('Spreadsheet ID:', spreadsheetId);

    if (!spreadsheetId) {
      throw new Error('Google Sheets ID not configured');
    }

    if (!process.env.GOOGLE_SHEETS_CLIENT_EMAIL || !process.env.GOOGLE_SHEETS_PRIVATE_KEY) {
      throw new Error('Google Sheets credentials not configured');
    }

    // Prepare the values for the new sheet - now with separate date and time columns
    const values = [[email, ipAddress, istTimestamp.date, istTimestamp.time]];
    console.log('Appending login info values:', values);

    // First, let's check if the Login Info sheet exists
    try {
      // Try to get the sheet metadata
      const sheetsResponse = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties'
      });
      
      console.log('Sheets in spreadsheet:', sheetsResponse.data.sheets);
      
      // Check if Login Info sheet exists
      const loginInfoSheetExists = sheetsResponse.data.sheets?.some(
        sheet => sheet.properties?.title === 'Login Info'
      );
      
      console.log('Login Info sheet exists:', loginInfoSheetExists);
      
      // If sheet doesn't exist, create it
      if (!loginInfoSheetExists) {
        console.log('Creating Login Info sheet...');
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: 'Login Info',
                    gridProperties: {
                      rowCount: 1000,
                      columnCount: 5
                    }
                  }
                }
              }
            ]
          }
        });
        
        // Add headers - updated to include separate Date and Time columns
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: 'Login Info!A1:D1',
          valueInputOption: 'RAW',
          requestBody: {
            values: [['Email', 'IP Address', 'Date', 'Time']]
          }
        });
        
        console.log('Login Info sheet created with headers');
      }
    } catch (sheetError) {
      console.error('Error checking/creating Login Info sheet:', sheetError);
      // Continue execution - we'll try to append anyway
    }

    // Append the login data to the "Login Info" sheet
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Login Info!A:D', // Updated range to include the new column
      valueInputOption: 'RAW',
      requestBody: {
        values,
      },
    });

    console.log('Google Sheets API response for login info:', response.data);
    return { success: true };
  } catch (error) {
    console.error('Detailed error in saveUserLoginInfo:', error instanceof Error ? error.message : String(error));
    console.error('Error details:', {
      error,
      credentials: {
        hasClientEmail: !!process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
        hasPrivateKey: !!process.env.GOOGLE_SHEETS_PRIVATE_KEY,
        hasSpreadsheetId: !!process.env.GOOGLE_SHEETS_ID,
      }
    });
    return { success: false, error };
  }
} 