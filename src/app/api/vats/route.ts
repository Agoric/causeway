import driver from '~/lib/neo4j';

export const GET = async (request: Request) => {
  const session = driver.session();

  try {
    const result = await session.run<{ vatID: string; name: string }>(`
      MATCH (v:Vat)
      RETURN v.vatID as vatID, v.name as name
    `);
    const vats = result.records.map((record) => ({
      name: record.get('name'),
      vatID: record.get('vatID'),
    }));
    return new Response(JSON.stringify(vats), {
      status: 200,
    });
  } catch (error) {
    console.error('Error fetching vats:', error);
    return new Response('Failed to fetch vats', {
      status: 500,
    });
  } finally {
    await session.close();
  }
};
