document.getElementById('dateForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const startDate = document.getElementById('startDate').value;
  const submitButton = document.getElementById('submitDateButton');
  const spinner = document.getElementById('spinnerDateForm');

  spinner.style.display = 'inline-block';
  submitButton.style.visibility = 'hidden';
  try {
    const response = await fetch('/submit-date-range', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ startDate }),
    });

    if (response.ok) {
      const svgContent = await response.blob();
      const url = URL.createObjectURL(svgContent);

      const svgElement = document.getElementById('svgDisplay');
      svgElement.src = url;
      svgElement.style.display = 'inline-block';
    } else {
      console.error('Failed to upload file');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    spinner.style.display = 'none';
    submitButton.style.visibility = 'visible';
  }
});
