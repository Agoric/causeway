const searchTypeSelect = document.getElementById('searchType');

searchTypeSelect.addEventListener('change', () => {
  const selection = document.getElementById('searchType').value;
  document.getElementById('blockHeightInput').style.display = 'none';
  document.getElementById('txHashInput').style.display = 'none';
  document.getElementById('searchTermInput').style.display = 'none';

  if (selection === 'blockHeight') {
    document.getElementById('blockHeightInput').style.display = 'block';
  } else if (selection === 'txHash') {
    document.getElementById('txHashInput').style.display = 'block';
  } else if (selection === 'searchTerm') {
    document.getElementById('searchTermInput').style.display = 'block';
  }
});

const validStrategies = new Set(['blockHeight', 'txHash', 'searchTerm']);

const isValidStrategy = (strategy) => {
  if (!validStrategies.has(strategy)) {
    return false;
  }
  return true;
};

document.getElementById('searchForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const search = document.querySelector('.searchInput').value;
  const strategy = document.getElementById('searchType').value;
  const spinner = document.getElementById('spinnerSearchForm');
  const submitButton = document.getElementById('submitSearchButton');
  const network = document.getElementById('networkSelect').value;

  spinner.style.display = 'inline-block';
  submitButton.style.visibility = 'hidden';
  try {
    if (!isValidStrategy(strategy)) {
      throw new Error(`Invalid strategy selected: ${strategy}`);
    }

    const response = await fetch('/submit-height', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        search,
        network,
        strategy,
      }),
    });

    if (response.ok) {
      const svgContent = await response.blob();
      const url = URL.createObjectURL(svgContent);

      const svgElement = document.getElementById('svgDisplay');
      svgElement.src = url;
      svgElement.style.display = 'inline-block';
    } else {
      let parsedResponse = await response.json();
      console.error('Failed to upload file:', parsedResponse.message);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    spinner.style.display = 'none';
    submitButton.style.visibility = 'visible';
  }
});
