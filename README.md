## Local setup

1. Start neo4j server:

```bash
yarn start:neo4j
```

2. Install project dependencies:

```bash
yarn install
```

3. Import slogs to neo4j

```bash
(cd scripts; node slog2neo4j.js ../data/slogs.json)
```

4. Start the Next.js development server

```bash
yarn dev
```
