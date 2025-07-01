import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { FILE_ENCODING, makeSlogSender, SLOG_TYPES } from './slogger';

const processSlogs = async (
  slogfileName: string,
  slogger: Awaited<ReturnType<typeof makeSlogSender>>,
) => {
  const readStream = createReadStream(slogfileName, {
    autoClose: true,
    encoding: FILE_ENCODING,
  });
  const reader = createInterface({
    crlfDelay: Infinity,
    input: readStream,
  });

  reader.addListener('close', () => readStream.close());

  const allowedSlogTypes = [
    SLOG_TYPES.COSMIC_SWINGSET.BEGIN_BLOCK,
    SLOG_TYPES.COSMIC_SWINGSET.RUN.FINISH,
    SLOG_TYPES.COSMIC_SWINGSET_TRIGGERS.BRIDGE_INBOUND,
    SLOG_TYPES.COSMIC_SWINGSET_TRIGGERS.DELIVER_INBOUND,
    SLOG_TYPES.COSMIC_SWINGSET_TRIGGERS.INSTALL_BUNDLE,
    SLOG_TYPES.COSMIC_SWINGSET_TRIGGERS.TIMER_POLL,
    SLOG_TYPES.CREATE_VAT,
    SLOG_TYPES.DELIVER,
    SLOG_TYPES.SYSCALL,
  ];

  for await (const data of reader) {
    const slogEntry: Slog = JSON.parse(data);
    if (!allowedSlogTypes.includes(slogEntry.type)) continue;
    else slogger(slogEntry);
  }

  reader.close();
};

const run = async () => {
  const [_node, _script, ...slogfileNames] = process.argv;

  if (!slogfileNames.length)
    throw Error('Usage: node processSlogs.js slogFile...');

  const slogger = await makeSlogSender({ env: process.env });

  await Promise.all(
    slogfileNames.map((slogfileName) => processSlogs(slogfileName, slogger)),
  );
  await slogger.shutdown();
};

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
  process.exit(1);
});

run().catch((error) => {
  console.error('Error in main execution:', error);
  process.exit(1);
});
