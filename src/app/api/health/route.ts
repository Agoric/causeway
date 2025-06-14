import driver from '~/lib/neo4j';

export const GET = async (request: Request) => {
  try {
    await driver.verifyConnectivity();
    return new Response(
      JSON.stringify({ status: 'ok', message: 'Connected to Neo4j database' }),
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error('Health check failed:', error);
    return new Response(
      JSON.stringify({
        status: 'error',
        message: 'Failed to connect to Neo4j',
      }),
      {
        status: 500,
      },
    );
  }
};
