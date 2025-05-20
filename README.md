## Local setup

1. Start neo4j server
```bash
docker run \
  --name neo4j \
  -p 7474:7474 \
  -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/secretpassword \
  --rm neo4j:latest
```
2. Import slogs to neo4j

```bash
(cd scripts; node slog2neo4j.js ../data/slogs.json)
```

3. Build and run the API server and UI

```bash
yarn install
yarn start
```
Above will start an API server to expose neo4j data and a UI to visualize the data.