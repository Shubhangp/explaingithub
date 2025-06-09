import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Register ts-node to handle TypeScript files
require('ts-node').register({
  transpileOnly: true,
  esm: true,
  compilerOptions: {
    module: 'commonjs'
  }
});

// Import and run the setup function
import('./app/lib/db-setup.ts')
  .then(module => {
    return module.setupDatabase();
  })
  .then(result => {
    console.log('Database setup result:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('Error running database setup:', error);
    process.exit(1);
  }); 