import driver from '../../app/lib/neo4j';

const handler = async (_req, res) => {
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
