# GitHub Connection Fix

## Problem
The application shows "Connect with GitHub" even after logging in with GitHub because the required database table `user_provider_tokens` hasn't been created in Supabase.

## Solution

You need to run the SQL script in the Supabase dashboard to create the missing table:

1. **Log in to Supabase Dashboard**:
   - Visit: https://app.supabase.com
   - Sign in with your credentials
   - Select your project (likely "github-directory-viewer")

2. **Open the SQL Editor**:
   - From the left sidebar, click "SQL Editor"
   - Click "New query" to create a new SQL query

3. **Copy and paste the SQL script**:
   - Copy the entire SQL script from `create-table.sql`
   - Paste it into the SQL Editor

4. **Run the script**:
   - Click the "Run" button
   - You should see the result showing the table was created

5. **Restart your Next.js app**:
   - Stop your development server (if running)
   - Run `npm run dev` to restart the app

After completing these steps:
1. Log out and log back in using GitHub
2. The application should now show GitHub as connected on your profile page
3. You should be able to access your GitHub repositories

## Debugging

If you still encounter issues:
- Check the Supabase console to verify the table was created
- Look at the Network tab in your browser's Developer Tools to see responses from the `/api/auth/token` endpoint
- Check the Console tab for any error messages related to token storage

The issue is that your app is trying to save and retrieve GitHub tokens from the `user_provider_tokens` table, but the table doesn't exist yet. 