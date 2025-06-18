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

    const result = await session.run<{ runID: string }>(
      `
      MATCH (event)
      WHERE (event:Message OR event:Notify) AND ${filters}
      MATCH (event)-[:CALL]->(:Vat)
      WITH collect(event) AS events
      UNWIND events AS event
      WITH DISTINCT event.runID AS runID
      WHERE runID IS NOT NULL
      RETURN runID

    `,
      {
        blockHeight: Number(blockHeight),
        endTime: endTimestamp,
        startTime: startTimestamp,
      },
    );
    const uniqueRunIds = result.records.map((record) => record.get('runID'));
    return new Response(JSON.stringify(uniqueRunIds), {
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
