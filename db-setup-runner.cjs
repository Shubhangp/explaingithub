// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

// Register ts-node
require('ts-node').register({
  transpileOnly: true
});

// Require the TypeScript file
const { setupDatabase } = require('./app/lib/db-setup.ts');

console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('Supabase Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Available' : 'Missing');

// Run the setup function
setupDatabase()
  .then(result => {
    console.log('Database setup result:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('Error running database setup:', error);
    process.exit(1);
  }); 