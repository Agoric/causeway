import { type NextRequest } from 'next/server';
import driver from '~/lib/neo4j';

export const GET = async (request: NextRequest) => {
  const session = driver.session();

  try {
    const searchParams = request.nextUrl.searchParams;
    const endTime = searchParams.get('endTime');
    const startTime = searchParams.get('startTime');

    const blockHeight = searchParams.get('blockHeight');
    const endTimestamp =
      parseFloat(endTime as string) || Math.floor(Date.now() / 1000);
    const startTimestamp = parseFloat(startTime as string) || 0;

    const filters = [
      blockHeight && 'event.blockHeight = $blockHeight',
      endTimestamp && 'event.time <= $endTime',
      startTimestamp && 'event.time >= $startTime',
    ]
      .filter(Boolean)
      .join(' AND ');

    const result = await session.run<{ vatID: string; vatName: string }>(
      `
      MATCH (event)
      WHERE (event:Message OR event:Notify) AND ${filters}
      OPTIONAL MATCH (caller:Vat)-[:CALLED_BY]->(event)
      OPTIONAL MATCH (event)-[:CALL]->(target:Vat)
      WITH collect(caller) + collect(target) AS vatNodes
      UNWIND vatNodes AS v
      WITH DISTINCT v
      WHERE v IS NOT NULL
      RETURN v.vatID   AS vatID,
            v.name    AS vatName

    `,
      {
        blockHeight: Number(blockHeight),
        endTime: endTimestamp,
        startTime: startTimestamp,
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
