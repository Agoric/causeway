import { type Record } from 'neo4j-driver';
import { type NextRequest } from 'next/server';
import driver from '~/lib/neo4j';
import { Interaction } from 'types/common';

export const GET = async (request: NextRequest) => {
  const session = driver.session();

  try {
    const searchParams = request.nextUrl.searchParams;
    const endTime = searchParams.get('endTime');
    const startTime = searchParams.get('startTime');

    const startTimestamp = parseFloat(startTime as string) || 0;
    const endTimestamp =
      parseFloat(endTime as string) || Math.floor(Date.now() / 1000);

    const messageQuery = `
      MATCH (m:Message)-[call:CALL]->(target:Vat), (caller:Vat)-[:CALLED_BY]->(m)
      WHERE m.time >= $startTime AND m.time <= $endTime
      RETURN caller.vatID  AS sourceVat,
        m.method      AS method,
        m.result      AS promiseId,
        m.time        AS time,
        'message'     AS type,
        target.vatID  AS targetVat
      ORDER BY m.time
    `;

    const notifyQuery = `
      MATCH (n:Notify)-[:CALLED_BY]->(caller:Vat), (n)-[:CALL]->(target:Vat) 
      WHERE  n.time >= $startTime AND  n.time <= $endTime
      RETURN caller.vatID  AS sourceVat,
        n.kpid        AS promiseId,
        n.method      AS method,
        n.time        AS time,
        'notify'      AS type,
        target.vatID  AS targetVat
      ORDER BY n.time;
    `;

    const messageResult = await session.run<Interaction>(messageQuery, {
      startTime: startTimestamp,
      endTime: endTimestamp,
    });
    const notifyResult = await session.run<Interaction>(notifyQuery, {
      startTime: startTimestamp,
      endTime: endTimestamp,
    });

    const format = (record: Record<Interaction>) => ({
      method: record.get('method'),
      promiseId: record.get('promiseId'),
      sourceVat: record.get('sourceVat'),
      targetVat: record.get('targetVat'),
      time: record.get('time'),
      type: record.get('type'),
    });

    const allInteractions = [
      ...messageResult.records.map(format),
      ...notifyResult.records.map(format),
    ];

    return new Response(
      JSON.stringify({
        interactions: allInteractions,
        meta: {
          startTime: startTimestamp,
          endTime: endTimestamp,
          count: allInteractions.length,
        },
        vats: [],
      }),
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error fetching interactions:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch interactions' }),
      {
        status: 500,
      },
    );
  } finally {
    await session.close();
  }
};
