import { type NextRequest } from 'next/server';
import driver from '~/lib/neo4j';

export const GET = async (request: NextRequest) => {
  const session = driver.session();

  try {
    const searchParams = request.nextUrl.searchParams;
    const endTime = searchParams.get('endTime');
    const startTime = searchParams.get('startTime');

    const endTimestamp =
      parseFloat(endTime as string) || Math.floor(Date.now() / 1000);
    const startTimestamp = parseFloat(startTime as string) || 0;

    const result = await session.run<{ vatID: string; vatName: string }>(
      `
      MATCH (evt)
      WHERE (evt:Message OR evt:Notify)
        AND evt.time >= $startTime
        AND evt.time <= $endTime
      OPTIONAL MATCH (caller:Vat)-[:CALLED_BY]->(evt)
      OPTIONAL MATCH (evt)-[:CALL]->(target:Vat)
      WITH collect(caller) + collect(target) AS vatNodes
      UNWIND vatNodes AS v
      WITH DISTINCT v
      WHERE v IS NOT NULL
      RETURN v.vatID   AS vatID,
            v.name    AS vatName

    `,
      {
        startTime: startTimestamp,
        endTime: endTimestamp,
      },
    );
    const vats = result.records.map((record) => ({
      name: record.get('vatName'),
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
