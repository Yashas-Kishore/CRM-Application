require('dotenv').config();
const express = require('express');
const msal = require('@azure/msal-node');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const app = express();

// Middleware for JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure SESSION_SECRET is set, or generate one dynamically
if (!process.env.SESSION_SECRET) {
  const secretKey = crypto.randomBytes(32).toString('hex');
  fs.appendFileSync('.env', `\nSESSION_SECRET=${secretKey}\n`);
  console.log('New secret key generated and saved to .env file');
}

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Session setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// View engine setup
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

// Import routes
const calendarRoutes = require('./routes/calendar');
const emailRoutes = require('./routes/emails');
const memberRoutes = require('./routes/members');
const tasksRoutes = require('./Routes/tasks');

app.use('/calendar', calendarRoutes);
app.use('/emails', emailRoutes);
app.use('/members', memberRoutes);
app.use('/tasks', tasksRoutes);

// Authentication route
app.get('/auth', (req, res) => {
  const authUrlParams = {
    scopes: ['User.Read', 'Mail.Read', 'Calendars.Read', 'Tasks.Read', 'Tasks.ReadWrite'],
    redirectUri
  };

  pca.getAuthCodeUrl(authUrlParams)
    .then(response => res.redirect(response))
    .catch(error => {
      console.error('Error generating auth URL:', error);
      res.status(500).send('Error generating authentication URL');
    });
});

// Authentication callback
app.get('/auth-callback', (req, res) => {
  const tokenRequest = {
    code: req.query.code,
    scopes: ['User.Read', 'Mail.Read', 'Calendars.Read', 'Tasks.Read', 'Tasks.ReadWrite'],
    redirectUri
  };

  pca.acquireTokenByCode(tokenRequest)
    .then(response => {
      req.session.accessToken = response.accessToken;
      req.session.userName = response.account?.name || 'Guest';
      res.redirect('/dashboard');
    })
    .catch(error => {
      console.error('Error acquiring token:', error);
      res.status(500).send('Error during authentication');
    });
});

// Dashboard route
app.get('/dashboard', (req, res) => {
  if (!req.session.accessToken) {
    return res.status(401).send('Authentication required');
  }

  res.render('dashboard', { userName: req.session.userName || 'Guest' });
});

// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Error logging out:', err);
      return res.status(500).send('Error during logout');
    }
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
