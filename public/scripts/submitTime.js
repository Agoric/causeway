document.getElementById('timeForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;
  const submitButton = document.getElementById('submitTimeButton');
  const spinner = document.getElementById('spinnerTimeForm');

  spinner.style.display = 'block';
  submitButton.disabled = true;

  try {
    const response = await fetch('/submit-time-range', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ startDate, endDate }),
    });

    if (response.ok) {
      console.log('Time range submitted successfully.');
    } else {
      console.error('Failed to submit time range');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    spinner.style.display = 'none';
    submitButton.disabled = false;
  }
});
