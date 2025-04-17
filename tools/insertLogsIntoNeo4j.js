// This file is a copy of the root file, moved to the tools directory for better organization

// Original content from insertLogsIntoNeo4j.js
import { parseArgs } from 'node:util';
import { insertLogsIntoNeo4j } from './insertLogsIntoNeo4jCore.js';

// Parse command line arguments
const options = {
  infile: { type: 'string', short: 'i' },
  help: { type: 'boolean', short: 'h' }
};

const {
  values: { infile, help }
} = parseArgs({ options });

if (help || !infile) {
  console.log(`Usage: node insertLogsIntoNeo4j.js -i <inputFile>
  
Options:
  -i, --infile <file>   Input log file to process
  -h, --help            Show this help message
  `);
  process.exit(help ? 0 : 1);
}

// Call the main function with the provided input file
try {
  await insertLogsIntoNeo4j({ inputFile: infile });
  console.log('Log processing completed successfully');
} catch (error) {
  console.error('Error processing logs:', error);
  process.exit(1);
}