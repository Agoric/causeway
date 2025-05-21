## Local setup

- To start the Agoric local chain and a Neo4j server in the background, use the following command:

  ```bash
  yarn start:chain
  ```

  Slogs are dynamically appended to `scripts/a3p.slog` for easy access outside the container.

- Install project dependencies:

  ```bash
  yarn install
  ```

- Import a3p slogs in `scripts/a3p.slog` to neo4j:

  ```bash
  yarn slogs:import
  ```

  Import `scripts/slogs.json` to neo4j

  ```bash
  yarn slogs:import-static
  ```

- Start the Next.js development server

  ```bash
  yarn dev
  ```
