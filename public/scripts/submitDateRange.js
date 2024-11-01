document.getElementById('dateForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;
  const submitButton = document.getElementById('submitDateButton');
  const spinner = document.getElementById('spinnerDateForm');

  spinner.style.display = 'block';
  submitButton.disabled = true;

  try {
    const response = await fetch('/submit-date-range', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ startDate, endDate }),
    });

    if (response.ok) {
      const svgContent = await response.blob();
      const url = URL.createObjectURL(svgContent);

      const newWindow = window.open();
      newWindow.document.write(`<img src="${url}" alt="Uploaded SVG Image" />`);
    } else {
      console.error('Failed to upload file');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    spinner.style.display = 'none';
    submitButton.disabled = false;
  }
});
