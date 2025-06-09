# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

## Recommended Project Structure

```
├── src/                      # Source code
│   ├── app/                  # Next.js app directory
│   ├── components/           # Reusable components
│   │   ├── common/          # Shared components
│   │   ├── layout/          # Layout components
│   │   └── features/        # Feature-specific components
│   ├── lib/                 # Library code
│   ├── utils/               # Utility functions
│   ├── types/               # TypeScript type definitions
│   ├── styles/              # Global styles
│   ├── services/            # API services
│   └── context/             # React context providers
├── public/                  # Static files
├── config/                  # Configuration files
│   ├── env/                 # Environment configurations
│   └── app/                 # App-specific configs
├── scripts/                 # Build and utility scripts
└── tests/                  # Test files
```

### Key Changes from Current Structure:
1. Unified components directory under src/
2. Consolidated configuration files under config/
3. Organized environment files
4. Separated test files
5. Clear separation of concerns

## API Endpoint Consolidation

To improve maintainability and simplify the codebase, all OpenAI API calls have been consolidated into a centralized endpoint at `app/api/chat/route.ts`. This change offers several benefits:

1. **Single Source of Truth**: All AI interactions flow through one endpoint, making it easier to maintain and update.
2. **Consistent Response Format**: The API returns standardized responses that work with all components.
3. **Enhanced Error Handling**: Centralized error handling with fallback options when API calls fail.
4. **Flexible Input Formats**: The endpoint supports multiple input formats for backward compatibility.
5. **Streaming Support**: Provides streaming responses for a better user experience.

The changes include:

- Refactoring the server-side endpoint (`server/server.js`) to forward requests to the main API
- Updating the duplicate endpoint in `src/app/api/chat/route.ts` to redirect to the main API
- Standardizing the input parameters and response format
- Ensuring consistent handling of repository context and file selections

This consolidation makes the codebase more maintainable and provides a foundation for future enhancements.

## Supabase Database Setup

This project uses Supabase as its database. Follow these steps to set up Supabase:

1. Create a Supabase account at [https://supabase.com](https://supabase.com)
2. Create a new Supabase project
3. Go to Project Settings > API and copy the `URL` and `anon/public` key
4. Add these values to your `.env.local` file:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

5. Run the SQL setup script in the Supabase SQL Editor:
   - Copy the contents of `supabase/schema.sql` 
   - Go to the SQL Editor in your Supabase dashboard
   - Paste the SQL and run it to create the necessary tables

6. To migrate data from Google Sheets to Supabase, run:

```bash
npx ts-node scripts/migrate-to-supabase.ts
```

## Production Preparation Notes

### Cleaned-up Files
The following development/testing files have been removed to prepare the application for production:
- token-debug.js: Test script for debugging tokens
- app/components/ChatBox.tsx.bak: Backup file
- app/components/Your-Actual-Chat-Component.tsx: Template component
- app/api/test-token-security: Test API endpoint
- app/api/test-sheets: Test Google Sheets API endpoint
- app/api/test-chat-log: Test logging endpoint
- app/login-test: Test login page
- create-table-direct.js: Development script for direct table creation
- test-save.mjs: Test script for save functionality
- apply-fixes.js: Development script for applying database schema fixes
- db-setup-runner files: Development scripts for database setup

### Chat Persistence System
This application is in the process of migrating from an older persistence system to a newer one:

- **Old System**: `app/lib/chat-persistence.ts` 
- **New System**: `app/lib/chat-persistence-v2.ts`

Currently, the application saves messages using the new system first, with fallbacks to the old system. Similarly, it attempts to load messages from the new system before falling back to the old one. A migration function automatically moves messages from the old system to the new one when they are loaded.

Both persistence implementations are currently kept to ensure backward compatibility during the transition period. Once all users' data has been migrated, the old system can be removed in a future update.

### Docker Configuration
The Dockerfile has been updated for production with the following improvements:
- Uses Node.js 18 slim image for smaller size
- Properly handles Next.js build and production artifacts
- Sets NODE_ENV to production
- Ignores development files via .dockerignore
