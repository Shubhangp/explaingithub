import { Octokit } from '@octokit/rest';

export interface UploadStatus {
  isUploading: boolean;
  progress: number;
  error: string | null;
  lastChecked?: Date;
  uploaded?: boolean;
}

// Cache upload status in memory
const uploadStatusCache = new Map<string, UploadStatus>();

// Check if a repository has been uploaded
export async function checkRepositoryUploadStatus(
  owner: string,
  repo: string,
  provider: string = 'github'
): Promise<{ uploaded: boolean; lastChecked?: Date }> {
  try {
    // Check cache first
    const cacheKey = `${provider}:${owner}/${repo}`;
    const cached = uploadStatusCache.get(cacheKey);
    
    if (cached && cached.uploaded && cached.lastChecked) {
      const cacheAge = Date.now() - cached.lastChecked.getTime();
      // Consider cache valid for 1 hour
      if (cacheAge < 60 * 60 * 1000) {
        return { uploaded: cached.uploaded, lastChecked: cached.lastChecked };
      }
    }

    // Call API to check upload status
    const response = await fetch('/api/check-upload-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ owner, repo, provider }),
    });

    if (!response.ok) {
      console.error('Failed to check upload status');
      return { uploaded: false };
    }

    const data = await response.json();
    
    // Update cache
    uploadStatusCache.set(cacheKey, {
      isUploading: false,
      progress: 100,
      error: null,
      uploaded: data.uploaded,
      lastChecked: new Date(),
    });

    return { uploaded: data.uploaded, lastChecked: new Date() };
  } catch (error) {
    console.error('Error checking repository upload status:', error);
    return { uploaded: false };
  }
}

