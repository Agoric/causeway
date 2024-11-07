document
  .getElementById('blockHeightForm')
  .addEventListener('submit', async (e) => {
    e.preventDefault();

    const blockHeight = document.getElementById('blockHeight').value;
    const submitButton = document.getElementById('spinnerHeightForm');
    const spinner = document.getElementById('submitHeightButton');

    spinner.style.display = 'inline-block';
    submitButton.style.visibility = 'hidden';
    try {
      const response = await fetch('/submit-height', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ height: blockHeight }),
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
