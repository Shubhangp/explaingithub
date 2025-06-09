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

export function getISTDateTime() {
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
    console.log('Logging user login for:', email);
    
    const timestamp = getISTDateTime();
    
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

    if (!spreadsheetId) {
      throw new Error('Google Sheets ID not configured');
    }

    if (!process.env.GOOGLE_SHEETS_CLIENT_EMAIL || !process.env.GOOGLE_SHEETS_PRIVATE_KEY) {
      throw new Error('Google Sheets credentials not configured');
    }

    // Log the values being appended - now with separate date and time columns
    const values = [[email, name, timestamp.date, timestamp.time, ipAddress]];

    // First, check if User Logins sheet exists
    try {
      // Try to get the sheet metadata
      const sheetsResponse = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties'
      });
      
      // Check if User Logins sheet exists
      const userLoginsSheetExists = sheetsResponse.data.sheets?.some(
        sheet => sheet.properties?.title === 'User Logins'
      );
      
      // If sheet doesn't exist, create it
      if (!userLoginsSheetExists) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: 'User Logins',
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
        
        // Add headers
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: 'User Logins!A1:E1',
          valueInputOption: 'RAW',
          requestBody: {
            values: [['Email', 'Name', 'Date', 'Time', 'IP Address']]
          }
        });
      }
    } catch (sheetError) {
      console.error('Error checking/creating User Logins sheet:', sheetError);
    }

    // Append the login data to the sheet
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'User Logins!A:E',
      valueInputOption: 'RAW',
      requestBody: {
        values,
      },
    });

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
 * Logs detailed user login information without storing sensitive data
 */
export async function saveUserLoginInfo({
  email,
  ipAddress,
}: {
  email: string;
  ipAddress: string;
}) {
  try {
    console.log('Saving login info for:', email);
    
    // Get current IST time
    const istTimestamp = getISTDateTime();
    
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

    if (!spreadsheetId) {
      throw new Error('Google Sheets ID not configured');
    }

    if (!process.env.GOOGLE_SHEETS_CLIENT_EMAIL || !process.env.GOOGLE_SHEETS_PRIVATE_KEY) {
      throw new Error('Google Sheets credentials not configured');
    }

    // Prepare the values for the Login Info sheet - order: Email, IP Address, Date, Time
    // Note: No access token is included here
    const values = [[email, ipAddress, istTimestamp.date, istTimestamp.time]];

    // First, let's check if the Login Info sheet exists
    try {
      // Try to get the sheet metadata
      const sheetsResponse = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties'
      });
      
      // Check if Login Info sheet exists
      const loginInfoSheetExists = sheetsResponse.data.sheets?.some(
        sheet => sheet.properties?.title === 'Login Info'
      );
      
      // If sheet doesn't exist, create it
      if (!loginInfoSheetExists) {
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
                      columnCount: 4 // Reduced from 5 to remove access token column
                    }
                  }
                }
              }
            ]
          }
        });
        
        // Add headers (without access token)
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: 'Login Info!A1:D1',
          valueInputOption: 'RAW',
          requestBody: {
            values: [['Email', 'IP Address', 'Date', 'Time']] // Removed access token
          }
        });
      }
    } catch (sheetError) {
      console.error('Error checking/creating Login Info sheet:', sheetError);
      // Continue execution
    }

    // Append the login data to the "Login Info" sheet
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Login Info!A:D', // Changed from A:E
      valueInputOption: 'RAW',
      requestBody: {
        values,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error in saveUserLoginInfo:', error);
    return { success: false, error };
  }
}

/**
 * Ensures Sheet1 exists with proper headers (no access token)
 */
