import { getSession } from 'next-auth/react';
import { logUserChatQuestion } from '@/app/lib/google-sheets';

export async function sendChatMessage(message: string) {
  try {
    // First log the message
    const session = await getSession();
    if (session?.user?.email) {
      console.log('🤖 AI SERVICE: Logging chat for', session.user.email);
      
      await logUserChatQuestion({
        email: session.user.email,
        question: message
      });
    }
    
    // Then continue with the AI service call
    // ... your existing AI service code
  } catch (error) {
    console.error('Error in AI service:', error);
    throw error;
  }
} 