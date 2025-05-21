import driver from '../../lib/neo4j';

import type { NextApiRequest, NextApiResponse } from 'next';

const handler = async (_req: NextApiRequest, res: NextApiResponse) => {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (v:Vat)
      RETURN v.vatID as vatID, v.name as name
    `);

    const vats = result.records.map((record) => ({
      vatID: record.get('vatID'),
      name: record.get('name'),
    }));

    res.status(200).json(vats);
  } catch (error) {
    console.error('Error fetching vats:', error);
    res.status(500).json({ error: 'Failed to fetch vats' });
  } finally {
    await session.close();
  }
};

export default handler;
