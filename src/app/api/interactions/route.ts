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
      MATCH
        (message:Message)-[call:CALL]->(target:Vat),
        (source:Vat)-[:SYSCALL]->(syscall:Syscall)
      WHERE
        message.result = syscall.result AND ${createFilters('message')}
      RETURN
        message.argSize     AS argSize,
        message.blockHeight AS blockHeight,
        message.crankNum    AS crankNum,
        message.elapsed     AS elapsed,
        message.method      AS method,
        message.result      AS promiseId,
        message.target      AS targetId,
        message.time        AS time,
        'message'           AS type,
        source.vatID        AS sourceVat,
        target.vatID        AS targetVat
      ORDER BY message.time
    `;

    const notifyQuery = `
      MATCH
        (notify:Notify)-[:CALL]->(target:Vat),
        (source:Vat)-[:RESOLVE]->(resolve:Resolve)
      WHERE
        notify.kpid = resolve.result AND ${createFilters('notify')}
      RETURN
        0                   AS argSize,
        notify.blockHeight  AS blockHeight,
        0                   AS crankNum,
        notify.elapsed      AS elapsed,
        notify.method       AS method,
        0                   AS promiseId,
        notify.kpid         AS targetId,
        notify.time         AS time,
        'notify'            AS type,
        source.vatID        AS sourceVat,
        target.vatID        AS targetVat
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
      argSize: record.get('argSize'),
      blockHeight: record.get('blockHeight'),
      crankNum: record.get('crankNum'),
      elapsed: record.get('elapsed'),
      method: record.get('method'),
      promiseId: record.get('promiseId'),
      sourceVat: record.get('sourceVat'),
      targetId: record.get('targetId'),
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
