const express = require('express');
const axios = require('axios');
const router = express.Router();

// Middleware to check authentication
function ensureAuthenticated(req, res, next) {
  if (req.session.accessToken) {
    next();
  } else {
    res.status(401).send('Authentication required');
  }
}

// Get tasks
router.get('/', ensureAuthenticated, async (req, res) => {
  const token = req.session.accessToken;
  try {
    const listResponse = await axios.get('https://graph.microsoft.com/v1.0/me/todo/lists', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const defaultListId = listResponse.data.value[0]?.id;
    const tasksResponse = await axios.get(`https://graph.microsoft.com/v1.0/me/todo/lists/${defaultListId}/tasks`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    res.render('tasks', { tasks: tasksResponse.data.value });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).send('Error fetching tasks');
  }
});

// Create task
router.post('/create', ensureAuthenticated, async (req, res) => {
  const token = req.session.accessToken;
  const { taskTitle, dueDateTime } = req.body;

  if (!taskTitle) {
    return res.status(400).send('Task title is required');
  }

  try {
    const listResponse = await axios.get('https://graph.microsoft.com/v1.0/me/todo/lists', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const defaultListId = listResponse.data.value[0]?.id;

    const taskData = {
      title: taskTitle,
      dueDateTime: dueDateTime ? { dateTime: dueDateTime, timeZone: 'UTC' } : null
    };

    await axios.post(`https://graph.microsoft.com/v1.0/me/todo/lists/${defaultListId}/tasks`, taskData, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    });

    res.redirect('/tasks');
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).send('Error creating task');
  }
});

// Delete task
router.post('/:taskId/delete', ensureAuthenticated, async (req, res) => {
  const token = req.session.accessToken;
  const { taskId } = req.params;

  try {
    // Get the default list ID first
    const listResponse = await axios.get('https://graph.microsoft.com/v1.0/me/todo/lists', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const defaultListId = listResponse.data.value[0]?.id;

    // Delete the task using the correct endpoint
    await axios.delete(`https://graph.microsoft.com/v1.0/me/todo/lists/${defaultListId}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    res.redirect('/tasks');
  } catch (error) {
    console.error('Error deleting task:', error.response?.data || error);
    res.status(500).send('Error deleting task');
  }
});


module.exports = router;