import { insertLogsIntoNeo4j } from './insertLogsIntoNeo4jCore.js'; 
// Assuming that the logic we wrote before (like the insertLogsIntoNeo4j function) 
// is in a separate file called insertLogsIntoNeo4jCore.js for clarity. 
// If it's in the same file, just use it directly.

function parseArgs() {
  const args = process.argv.slice(2); // Get arguments after `npm start --`
  
  // Default value if not provided
  let inputFile = 'path/to/default-slog.jsonl';
  
  for (const arg of args) {
    if (arg.startsWith('--inputFile=')) {
      inputFile = arg.split('=')[1];
    }
  }
  
  return { inputFile };
}

async function main() {
  const { inputFile } = parseArgs();
  console.log(`Inserting logs from: ${inputFile}`);
  await insertLogsIntoNeo4j({ inputFile });
  console.log('Insertion complete');
}

main().catch(err => {
  console.error('Error running insertLogsIntoNeo4j:', err);
  process.exit(1);
});
