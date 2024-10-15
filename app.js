require('dotenv').config();
const express = require('express');
const msal = require('@azure/msal-node');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const app = express();

// Ensure SESSION_SECRET is set, or generate one dynamically
if (!process.env.SESSION_SECRET) {
  const secretKey = crypto.randomBytes(32).toString('hex');
  fs.appendFileSync('.env', `\nSESSION_SECRET=${secretKey}\n`);
  console.log('New secret key generated and saved to .env file');
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
