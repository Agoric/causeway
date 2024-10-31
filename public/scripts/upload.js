document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData();
  const fileInput = document.getElementById('fileInput');
  formData.append('file', fileInput.files[0]);

  try {
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData,
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
  }
});
