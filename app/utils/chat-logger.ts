/**
 * Chat logger utility to save user questions to Google Sheets
 */

import { logUserChatQuestion } from '@/app/lib/google-sheets';

// Server-side function to log chat directly without going through API
export async function logChat(email: string, question: string) {
  try {
    console.log(`🌐 DIRECT CHAT LOG: Logging chat for ${email}`);
    console.log(`🌐 DIRECT CHAT LOG: Question: ${question.substring(0, 30)}...`);
    
    const result = await logUserChatQuestion({
      email,
      question
    });
    
    console.log(`🌐 DIRECT CHAT LOG: Result: ${result.success ? 'Success' : 'Failed'}`);
    return result;
  } catch (error) {
    console.error('🌐 DIRECT CHAT LOG: Error logging chat:', error);
    return { success: false, error };
  }
} 