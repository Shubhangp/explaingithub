import { Octokit } from '@octokit/rest';

/**
 * Sends a query to the OpenAI API with appropriate context and handles streaming responses
 * @param {string} query - The user's query
 * @param {string} username - GitHub username
 * @param {string} repo - GitHub repository name
 * @param {Array} chatHistory - Previous chat messages
 * @param {Object} fileContents - Contents of selected files
 * @param {Function} onChunk - Callback function to handle streaming chunks
 * @returns {Promise<string>} - The AI's response
 */
export const sendQueryToAI = async (query, username, repo, chatHistory, fileContents = {}, onChunk = null) => {
  try {
    console.log('Sending query to AI with fileContents:', Object.keys(fileContents));
    
    // Get the authentication token
    const token = localStorage.getItem('github_token');
    
    if (!token) {
      throw new Error('Authentication required to use the AI chat feature');
    }
    
    // Format selected files content for context
    const selectedFilesContext = Object.entries(fileContents).map(([path, content]) => {
      return `File: ${path}\n\`\`\`\n${content}\n\`\`\`\n`;
    }).join('\n');
    
    // Format chat history to ensure it's an array of objects with role and content
    const formattedChatHistory = chatHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Create system message with repository and file context
    const systemMessage = {
      role: 'system',
      content: `You are Repas, a helpful assistant for the GitHub repository ${username}/${repo}. 
      
${Object.keys(fileContents).length > 0 
  ? `Selected files for context:\n${selectedFilesContext}` 
  : ''}

Please provide helpful information about this repository, its structure, or answer questions about the code.
Format your responses using Markdown. Use code blocks with language identifiers for code snippets.`
    };
    
    // If onChunk is provided, use SSE streaming
    if (typeof onChunk === 'function') {
      return new Promise((resolve, reject) => {
        let fullContent = '';
        
        // Make a POST request to initiate the stream
        fetch(`${process.env.REACT_APP_API_URL || ''}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            prompt: query,
            message: query,
            question: query,
            owner: username,
            repo: repo,
            messages: [
              systemMessage,
              ...formattedChatHistory,
              { role: 'user', content: query }
            ],
            fileContents: fileContents,
            repoContext: {
              structure: '',
              readme: '',
              taggedFiles: fileContents
            }
          }),
        })
        .then(response => {
          if (!response.ok) {
            console.error(`API error: ${response.status}`, response);
            // Try to get error message from response
            return response.text().then(text => {
              try {
                const errorData = JSON.parse(text);
                throw new Error(`API error (${response.status}): ${errorData.error || text}`);
              } catch (e) {
                throw new Error(`API error (${response.status}): ${text || 'Unknown error'}`);
              }
            });
          }
          
          if (response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            // Function to read from the stream
            const processStream = async () => {
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  
                  if (done) {
                    resolve(fullContent);
                    break;
                  }
                  
                  // Decode the chunk
                  const chunk = decoder.decode(value, { stream: true });
                  
                  // Parse SSE messages
                  const lines = chunk.split('\n\n');
                  
                  for (const line of lines) {
                    if (line.trim() === '') continue;
                    
                    if (line.startsWith('data: ')) {
                      const data = line.slice(6); // Remove 'data: ' prefix
                      
                      // Check if it's the end message
                      if (data === '[DONE]') {
                        resolve(fullContent);
                        return;
                      }
                      
                      try {
                        // Parse the JSON content
                        const parsed = JSON.parse(data);
                        const content = parsed.content || '';
                        
                        // Only process if there's actual content
                        if (content) {
                          // Accumulate content
                          fullContent += content;
                          
                          // Call the callback with both the new chunk and the full content so far
                          onChunk(content, fullContent);
                        }
                      } catch (error) {
                        console.error('Error parsing SSE message:', error, 'Raw data:', data);
                        // Still attempt to use the data if it's not valid JSON
                        if (typeof data === 'string' && data !== '[DONE]' && data.trim() !== '') {
                          fullContent += data;
                          onChunk(data, fullContent);
                        }
                      }
                    } else if (line.trim() !== '') {
                      console.warn('Received non-data SSE message:', line);
                    }
                  }
                }
              } catch (error) {
                console.error('Error processing stream:', error);
                reject(error);
              }
            };
            
            // Start processing the stream
            processStream();
          } else {
            // Fallback for non-streaming response
            return response.json().then(data => {
              const message = data.message || data.content || '';
              onChunk(message, message);
              resolve(message);
            });
          }
        })
        .catch(error => {
          console.error('Error with fetch:', error);
          reject(error);
        });
      });
    } else {
      // Fall back to non-streaming for backwards compatibility
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [
            systemMessage,
            ...formattedChatHistory,
            { role: 'user', content: query }
          ],
          owner: username,
          repo: repo
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      return data.message;
    }
  } catch (error) {
    console.error('Error querying AI:', error);
    throw error;
  }
};

/**
 * Fetches content of a file from GitHub
 * @param {string} username - GitHub username
 * @param {string} repo - GitHub repository name
 * @param {string} path - Path to the file
 * @returns {Promise<string>} - The file content
 */
export const fetchFileContent = async (username, repo, path) => {
  try {
    const token = localStorage.getItem('github_token');
    const octokit = new Octokit({ auth: token });
    
    const { data } = await octokit.repos.getContent({
      owner: username,
      repo: repo,
      path: path
    });
    
    if (data.content) {
      // Base64 decode the content
      return atob(data.content);
    } else {
      throw new Error(`No content found for ${path}`);
    }
  } catch (error) {
    console.error(`Error fetching file content for ${path}:`, error);
    throw error;
  }
};

/**
 * Formats directory structure for AI context
 * @param {Object} node - Directory tree node
 * @param {number} depth - Current depth in the tree
 * @returns {string} - Formatted directory structure
 */
const formatDirectoryStructure = (node, depth = 0) => {
  if (!node) return '';
  
  let result = '';
  const indent = '  '.repeat(depth);
  
  if (depth > 0) {
    result += `${indent}${node.name}${node.type === 'tree' ? '/' : ''}\n`;
  }
  
  if (node.children) {
    const sortedChildren = Object.entries(node.children)
      .sort(([, a], [, b]) => {
        // Directories first, then files
        if (a.type === 'tree' && b.type !== 'tree') return -1;
        if (a.type !== 'tree' && b.type === 'tree') return 1;
        return a.name.localeCompare(b.name);
      });
    
    for (const [, child] of sortedChildren) {
      result += formatDirectoryStructure(child, depth + 1);
    }
  }
  
  return result;
};

/**
 * Strips HTML tags from a string
 * @param {string} html - HTML string
 * @returns {string} - Plain text
 */
const stripHtmlTags = (html) => {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, '');
}; 