const express = require('express');
const router = express.Router();
const { format, startOfMonth, endOfMonth, eachDayOfInterval } = require('date-fns');

// Calendar route to display current month's calendar
router.get('/', (req, res) => {
  const currentMonthStart = startOfMonth(new Date());
  const currentMonthEnd = endOfMonth(new Date());

  const daysInMonth = eachDayOfInterval({
    start: currentMonthStart,
    end: currentMonthEnd
  });

  const formattedDays = daysInMonth.map(day => format(day, 'EEEE, MMMM do'));
  res.render('calendar', { formattedDays });
});

module.exports = router;
