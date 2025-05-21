import neo4j, { Driver } from 'neo4j-driver';

let driverInstance: Driver;

const getDriver = () => {
  if (!driverInstance) {
    const NEO4J_URI = process.env.NEO4J_URI || 'neo4j://localhost:7687';
    const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
    const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'secretpassword';

    driverInstance = neo4j.driver(
      NEO4J_URI,
      neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
      {
        encrypted:
          NEO4J_URI.includes('neo4j+s') || NEO4J_URI.includes('bolt+s'),
        disableLosslessIntegers: true,
      },
    );
  }
  return driverInstance;
};

export default getDriver();
