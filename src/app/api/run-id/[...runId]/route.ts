import { type NextRequest } from 'next/server';
import driver from '~/lib/neo4j';

export const GET = async (
  _: NextRequest,
  { params }: { params: Promise<{ runId: Array<string> }> },
) => {
  const { runId: runIds } = await params;
  const session = driver.session();

  const runId = runIds.join('/');
  console.log('runId: ', runId);

  try {
    const { records } = await session.run<Run>(
      `
      MATCH (run:Run)
      WHERE
        run.id = $id
      RETURN
        run.blockHeight         AS  blockHeight,
        run.blockTime           AS  blockTime,
        run.computrons          AS  computrons,
        run.id                  AS  id,
        run.number              AS  number,
        run.time                AS  time,
        run.triggerBundleHash   AS  triggerBundleHash,
        run.triggerMsgIdx       AS  triggerMsgIdx,
        run.triggerSender       AS  triggerSender,
        run.triggerSource       AS  triggerSource,
        run.triggerTxHash       AS  triggerTxHash,
        run.triggerType         AS  triggerType

    `,
      {
        id: runId,
      },
    );

    if (!records.length)
      return new Response(`Run ID '${runId}' not found`, {
        status: 400,
      });

    const record = records.find(Boolean)!;
    record.toObject;

    return new Response(JSON.stringify(record.toObject()), {
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
