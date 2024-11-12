require('dotenv').config();
const express = require('express');
const msal = require('@azure/msal-node');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const axios = require('axios');
const eventController = require('./controllers/eventController');

const app = express();

// Ensure SESSION_SECRET is set, or generate one dynamically
if (!process.env.SESSION_SECRET) {
  const secretKey = crypto.randomBytes(32).toString('hex');
  try {
    fs.appendFileSync('.env', `\nSESSION_SECRET=${secretKey}\n`);
    console.log('New secret key generated and saved to .env file');
  } catch (err) {
    console.error('Error writing to .env file', err);
    process.exit(1); // Exit the process if the secret key cannot be saved
  }
}

// Middleware to serve static files (CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));

// Session setup with secure cookies in production
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' } // Secure cookies only in production
}));

// Set EJS as the view engine and define the views directory
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware to parse JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MSAL configuration for authentication
const config = {
  auth: {
    clientId: process.env.CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
    clientSecret: process.env.CLIENT_SECRET
  }
};
const pca = new msal.ConfidentialClientApplication(config);
const redirectUri = process.env.REDIRECT_URI;

// Import route files
const calendarRoutes = require('./routes/calendar');
const emailRoutes = require('./routes/emails');
const memberRoutes = require('./routes/members');

// Use the imported routes for different functionalities
app.use('/calendar', calendarRoutes);
app.use('/emails', emailRoutes);
app.use('/members', memberRoutes);

// Use the eventController for handling routes
app.use('/api/events', eventController);

// Route to fetch events from Outlook
app.get('/api/events', async (req, res) => {
  try {
    const accessToken = req.session.accessToken;
    if (!accessToken) {
      return res.status(401).send('Unauthorized: Access token is missing');
    }

    const response = await axios.get('https://graph.microsoft.com/v1.0/me/events', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    res.status(200).send(response.data.value);
  } catch (error) {
    console.error('Error fetching events:', error.response ? error.response.data : error.message);
    res.status(400).send({ message: 'Error fetching events', error: error.response ? error.response.data : error.message });
  }
});

// Authentication route to redirect users for Microsoft login
app.get('/auth', (req, res) => {
  const authUrlParams = {
    scopes: ['User.Read', 'Mail.Read', 'Calendars.Read'],
    redirectUri
  };

  pca.getAuthCodeUrl(authUrlParams)
    .then((response) => res.redirect(response))
    .catch((error) => {
      console.error('Error generating auth URL:', error);
      res.status(500).send('Error generating authentication URL');
    });
});

// Authentication callback route to acquire token after login
app.get('/auth-callback', (req, res) => {
  const tokenRequest = {
    code: req.query.code,
    scopes: ['User.Read', 'Mail.Read', 'Calendars.Read'],
    redirectUri
  };

  pca.acquireTokenByCode(tokenRequest)
    .then((response) => {
      req.session.accessToken = response.accessToken; // Store access token in session
      const userName = response.account?.name || 'Guest';
      req.session.userName = userName; // Store userName in session
      res.redirect('/dashboard');
    })
    .catch((error) => {
      console.error('Error acquiring token:', error);
      res.status(500).send('Error during authentication');
    });
});

// Dashboard route (make sure the dashboard view exists)
app.get('/dashboard', (req, res) => {
  const token = req.session.accessToken;
  const userName = req.session.userName || 'Guest'; // Retrieve userName from session

  if (!token) {
    return res.status(401).send('Authentication required');
  }

  console.log('Session access token:', token);
  console.log('UserName:', userName);

  res.render('dashboard', { userName, token });
});

// Logout route with redirection to the homepage (index.html)
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error logging out:', err);
      return res.status(500).send('Error during logout');
    }
    res.clearCookie('connect.sid', { path: '/' }); // Clear session cookie
    res.redirect('/'); // Redirect to the root, which will serve index.html
  });
});

// Start the server
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;