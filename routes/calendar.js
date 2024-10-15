const express = require('express');
const axios = require('axios'); // For making API requests
const { format, startOfMonth, endOfMonth, eachDayOfInterval } = require('date-fns');
const router = express.Router();

// Function to fetch calendar events from Microsoft Graph API
async function getCalendarEvents(accessToken) {
  try {
    const response = await axios.get('https://graph.microsoft.com/v1.0/me/events', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return response.data.value; // Return the events array
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    throw error; // Propagate the error
  }
}

// Calendar route to display the current month's calendar
router.get('/', async (req, res) => {
  const accessToken = req.session.accessToken; // Ensure you have stored the access token in the session

  if (!accessToken) {
    return res.status(401).send('Unauthorized: Access token is missing');
  }

  // Get the current month and year from query parameters or default to the current date
  const currentMonth = parseInt(req.query.month) || new Date().getMonth();
  const currentYear = parseInt(req.query.year) || new Date().getFullYear();

  // Adjust month and year for navigation
  const month = currentMonth >= 0 && currentMonth < 12 ? currentMonth : new Date().getMonth();
  let year = currentYear;

  // Handle year adjustment for month navigation
  if (req.query.navigate === 'prev') {
    year = month === 0 ? year - 1 : year; // Decrement year if navigating from January
  } else if (req.query.navigate === 'next') {
    year = month === 11 ? year + 1 : year; // Increment year if navigating from December
  }

  // Fetch calendar events for the user
  const events = await getCalendarEvents(accessToken);

  // Calculate the start and end of the current month
  const currentMonthStart = startOfMonth(new Date(year, month));
  const currentMonthEnd = endOfMonth(new Date(year, month));

  // Create an array of days in the current month with tasks
  const daysInMonth = eachDayOfInterval({
    start: currentMonthStart,
    end: currentMonthEnd
  }).map(day => {
    const dayDate = format(day, 'd');
    const dayEvents = events.filter(event => {
      const eventStart = new Date(event.start.dateTime);
      return eventStart.getDate() === day.getDate() && eventStart.getMonth() === month && eventStart.getFullYear() === year;
    });

    return {
      date: dayDate,
      hasTask: dayEvents.length > 0,
      events: dayEvents // Include the events for this day
    };
  });

  const monthName = format(currentMonthStart, 'MMMM');
  const firstDayOfMonth = currentMonthStart.getDay();
  const prevMonth = month === 0 ? 11 : month - 1; // Adjust previous month
  const nextMonth = month === 11 ? 0 : month + 1; // Adjust next month

  // Render the calendar view
  res.render('calendar', { 
    daysInMonth, 
    monthName, 
    year, 
    prevMonth, 
    nextMonth, 
    firstDayOfMonth,
    currentYear: year // Ensure to pass the updated year
  });
});

module.exports = router; // Export the router