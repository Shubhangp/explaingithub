import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/auth/auth-options'

// Format data as an SSE message for streaming responses
function createSSEMessage(content: string) {
  return `data: ${JSON.stringify({ content })}\n\n`;
}

// Add better logging for debugging with timestamps
function logWithTimestamp(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  if (data) {
    console.log(data);
  }
}

// Custom API call to your endpoint
async function callCustomAPI(username_folder: string, query: string) {
  const response = await fetch('https://explaingithub-api-900779586767.us-central1.run.app/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username_folder,
      query
    })
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

// Simulate streaming by breaking down the response into chunks
function simulateStreaming(text: string, controller: ReadableStreamDefaultController, encoder: TextEncoder) {
  return new Promise<void>((resolve) => {
    const chunkSize = 50; // Adjust chunk size as needed
    let index = 0;

    const sendChunk = () => {
      if (index < text.length) {
        const chunk = text.substring(index, index + chunkSize);
        const message = createSSEMessage(chunk);
        controller.enqueue(encoder.encode(message));
        index += chunkSize;
        
        // Add delay to simulate typing effect
        setTimeout(sendChunk, 50);
      } else {
        resolve();
      }
    };

    sendChunk();
  });
}

/**
 * Centralized API endpoint that handles all AI interactions
 * Supports both streaming and non-streaming responses
 * Uses custom API instead of OpenAI
 */
