const express = require('express');
const router = express.Router();
const axios = require('axios');

// Route to retrieve emails from Outlook
router.get('/', (req, res) => {
  const token = req.session.accessToken;
  if (!token) return res.status(401).send('Authentication required');

  const graphEndpoint = 'https://graph.microsoft.com/v1.0/me/messages';

  axios.get(graphEndpoint, {
    headers: { Authorization: `Bearer ${token}` },
    params: { '$top': 10, '$orderby': 'receivedDateTime desc' },
  })
  .then((response) => {
    const emails = response.data.value;
    debugger
    res.render('emails', { emails });
  })
  .catch((error) => {
    console.error('Error retrieving emails:', error);
    res.status(500).send('Error retrieving emails');
  });
});

// Route to retrieve a single email by ID
router.get('/email/:id', (req, res) =>  {
  const token = req.session.accessToken;
  const emailId = req.params.id;

  if (!token) {
    return res.status(401).send('Authentication required');
  }

  console.log('Email ID:', emailId);
  console.log('Access Token:', token);

  const graphEndpoint = `https://graph.microsoft.com/v1.0/me/messages/${emailId}`;

  axios.get(graphEndpoint, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => {
      if (response.status === 200) {
        const email = response.data;
        res.render('email', { email });
      } else {
        res.status(404).send('Email not found');
      }
    })
    .catch((error) => {
      if (error.response) {
        console.error('Error retrieving email:', error.response.status, error.response.data);
      } else {
        console.error('Error retrieving email:', error.message);
      }
      res.status(500).send('Error retrieving email');
    });
});


// Route to send a new email
router.post('/send', (req, res) => {
  const token = req.session.accessToken;
  const { to, subject, body } = req.body;
  if (!token) return res.status(401).send('Authentication required');

  const graphEndpoint = 'https://graph.microsoft.com/v1.0/me/sendMail';
  const emailData = {
    message: { 
      subject, 
      body: { contentType: 'Text', content: body }, 
      toRecipients: [{ emailAddress: { address: to } }] 
    },
    saveToSentItems: "true",
  };

  axios.post(graphEndpoint, emailData, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } })
    .then(() => res.redirect('/emails'))
    .catch((error) => {
      console.error('Error sending email:', error);
      res.status(500).send('Error sending email');
    });
});

// Route to forward an email
router.post('/:id/forward', (req, res) => {
  const token = req.session.accessToken;
  const emailId = req.params.id;
  const { to, comment } = req.body;
  if (!token) return res.status(401).send('Authentication required');

  const graphEndpoint = `https://graph.microsoft.com/v1.0/me/messages/${emailId}/forward`;
  const forwardData = { toRecipients: [{ emailAddress: { address: to } }], comment };

  axios.post(graphEndpoint, forwardData, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } })
    .then(() => res.redirect('/emails'))
    .catch((error) => {
      console.error('Error forwarding email:', error);
      res.status(500).send('Error forwarding email');
    });
});

module.exports = router;
