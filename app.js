require('dotenv').config();
const express = require('express');
const msal = require('@azure/msal-node');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const app = express();

// Check if SESSION_SECRET is set
if (!process.env.SESSION_SECRET) {
  const secretKey = crypto.randomBytes(32).toString('hex');
  fs.appendFileSync('.env', `\nSESSION_SECRET=${secretKey}\n`);
  console.log('New secret key generated and saved to .env file');
}

// Session setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' } // Secure cookies in production
}));

// MSAL configuration
const config = {
  auth: {
    clientId: process.env.CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
    clientSecret: process.env.CLIENT_SECRET
  }
};

const pca = new msal.ConfidentialClientApplication(config);
const redirectUri = process.env.REDIRECT_URI;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Import route files
const calendarRoutes = require('./routes/calendar');
const emailRoutes = require('./routes/emails');
const memberRoutes = require('./routes/members');

// Use routes
app.use('/calendar', calendarRoutes);
app.use('/emails', emailRoutes);
app.use('/members', memberRoutes);

// Authentication routes
app.get('/auth', (req, res) => {
  const authUrlParams = { scopes: ['User.Read', 'Mail.Read', 'User.Read.All', 'Group.Read.All'], redirectUri };

  pca.getAuthCodeUrl(authUrlParams)
    .then((response) => res.redirect(response))
    .catch((error) => {
      console.error('Error generating auth URL:', error);
      res.status(500).send('Error generating authentication URL');
    });
});

app.get('/auth-callback', (req, res) => {
  const tokenRequest = {
    code: req.query.code,
    scopes: ['User.Read', 'Mail.Read', 'User.Read.All', 'Group.Read.All'],
    redirectUri
  };

  pca.acquireTokenByCode(tokenRequest)
    .then((response) => {
      req.session.accessToken = response.accessToken;
      const userName = response.account?.name || 'Guest';
      res.redirect(`/dashboard?userName=${encodeURIComponent(userName)}`);
    })
    .catch((error) => {
      console.error('Error acquiring token:', error);
      res.status(500).send('Error during authentication');
    });
});

// Dashboard route
app.get('/dashboard', (req, res) => {
  const token = req.session.accessToken;
  const userName = req.query.userName || 'Guest';

  console.log('Session access token:', token);
  console.log('UserName:', userName);

  res.render('dashboard', { userName, token });
});

// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error logging out:', err);
      return res.status(500).send('Error during logout');
    }
    res.redirect('/auth');
  });
});

// Start the server
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
