export const logError = (error, verbose = false) => {
  if (error.response) {
    console.error(`🚨 Error: ${error.message}`);
    console.error(`  - Status: ${error.response.status}`);
    console.error(`  - Stack trace: ${error.stack}`);

    if (verbose) {
      console.error(
        `  - Data: ${JSON.stringify(error.response.data, null, 2)}`
      );
      console.error(
        `  - Headers: ${JSON.stringify(error.response.headers, null, 2)}`
      );
    }
  } else if (error.request) {
    console.error(`📡 No response received for the request:`);
    console.error(
      `  - Request details: ${JSON.stringify(error.request, null, 2)}`
    );
  } else {
    console.error(`💥 General Error: ${error.message}`);
    console.error(`  - Stack trace: ${error.stack}`);
  }
};
