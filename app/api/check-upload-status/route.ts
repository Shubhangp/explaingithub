// app/api/check-upload-status/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/options';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    // Parse request body
    const body = await request.json();
    const { owner, repo, provider = 'github' } = body;

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Missing required fields: owner and repo' },
        { status: 400 }
      );
    }

    // Check if the repository has been uploaded by looking for the directory
    const USER_REPOS_DIR = path.join(process.cwd(), 'User Repos');
    const repoDir = path.join(USER_REPOS_DIR, owner, repo);
    
    // Check if directory exists and has metadata.json
    const uploaded = fs.existsSync(repoDir) && fs.existsSync(path.join(repoDir, 'metadata.json'));
    
    // If uploaded, get the upload time from metadata
    let uploadTime = null;
    if (uploaded) {
      try {
        const metadata = JSON.parse(
          fs.readFileSync(path.join(repoDir, 'metadata.json'), 'utf-8')
        );
        uploadTime = metadata.uploadTime;
      } catch (e) {
        console.error('Error reading metadata:', e);
      }
    }

    return NextResponse.json({
      success: true,
      uploaded,
      uploadTime,
      path: uploaded ? `User Repos/${owner}/${repo}` : null
    });

  } catch (error) {
    console.error('Error checking upload status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}