const { OpenAI } = require('openai');

if (!process.env.REACT_APP_OPENAI_API_KEY) {
  console.error('❌ Missing REACT_APP_OPENAI_API_KEY in environment variables');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_API_KEY,
  timeout: 30000 // 30 seconds timeout
});

module.exports = openai; 