import neo4j from 'neo4j-driver';

let driverInstance;

const getDriver = () => {
  if (!driverInstance) {
    const { NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD } = process.env;
    if (!NEO4J_URI || !NEO4J_USER || !NEO4J_PASSWORD) {
      throw new Error(
        'Missing Neo4j connection parameters in environment variables'
      );
    }

    driverInstance = neo4j.driver(
      NEO4J_URI,
      neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
      {
        encrypted:
          NEO4J_URI.includes('neo4j+s') || NEO4J_URI.includes('bolt+s'),
        disableLosslessIntegers: true,
      }
    );
  }
  return driverInstance;
};

export default getDriver();