export async function POST(request: Request) {
  logWithTimestamp('API chat route called');
  
  try {
    // Parse request body ONCE at the beginning
    const body = await request.json();
    
    // Get session info
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;

    // Handle anonymous users
    let anonymousId = null;
    if (!email) {
      anonymousId = body.anonymousId;
      
      if (!anonymousId) {
        anonymousId = `anon_${Math.random().toString(36).substring(2, 15)}`;
      }
    }
    
    // Extract context from the body
    const { prompt, repoContext, message, repoStructure: inputRepoStructure, readmeContent: inputReadmeContent, taggedFiles } = body;
    
    // Determine which input format we're dealing with and normalize
    let normalizedContext: {
      structure: string;
      readme: string;
      taggedFiles: Record<string, string>;
    };
    
    if (repoContext) {
      normalizedContext = repoContext;
      logWithTimestamp('Using ChatBox format with repoContext');
    } else if (inputRepoStructure) {
      normalizedContext = {
        structure: inputRepoStructure,
        readme: inputReadmeContent || '',
        taggedFiles: taggedFiles || {}
      };
      logWithTimestamp('Using alternate format with repoStructure');
    } else {
      normalizedContext = {
        structure: '',
        readme: '',
        taggedFiles: {}
      };
      logWithTimestamp('No context provided, using empty defaults');
    }
    
    // Normalize the prompt/message
    const userQuery = prompt ? 
      (prompt.includes('User question: ') ? prompt.split('User question: ')[1] : prompt) : 
      message || '';
    
    logWithTimestamp('Request details', {
      promptLength: prompt?.length || 0,
      messageLength: message?.length || 0,
      normalizedQueryLength: userQuery.length || 0,
      structureLength: normalizedContext.structure?.length || 0,
      readmeLength: normalizedContext.readme?.length || 0,
      taggedFilesCount: Object.keys(normalizedContext.taggedFiles || {}).length
    });
    
    // Extract repository information for the API call
    let username_folder = '';
    
    // Try to extract from the request body - check for direct properties first
    if (body.owner && body.repo) {
      username_folder = `${body.owner}/${body.repo}`;
      logWithTimestamp('Found owner and repo in request body:', { username_folder });
    } else if (body.repoPath) {
      username_folder = body.repoPath;
      logWithTimestamp('Found repoPath in request body:', { username_folder });
    } else {
      // Try to extract from context or default
      logWithTimestamp('No repository info found, using default');
      username_folder = 'unknown/repo';
    }

    // Enhance the query with context if available
    let enhancedQuery = userQuery;
    
    // Add selected files context if available
    const hasSelectedFiles = Object.keys(normalizedContext.taggedFiles || {}).length > 0;
    if (hasSelectedFiles) {
      const selectedFiles = Object.keys(normalizedContext.taggedFiles || {}).join(", ");
      enhancedQuery = `${userQuery}\n\nNote: I've selected these specific files for analysis: ${selectedFiles}`;
    }
    
    // Add repository structure context if available
    if (normalizedContext.structure && normalizedContext.structure.length > 0 && !normalizedContext.structure.includes('still loading')) {
      enhancedQuery = `${enhancedQuery}\n\nRepository structure available for context.`;
    }
    
    // Add README context if available
    if (normalizedContext.readme && normalizedContext.readme.length > 0 && !normalizedContext.readme.includes('still loading')) {
      enhancedQuery = `${enhancedQuery}\n\nREADME content available for context.`;
    }
    
    // Log this chat asynchronously (same as before)
    (async () => {
      try {
        const logData = {
          email: email || null,
          anonymousId,
          question: userQuery || '',
        };
        
        let repoInfo: {
          owner?: string;
          repo?: string;
          provider?: string;
        } = {};
        
        if (body.owner && body.repo) {
          repoInfo = {
            owner: body.owner,
            repo: body.repo,
            provider: body.provider || 'github'
          };
        } else if (body.repoPath) {
          const pathParts = body.repoPath.split('/');
          if (pathParts.length >= 2) {
            repoInfo = {
              owner: pathParts[0],
              repo: pathParts[1],
              provider: body.provider || 'github'
            };
          }
        }
        
        const combinedData = {
          ...logData,
          ...repoInfo
        };
        
        // Try to directly save to the database if we have enough info
        if (email && userQuery && repoInfo.owner && repoInfo.repo) {
          try {
            const supabase = (await import('@/app/lib/supabase')).default;
            
            await supabase.from('conversations').upsert({
              user_id: email,
              provider: repoInfo.provider || 'github',
              owner: repoInfo.owner,
              repo: repoInfo.repo,
              title: userQuery.length > 50 ? `${userQuery.substring(0, 47)}...` : userQuery,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'provider,owner,repo',
              ignoreDuplicates: false
            });
            
            console.log('Successfully saved chat directly to conversations table');
          } catch (dbError) {
            console.error('Error saving directly to database:', dbError);
          }
        }
        
        // Background API call for logging
        if ((combinedData.email || combinedData.anonymousId) && combinedData.question && combinedData.owner && combinedData.repo) {
          try {
            const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
            const host = request.headers.get('host') || 'localhost:3000';
            const apiUrl = `${protocol}://${host}/api/log-chat`;
            
            fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(anonymousId ? { 'x-anonymous-id': anonymousId } : {})
              },
              body: JSON.stringify(combinedData),
            }).catch(error => {
              console.error('Error logging chat:', error);
            });
          } catch (error) {
            console.error('Error in background logging:', error);
          }
        }
      } catch (error) {
        console.error('Error in background chat logging:', error);
      }
    })();
    
    // Determine if we should use streaming (default to true)
    const useStreaming = body.stream !== false;
    
    if (useStreaming) {
      // Return as a streaming response
      logWithTimestamp('Using streaming response with custom API');
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Call your custom API
            logWithTimestamp('Calling custom API', { username_folder, query: enhancedQuery });
            const apiResponse = await callCustomAPI(username_folder, enhancedQuery);
            
            // Extract the response text (adjust based on your API's response format)
            const responseText = apiResponse.response || apiResponse.answer || apiResponse.message || JSON.stringify(apiResponse);
            
            logWithTimestamp('Received response from custom API', { responseLength: responseText.length });
            
            // Simulate streaming by breaking the response into chunks
            await simulateStreaming(responseText, controller, encoder);
            
            // End the stream
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
            
          } catch (error) {
            logWithTimestamp('Custom API Error (falling back to error message):', error);
            
            // Fallback error message
            const fallbackMessage = `I couldn't connect to the repository analysis service. Please try again later.

Error details: ${error instanceof Error ? error.message : 'Unknown error'}

You can try:
1. Refreshing the page and trying again
2. Checking if the repository exists and is accessible
3. Asking a simpler question about the repository`;
            
            await simulateStreaming(fallbackMessage, controller, encoder);
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          }
        }
      });
      
      // Return the stream with proper SSE headers
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // Non-streaming response
      logWithTimestamp('Using non-streaming response with custom API');
      try {
        const apiResponse = await callCustomAPI(username_folder, enhancedQuery);
        
        // Extract the response text (adjust based on your API's response format)
        const responseText = apiResponse.response || apiResponse.answer || apiResponse.message || JSON.stringify(apiResponse);
        
        return NextResponse.json({
          message: responseText
        });
      } catch (apiError: any) {
        logWithTimestamp('Custom API Error in non-streaming mode:', apiError);
        return NextResponse.json(
          { error: 'Failed to get response from repository analysis service', details: apiError.message },
          { status: 500 }
        );
      }
    }
  } catch (error: any) {
    logWithTimestamp('API Error:', error);
    return NextResponse.json({ 
      error: 'Failed to process the request',
      details: error.message
    }, { status: 500 });
  }
}