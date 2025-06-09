require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const { OpenAI } = require('openai');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_API_KEY
});

// Verify environment variables
if (!process.env.REACT_APP_OPENAI_API_KEY) {
  console.error('⚠️ REACT_APP_OPENAI_API_KEY is present but not being loaded properly');
  // Don't exit the process, just log the warning
}

// Configure CORS based on environment
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.PRODUCTION_URL 
    : '*', // Allow all origins in development
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(bodyParser.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Add this before your other routes
app.get('/github-callback', async (req, res) => {
  const { code, state } = req.query;
  
  if (!code) {
    return res.status(400).send('No code provided');
  }

  try {
    console.log('Received callback with code:', code);
    
    // Exchange code for access token
    const response = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GITHUB_REDIRECT_URI,
      },
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );

    const { access_token, error } = response.data;

    if (error) {
      console.error('GitHub OAuth error:', error);
      return res.redirect('/login?error=' + encodeURIComponent(error));
    }

    // Redirect to frontend with the token
    res.redirect(`http://localhost:3000/callback?token=${access_token}`);
  } catch (error) {
    console.error('Error in callback:', error);
    res.redirect('/login?error=' + encodeURIComponent('Authentication failed'));
  }
});

// GitHub OAuth endpoint
app.post('/api/auth/github', async (req, res) => {
  console.log('Received GitHub auth request:', req.body);
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Code is required' });
  }

  try {
    console.log('Exchanging code for token...');
    const response = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GITHUB_REDIRECT_URI,
      },
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );

    console.log('GitHub response received');
    const { access_token, error } = response.data;

    if (error) {
      console.error('GitHub OAuth error:', error);
      return res.status(400).json({ error });
    }

    res.json({ access_token });
  } catch (error) {
    console.error('Server error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to authenticate with GitHub' });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../build', 'index.html'));
  });
}

// API endpoint to simply log the user question
app.post('/api/log-question', (req, res) => {
  const { question } = req.body;
  console.log(`User asked: ${question}`);
  res.json({ success: true });
});

// Redirects OpenAI API calls to our centralized API endpoint
app.post('/api/openai', async (req, res) => {
  try {
    console.log('Forwarding OpenAI request to centralized API endpoint');
    
    // Get the base URL from the request
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const baseUrl = `${protocol}://${host}`;
    
    // Forward to the main API endpoint
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });
    
    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }
    
    // Get the response data
    const data = await response.json();
    
    // Return the response
    res.json(data);
  } catch (error) {
    console.error('API Forwarding Error:', error);
    res.status(500).json({
      error: 'Failed to get response from centralized API endpoint',
      details: error.message
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('=== Server Starting ===');
  console.log(`Server running on port ${PORT}`);
  console.log('Environment:', process.env.NODE_ENV);
  console.log('OpenAI API Key:', process.env.REACT_APP_OPENAI_API_KEY ? 'Present' : 'Missing');
  console.log('=== Server Started ===');
}); 