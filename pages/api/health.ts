import driver from '../../lib/neo4j';

import type { NextApiRequest, NextApiResponse } from 'next';

const handler = async (_req: NextApiRequest, res: NextApiResponse) => {
  try {
    await driver.verifyConnectivity();
    res
      .status(200)
      .json({ status: 'ok', message: 'Connected to Neo4j database' });
  } catch (error) {
    console.error('Health check failed:', error);
    res
      .status(500)
      .json({ status: 'error', message: 'Failed to connect to Neo4j' });
  }
};

export default handler;
