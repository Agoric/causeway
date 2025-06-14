import { type Record } from 'neo4j-driver';
import { type NextRequest } from 'next/server';
import driver from '~/lib/neo4j';
import { Interaction } from 'types/common';

export const GET = async (request: NextRequest) => {
  const session = driver.session();

  try {
    const searchParams = request.nextUrl.searchParams;

    const blockHeight = searchParams.get('blockHeight');
    const endTime = searchParams.get('endTime');
    const startTime = searchParams.get('startTime');

    const startTimestamp = parseFloat(startTime as string) || 0;
    const endTimestamp =
      parseFloat(endTime as string) || Math.floor(Date.now() / 1000);

    const createFilters = (nodeName: string) =>
      [
        blockHeight && `${nodeName}.blockHeight = $blockHeight`,
        endTimestamp && `${nodeName}.time <= $endTime`,
        startTimestamp && `${nodeName}.time >= $startTime`,
      ]
        .filter(Boolean)
        .join(' AND ');

    const messageQuery = `
      MATCH (message:Message)-[call:CALL]->(target:Vat), (caller:Vat)-[:CALLED_BY]->(message)
      WHERE ${createFilters('message')}
      RETURN caller.vatID  AS sourceVat,
        message.method      AS method,
        message.result      AS promiseId,
        message.time        AS time,
        'message'     AS type,
        target.vatID  AS targetVat
      ORDER BY message.time
    `;

    const notifyQuery = `
      MATCH (notify:Notify)-[:CALLED_BY]->(caller:Vat), (notify)-[:CALL]->(target:Vat)
      WHERE ${createFilters('notify')}
      RETURN caller.vatID  AS sourceVat,
        notify.kpid        AS promiseId,
        notify.method      AS method,
        notify.time        AS time,
        'notify'      AS type,
        target.vatID  AS targetVat
      ORDER BY notify.time;
    `;

    const messageResult = await session.run<Interaction>(messageQuery, {
      blockHeight: Number(blockHeight),
      endTime: endTimestamp,
      startTime: startTimestamp,
    });
    const notifyResult = await session.run<Interaction>(notifyQuery, {
      blockHeight: Number(blockHeight),
      endTime: endTimestamp,
      startTime: startTimestamp,
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
