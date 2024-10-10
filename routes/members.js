const express = require('express');
const router = express.Router();
const axios = require('axios');

// Fetch members of the organization
router.get('/', (req, res) => {
  const token = req.session.accessToken;
  if (!token) return res.status(401).send('Authentication required');

  const graphEndpoint = 'https://graph.microsoft.com/v1.0/users';

  axios.get(graphEndpoint, { headers: { Authorization: `Bearer ${token}` } })
    .then((response) => {
      const members = response.data.value;
      const totalMembers = members.length;
      res.render('members', { members, totalMembers });
    })
    .catch((error) => {
      console.error('Error retrieving members:', error);
      res.status(500).send('Error retrieving members');
    });
});

module.exports = router;


