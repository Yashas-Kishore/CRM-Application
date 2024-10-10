const express = require('express');
const router = express.Router();
const { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } = require('date-fns');

// Calendar route to display current month's calendar
router.get('/', (req, res) => {
  const currentMonth = parseInt(req.query.month) || new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const currentMonthStart = startOfMonth(new Date(currentYear, currentMonth));
  const currentMonthEnd = endOfMonth(new Date(currentYear, currentMonth));

  // Calculate the first day of the month (0 = Sunday, 1 = Monday, etc.)
  const firstDayOfMonth = currentMonthStart.getDay();

  // Array of days with tasks (e.g., from a database)
  const daysInMonth = eachDayOfInterval({
    start: currentMonthStart,
    end: currentMonthEnd
  }).map(day => ({
    date: format(day, 'd'),
    hasTask: Math.random() > 0.8 // Example: 20% of days have tasks
  }));

  const monthName = format(currentMonthStart, 'MMMM');
  const prevMonth = (currentMonth === 0) ? 11 : currentMonth - 1;
  const nextMonth = (currentMonth === 11) ? 0 : currentMonth + 1;

  res.render('calendar', { daysInMonth, monthName, currentYear, prevMonth, nextMonth, firstDayOfMonth });
});

module.exports = router;