export async function ensureSheet1Exists() {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

    if (!spreadsheetId) {
      throw new Error('Google Sheets ID not configured');
    }

    if (!process.env.GOOGLE_SHEETS_CLIENT_EMAIL || !process.env.GOOGLE_SHEETS_PRIVATE_KEY) {
      throw new Error('Google Sheets credentials not configured');
    }

    // Check if Sheet1 exists
    try {
      // Try to get the sheet metadata
      const sheetsResponse = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties'
      });
      
      // Check if Sheet1 exists
      const sheet1Exists = sheetsResponse.data.sheets?.some(
        sheet => sheet.properties?.title === 'Sheet1'
      );
      
      // If sheet doesn't exist, create it
      if (!sheet1Exists) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: 'Sheet1',
                    gridProperties: {
                      rowCount: 1000,
                      columnCount: 5 // Reduced from 6 to remove access token column
                    }
                  }
                }
              }
            ]
          }
        });
        
        // Add headers with the required columns (no access token)
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: 'Sheet1!A1:E1',
          valueInputOption: 'RAW',
          requestBody: {
            values: [['Date', 'Time', 'Name', 'Username', 'Email']] // Removed 'Access Token'
          }
        });
      } else {
        // Check if headers match the required format
        const headersResponse = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: 'Sheet1!A1:E1',
        });
        
        const headers = headersResponse.data.values?.[0] || [];
        const requiredHeaders = ['Date', 'Time', 'Name', 'Username', 'Email']; // Removed 'Access Token'
        
        // Check if headers need to be updated
        let needsUpdate = headers.length < requiredHeaders.length;
        
        if (!needsUpdate) {
          for (let i = 0; i < requiredHeaders.length; i++) {
            if (headers[i] !== requiredHeaders[i]) {
              needsUpdate = true;
              break;
            }
          }
        }
        
        if (needsUpdate) {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'Sheet1!A1:E1',
            valueInputOption: 'RAW',
            requestBody: {
              values: [requiredHeaders]
            }
          });
        }
      }
      
      return { success: true };
    } catch (sheetError) {
      console.error('Error checking/creating Sheet1:', sheetError);
      return { success: false, error: sheetError };
    }
  } catch (error) {
    console.error('Error in ensureSheet1Exists:', error);
    return { success: false, error };
  }
}

/**
 * Logs user chat questions to the "User Chats" sheet
 */
export async function logUserChatQuestion({
  email,
  question,
}: {
  email: string;
  question: string;
}) {
  try {
    console.log('Logging chat question for:', email);
    
    // Get current IST time
    const timestamp = getISTDateTime();

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

    if (!spreadsheetId) {
      throw new Error('Google Sheets ID not configured');
    }

    if (!process.env.GOOGLE_SHEETS_CLIENT_EMAIL || !process.env.GOOGLE_SHEETS_PRIVATE_KEY) {
      throw new Error('Google Sheets credentials not configured');
    }

    // Prepare the values for the User Chats sheet - email, question, date, time
    const values = [[email, question, timestamp.date, timestamp.time]];

    // First, check if User Chats sheet exists
    try {
      // Try to get the sheet metadata
      const sheetsResponse = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties'
      });
      
      // Check if User Chats sheet exists
      const userChatsSheetExists = sheetsResponse.data.sheets?.some(
        sheet => sheet.properties?.title === 'User Chats'
      );
      
      // If sheet doesn't exist, create it
      if (!userChatsSheetExists) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: 'User Chats',
                    gridProperties: {
                      rowCount: 1000,
                      columnCount: 4
                    }
                  }
                }
              }
            ]
          }
        });
        
        // Add headers
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: 'User Chats!A1:D1',
          valueInputOption: 'RAW',
          requestBody: {
            values: [['Email', 'Question', 'Date', 'Time']]
          }
        });
      }
    } catch (sheetError) {
      console.error('Error checking/creating User Chats sheet:', sheetError);
      // Continue execution - we'll try to append anyway
    }

    // Append the chat data to the "User Chats" sheet
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'User Chats!A:D',
      valueInputOption: 'RAW',
      requestBody: {
        values,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error logging chat question:', error instanceof Error ? error.message : String(error));
    return { success: false, error };
  }
} 