# Neo4j Slog Processing Tools

This directory contains tools for processing Agoric slog files and inserting data into Neo4j. These tools are used for analyzing and visualizing Agoric smart contract execution events.

## Tools Overview

### insertLogsIntoNeo4j.js
Command-line entry point for inserting Agoric slog data into Neo4j. This script parses arguments and calls the core functionality.

```
node insertLogsIntoNeo4j.js -i <inputFile>
```

### insertLogsIntoNeo4jCore.js
Core functionality for parsing slog events and inserting them into Neo4j. This creates a graph representation of vats, messages, syscalls, and other Agoric execution data.

### processSlogSvg.js
Generates SVG and PlantUML sequence diagrams from Agoric slog files. This visualizes the interactions between vats and the execution flow.

```
node processSlogSvg.js <inputFile> [outputFile]
```

### processSlogs.js
Alternative implementation for processing slog files and inserting data into Neo4j with additional database schema setup, metrics tracking, and analysis queries.

```
node processSlogs.js <slogFile>
```

### slog2neo4j.js
Combines diagram generation with Neo4j storage. This uses the processSlogEntries function from processSlogSvg.js to create a consistent graph representation.

```
node slog2neo4j.js <inputFile>
```

## Common Usage

1. Process a slog file and insert data into Neo4j:
   ```
   node insertLogsIntoNeo4j.js -i path/to/slog.jsonl
   ```

2. Generate a sequence diagram from a slog file:
   ```
   node processSlogSvg.js path/to/slog.jsonl output.svg
   ```

3. Process a slog file with enhanced metrics and analysis:
   ```
   node processSlogs.js path/to/slog.jsonl
   ```

## Environment Variables

These tools respect the following environment variables:

- `NEO4J_URI`: URI for connecting to Neo4j (default: `bolt://localhost:7687`)
- `NEO4J_USER`: Neo4j username (default: `neo4j`)
- `NEO4J_PASSWORD`: Neo4j password (default: `secretpassword`)
- `BATCH_SIZE`: Size of batches for database operations (default: `10`)
- `BATCH_RETRIES`: Number of retries for database operations (default: `3`)

## Integration with Web App

The web application in the parent directory uses these tools indirectly. It connects to the Neo4j database populated by these tools to generate sequence diagrams in the browser.