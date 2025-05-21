import driver from '../../lib/neo4j';

const handler = async (req, res) => {
  const session = driver.session();
  try {
    const { startTime, endTime } = req.query;
    const startTimestamp = parseFloat(startTime) || 0;
    const endTimestamp = parseFloat(endTime) || Math.floor(Date.now() / 1000);

    const messageQuery = `
      MATCH (m:Message)-[call:CALL]->(target:Vat),
            (caller:Vat)-[:CALLED_BY]->(m)
      WHERE m.time >= $startTime AND m.time <= $endTime
      RETURN caller.vatID  AS sourceVat,
            target.vatID  AS targetVat,
            m.method as method,
            m.time as time,
            'message' as type
      ORDER BY m.time
    `;

    const notifyQuery = `
      MATCH  (n:Notify)-[:CALLED_BY]->(caller:Vat),
            (n)-[:CALL]->(target:Vat) 
      WHERE  n.time >= $startTime
        AND  n.time <= $endTime
      RETURN caller.vatID  AS sourceVat,
            target.vatID  AS targetVat,
            n.method      AS method,
            n.time        AS time,
            'notify'      AS type
      ORDER BY n.time;
    `;

    const messageResult = await session.run(messageQuery, {
      startTime: startTimestamp,
      endTime: endTimestamp,
    });
    const notifyResult = await session.run(notifyQuery, {
      startTime: startTimestamp,
      endTime: endTimestamp,
    });

    const format = (record) => ({
      sourceVat: record.get('sourceVat'),
      targetVat: record.get('targetVat'),
      method: record.get('method'),
      time: record.get('time').toNumber
        ? record.get('time').toNumber()
        : record.get('time'),
      type: record.get('type'),
    });

    const allInteractions = [
      ...messageResult.records.map(format),
      ...notifyResult.records.map(format),
    ];

    res.status(200).json({
      vats: [],
      interactions: allInteractions,
      meta: {
        startTime: startTimestamp,
        endTime: endTimestamp,
        count: allInteractions.length,
      },
    });
  } catch (error) {
    console.error('Error fetching interactions:', error);
    res.status(500).json({ error: 'Failed to fetch interactions' });
  } finally {
    await session.close();
  }
};

export default handler;
