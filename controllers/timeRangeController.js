export const handleTimeRange = (req, res) => {
  const { startDate, endDate } = req.body;

  if (!startDate || !endDate) {
    return res
      .status(400)
      .json({ message: 'Both start date and end date are required.' });
  }

  console.log(`Received time range - Start: ${startDate}, End: ${endDate}`);

  res.status(200).json({
    message: 'Time range received successfully',
    data: { startDate, endDate },
  });
};
