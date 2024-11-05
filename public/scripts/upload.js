document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData();
  const fileInput = document.getElementById('fileInput');
  const uploadButton = document.getElementById('uploadFileButton');

  formData.append('file', fileInput.files[0]);

  const spinner = document.getElementById('spinnerFileForm');
  spinner.style.display = 'inline-block';
  uploadButton.style.display = 'none';

  try {
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData,
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
    uploadButton.style.display = 'inline-block';
  }
});
