require('dotenv').config();
const express = require('express');
const msal = require('@azure/msal-node');
const axios = require('axios');
const path = require('path');
const session = require('express-session');
const crypto = require('crypto');
const fs = require('fs');
const { format, startOfMonth, endOfMonth, eachDayOfInterval } = require('date-fns'); // Importing date-fns

const app = express();

// Path to the .env file
const envFilePath = '.env';

// Check if the secret key is already set in the environment
if (!process.env.SESSION_SECRET) {
  const secretKey = crypto.randomBytes(32).toString('hex'); // Generate a random key
  fs.appendFileSync(envFilePath, `\nSESSION_SECRET=${secretKey}\n`);
  console.log('New secret key generated and saved in .env file');
}

// Session setup using generated or existing secret key
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key', // Use fallback if .env not set
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true when using HTTPS in production
}));

// MSAL configuration
const config = {
  auth: {
    clientId: process.env.CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
    clientSecret: process.env.CLIENT_SECRET,
  },
};

const pca = new msal.ConfidentialClientApplication(config);
const redirectUri = process.env.REDIRECT_URI;

// Serve static files and setup views
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Route for login
app.get('/auth', (req, res) => {
  const authUrlParams = {
    scopes: ['User.Read', 'Mail.Read', 'User.Read.All', 'Group.Read.All'], // Added Mail.Read scope
    redirectUri: redirectUri,
  };

  pca.getAuthCodeUrl(authUrlParams)
    .then((response) => {
      res.redirect(response);
    })
    .catch((error) => {
      console.log('Error generating auth URL:', error);
      res.status(500).send('Error generating authentication URL');
    });
});

// Authentication callback route
app.get('/auth-callback', (req, res) => {
  const tokenRequest = {
    code: req.query.code,
    scopes: ['User.Read', 'Mail.Read', 'User.Read.All', 'Group.Read.All'], // Added Mail.Read scope
    redirectUri: redirectUri,
  };

  pca.acquireTokenByCode(tokenRequest)
    .then((response) => {
      req.session.accessToken = response.accessToken; // Store token in session
      res.redirect(`/dashboard?userName=${encodeURIComponent(response.account.name)}`);
    })
    .catch((error) => {
      console.log('Error acquiring token:', error);
      res.status(500).send('Error during authentication');
    });
});

// Fetch members of the organization from Azure AD using Microsoft Graph API
app.get('/members', (req, res) => {
  const token = req.session.accessToken; // Retrieve token from session
  if (!token) {
    return res.status(401).send('Authentication required');
  }

  const graphEndpoint = 'https://graph.microsoft.com/v1.0/users'; // Endpoint to fetch users in the organization

  axios.get(graphEndpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  .then((response) => {
    const members = response.data.value;
    const totalMembers = members.length; // Calculate total members
    res.render('members', { members, totalMembers }); // Pass totalMembers to the view
  })
  .catch((error) => {
    console.log('Error retrieving members from Microsoft Graph:', error);
    res.status(500).send('Error retrieving members from Azure AD');
  });
});

// Calendar route to display current month's calendar
app.get('/calendar', (req, res) => {
  const currentMonthStart = startOfMonth(new Date());
  const currentMonthEnd = endOfMonth(new Date());

  // Generate an array of dates for the current month
  const daysInMonth = eachDayOfInterval({
    start: currentMonthStart,
    end: currentMonthEnd
  });

  const formattedDays = daysInMonth.map(day => format(day, 'EEEE, MMMM do')); // Format dates (e.g., Monday, September 20th)

  res.render('calendar', { formattedDays });
});

// app.get('/calendar', (req, res) => {
//   const currentMonth = parseInt(req.query.month) || new Date().getMonth();
//   const currentYear = new Date().getFullYear();
//   const currentMonthStart = startOfMonth(new Date(currentYear, currentMonth));
//   const currentMonthEnd = endOfMonth(new Date(currentYear, currentMonth));

//   // Array of days with tasks (e.g., from a database)
//   const daysInMonth = eachDayOfInterval({
//     start: currentMonthStart,
//     end: currentMonthEnd
//   }).map(day => ({
//     date: format(day, 'd'),
//     hasTask: Math.random() > 0.8 // Example: 20% of days have tasks
//   }));

//   const monthName = format(currentMonthStart, 'MMMM');

//   res.render('calendar', { daysInMonth, monthName, currentYear });
// });

// Route to retrieve emails from Outlook
app.get('/emails', (req, res) => {
  const token = req.session.accessToken; // Retrieve access token from session
  if (!token) {
    return res.status(401).send('Authentication required');
  }

  const graphEndpoint = 'https://graph.microsoft.com/v1.0/me/messages'; // Endpoint to fetch user's emails

  axios.get(graphEndpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: {
      '$top': 10, // Retrieve the top 10 emails
      '$orderby': 'receivedDateTime desc', // Order by received date, newest first
    },
  })
  .then((response) => {
    const emails = response.data.value; // Extract the list of emails
    res.render('emails', { emails }); // Pass emails to the view to display
  })
  .catch((error) => {
    console.log('Error retrieving emails from Microsoft Graph:', error);
    res.status(500).send('Error retrieving emails from Outlook');
  });
});

// Home page to display user's name
app.get('/dashboard', (req, res) => {
  const token = req.session.accessToken; // Retrieve token from session
  const userName = req.query.userName || 'Guest'; // Default value if userName is undefined

  if (!userName) {
    console.error('User name is not defined');
  }

  res.render('dashboard', { userName, token });
});

// Route to handle logout
app.get('/logout', (req, res) => {
  console.log('Logout route hit');
  req.session.destroy((err) => {
    if (err) {
      console.log('Error logging out:', err);
      return res.status(500).send('Error during logout');
    }
    console.log('User logged out successfully');
    res.redirect('/auth'); // Redirect after logout
  });
});


// Start the server
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});