// Upload repository contents
export async function uploadRepositoryContents(
  owner: string,
  repo: string,
  provider: string = 'github',
  accessToken?: string,
  onProgress?: (progress: number) => void,
  onMessage?: (message: string) => void
): Promise<{ success: boolean; error?: string }> {
  const cacheKey = `${provider}:${owner}/${repo}`;
  
  // Check if already uploading
  const currentStatus = uploadStatusCache.get(cacheKey);
  if (currentStatus?.isUploading) {
    return { success: false, error: 'Repository is already being uploaded' };
  }

  // Update status to uploading
  uploadStatusCache.set(cacheKey, {
    isUploading: true,
    progress: 0,
    error: null,
  });

  try {
    if (provider !== 'github') {
      throw new Error(`Provider ${provider} is not yet supported for automatic upload`);
    }

    if (!accessToken) {
      throw new Error('No access token provided');
    }

    onMessage?.(`Starting repository upload for ${owner}/${repo}...`);
    onProgress?.(0);

    // Initialize Octokit with proper authentication
    // GitHub expects the token in a specific format
    console.log('Initializing Octokit with token (first 10 chars):', accessToken.substring(0, 10) + '...');
    
    const octokit = new Octokit({
      auth: accessToken,
      // Add request timeout and retry options
      request: {
        timeout: 30000, // 30 seconds timeout
      },
      retry: {
        enabled: true,
        retries: 3,
      }
    });

    // Test authentication first
    try {
      console.log('Testing GitHub authentication...');
      const authTest = await octokit.rest.users.getAuthenticated();
      console.log('Authentication successful for user:', authTest.data.login);
    } catch (authError: any) {
      console.error('GitHub authentication failed:', authError);
      throw new Error(`GitHub authentication failed: ${authError.message || 'Invalid token'}`);
    }

    // Get repo details
    console.log(`Fetching repository details for ${owner}/${repo}...`);
    let repoResponse;
    try {
      repoResponse = await octokit.repos.get({
        owner,
        repo,
      });
    } catch (repoError: any) {
      console.error('Error fetching repository:', repoError);
      if (repoError.status === 404) {
        throw new Error(`Repository ${owner}/${repo} not found or you don't have access`);
      }
      throw new Error(`Failed to fetch repository: ${repoError.message}`);
    }

    const defaultBranch = repoResponse.data.default_branch;
    console.log('Repository default branch:', defaultBranch);
    onProgress?.(10);

    // Get the latest commit SHA
    console.log('Fetching latest commit...');
    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`,
    });

    const latestCommitSha = refData.object.sha;
    console.log('Latest commit SHA:', latestCommitSha);
    onProgress?.(20);

    // Get the full directory tree
    console.log('Fetching repository tree...');
    const { data: treeData } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: latestCommitSha,
      recursive: '1',
    });

    // Filter files to upload (exclude binary files and large files)
    const filesToUpload = treeData.tree.filter(
      (item) =>
        item.type === 'blob' &&
        item.path &&
        // Only include text-based files
        item.path.match(/\.(md|txt|js|jsx|ts|tsx|json|css|scss|html|py|rb|java|c|cpp|h|php|go|rs|swift|kt|yml|yaml|xml|sh|bash|zsh|fish|ps1|psm1|psd1|gradle|properties|conf|config|env|gitignore|dockerfile|makefile|cmake|rake|gemfile|requirements|package|composer|cargo|cabal|mix|rebar|erlang|elixir|clj|cljs|cljc|scala|sbt|fs|fsx|fsi|ml|mli|re|rei|v|sv|svh|vhd|vhdl|dart|r|jl|lua|vim|el|lisp|scm|rkt|hs|lhs|agda|idr|lean|coq|thy|v|nim|cr|ex|exs|erl|hrl|zig|asm|s|S|nasm|masm|wat|wast)$/i) &&
        // Exclude files that are too large (optional size check)
        (!item.size || item.size < 1024 * 1024) // Less than 1MB
    );

    console.log(`Found ${filesToUpload.length} files to upload`);
    onProgress?.(30);

    // Prepare repository data
    const repoData: any = {
      owner,
      repo,
      branch: defaultBranch,
      files: {},
    };

    // Load file contents
    const totalFiles = filesToUpload.length;
    let processedFiles = 0;
    let skippedFiles = 0;

    for (const file of filesToUpload) {
      try {
        if (!file.sha || !file.path) {
          skippedFiles++;
          continue;
        }

        // Log progress every 10 files
        if (processedFiles % 10 === 0) {
          console.log(`Processing file ${processedFiles + 1}/${totalFiles}: ${file.path}`);
        }

        const { data: fileData } = await octokit.git.getBlob({
          owner,
          repo,
          file_sha: file.sha,
        });

        // Decode content based on encoding
        let content: string;
        if (fileData.encoding === 'base64') {
          try {
            content = atob(fileData.content);
          } catch (decodeError) {
            console.warn(`Failed to decode base64 for ${file.path}, skipping`);
            skippedFiles++;
            continue;
          }
        } else {
          content = fileData.content;
        }

        repoData.files[file.path] = content;
        processedFiles++;

        // Update progress
        const fileProgress = 30 + (processedFiles / totalFiles) * 60;
        onProgress?.(Math.floor(fileProgress));
      } catch (error: any) {
        console.error(`Error fetching file ${file.path}:`, error.message);
        skippedFiles++;
        // Continue with other files even if one fails
      }
    }

    console.log(`Processed ${processedFiles} files, skipped ${skippedFiles} files`);
    onProgress?.(90);
    onMessage?.(`Uploading ${processedFiles} files to server...`);

    // Upload to backend
    const response = await fetch('/api/upload-repository', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(repoData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server response error:', errorText);
      throw new Error(`Server responded with ${response.status}: ${errorText}`);
    }

    const responseData = await response.json();
    onProgress?.(100);

    // Update cache
    uploadStatusCache.set(cacheKey, {
      isUploading: false,
      progress: 100,
      error: null,
      uploaded: true,
      lastChecked: new Date(),
    });

    onMessage?.(
      `✅ Repository ${owner}/${repo} uploaded successfully! ${responseData.apiUploadStatus || 'Sent to external API.'}`
    );

    return { success: true };
  } catch (error: any) {
    console.error('Error uploading repository:', error);
    
    // Update cache with error
    uploadStatusCache.set(cacheKey, {
      isUploading: false,
      progress: 0,
      error: error.message,
      uploaded: false,
    });

    onMessage?.(`❌ Failed to upload repository: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Get current upload status from cache
export function getUploadStatus(owner: string, repo: string, provider: string = 'github'): UploadStatus | null {
  const cacheKey = `${provider}:${owner}/${repo}`;
  return uploadStatusCache.get(cacheKey) || null;
}