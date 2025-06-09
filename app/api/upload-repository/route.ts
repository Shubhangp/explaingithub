import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/options';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';
import fetch from 'node-fetch';
import FormData from 'form-data';

// Set up the User Repos directory for storing repository data
const USER_REPOS_DIR = path.join(process.cwd(), 'User Repos');

// Make sure the main directory exists
if (!fs.existsSync(USER_REPOS_DIR)) {
  fs.mkdirSync(USER_REPOS_DIR, { recursive: true });
}

/**
 * API endpoint to handle repository uploads
 * Receives repository data and saves it using the username/repo structure
 * Also creates a zip file and sends it to the external API
 */
export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { owner, repo, branch, files } = body;

    // Validate required fields
    if (!owner || !repo || !files || Object.keys(files).length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: owner, repo, and files' },
        { status: 400 }
      );
    }

    // Create directory structure: User Repos/{owner}/{repo}/
    const ownerDir = path.join(USER_REPOS_DIR, owner);
    const repoDir = path.join(ownerDir, repo);
    
    // Create directories if they don't exist
    if (!fs.existsSync(ownerDir)) {
      fs.mkdirSync(ownerDir, { recursive: true });
    }
    
    // If repo directory already exists, delete it to ensure clean state
    if (fs.existsSync(repoDir)) {
      fs.rmSync(repoDir, { recursive: true, force: true });
    }
    
    // Create the repository directory
    fs.mkdirSync(repoDir, { recursive: true });

    // Generate a directory structure representation
    const directoryStructure = generateDirectoryStructure(Object.keys(files));

    // Save metadata
    const metadata = {
      owner,
      repo,
      branch: branch || 'main',
      uploadTime: new Date().toISOString(),
      user: session.user.email || session.user.name,
      fileCount: Object.keys(files).length,
      directoryStructure
    };

    fs.writeFileSync(
      path.join(repoDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    // Save files to disk
    let savedFileCount = 0;
    for (const [filePath, content] of Object.entries(files)) {
      try {
        // Create directory structure if needed
        const fullPath = path.join(repoDir, filePath);
        const dirPath = path.dirname(fullPath);
        fs.mkdirSync(dirPath, { recursive: true });

        // Write file content
        fs.writeFileSync(fullPath, content);
        savedFileCount++;
      } catch (fileError) {
        console.error(`Error saving file ${filePath}:`, fileError);
        // Continue with other files even if one fails
      }
    }

    // Log the upload
    console.log(`Repository uploaded: ${owner}/${repo} (Files: ${savedFileCount})`);

    // Create a zip file of the repository
    console.log(`Creating zip file for ${owner}/${repo}...`);
    const zip = new JSZip();
    
    // Add metadata.json to the zip
    zip.file('metadata.json', JSON.stringify(metadata, null, 2));
    
    // Add all repository files to the zip
    for (const [filePath, content] of Object.entries(files)) {
      zip.file(filePath, content);
    }
    
    // Generate the zip file
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    
    // Save the zip file locally - use underscore instead of dash to avoid confusion
    const zipFileName = `${owner}_${repo}.zip`;
    const zipFilePath = path.join(repoDir, zipFileName);
    fs.writeFileSync(zipFilePath, zipBuffer);
    
    // Get the UPLOAD_API endpoint from environment variables
    const uploadApiEndpoint = process.env.UPLOAD_API;
    
    let apiUploadStatus = null;
    
    if (!uploadApiEndpoint) {
      apiUploadStatus = "UPLOAD_API not configured. Zip file was created but not sent to any external API.";
      console.warn('UPLOAD_API environment variable not defined. Skipping external API upload.');
    } else {
      // Send the zip file to the external API using node-fetch and form-data
      console.log(`Sending zip file to external API: ${uploadApiEndpoint}`);
      
      try {
        // Create form data for the request
        const formData = new FormData();
        formData.append('file', fs.createReadStream(zipFilePath), {
          filename: zipFileName,
          contentType: 'application/zip',
        });
        
        // Include the original owner/repo format as separate fields
        formData.append('owner', owner);
        formData.append('repo', repo);
        formData.append('original_path', `${owner}/${repo}`);
        
        // Send the request to the external API
        const apiResponse = await fetch(uploadApiEndpoint, {
          method: 'POST',
          body: formData,
          headers: formData.getHeaders(),
        });
        
        if (!apiResponse.ok) {
          const errorText = await apiResponse.text();
          apiUploadStatus = `Error: API responded with status ${apiResponse.status}`;
          console.error(`Error from external API: ${apiResponse.status} - ${errorText}`);
        } else {
          const apiResult = await apiResponse.json();
          apiUploadStatus = "Success: Zip file was successfully sent to the external API.";
          console.log('External API response:', apiResult);
        }
      } catch (apiError) {
        apiUploadStatus = `Error: ${apiError.message}`;
        console.error('Error sending zip to external API:', apiError);
        // Continue with the response even if the external API upload fails
      }
    }

    // Return success response
    return NextResponse.json({
      success: true,
      message: `Repository uploaded successfully with ${savedFileCount} files`,
      path: `User Repos/${owner}/${repo}`,
      repositoryUrl: `${owner}/${repo}`,
      zipFile: zipFileName,
      apiUploadStatus
    });

  } catch (error) {
    console.error('Error handling repository upload:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Generate a directory structure representation from a list of file paths
 */
function generateDirectoryStructure(filePaths: string[]) {
  const structure: { [key: string]: any } = {};
  
  // Sort paths to ensure consistent directory creation order
  filePaths.sort().forEach(filePath => {
    const pathParts = filePath.split('/');
    let currentLevel = structure;
    
    // Navigate the path and build the tree structure
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      
      // If we're at the last part, it's a file
      if (i === pathParts.length - 1) {
        currentLevel[part] = 'file';
      } else {
        // It's a directory
        if (!currentLevel[part]) {
          currentLevel[part] = {};
        }
        currentLevel = currentLevel[part];
      }
    }
  });
  
  return structure;
} 