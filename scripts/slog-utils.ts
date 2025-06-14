import { SlogData, SlogEntries, TrackedPromise } from 'types/common';
import {
  Block,
  CosmicSwingsetBeginBlockLogEntry,
} from 'types/cosmic-swingset-block';
import { CreateVatLogEntry, Vat } from 'types/create-vat';
import { DeliverLogEntry, Delivery } from 'types/delivery';
import {
  Syscall,
  SyscallLogEntry,
  SyscallResolve,
  SyscallSend,
} from 'types/syscall';

/**
 * Helper to extract method name and slots from smallcaps
 */
const extractSmallcaps = (data: { body: string; slots?: any[] }) => {
  const { body, slots } = data;
  if (body[0] !== '#') {
    throw Error('ersatz decoder only handles smallcaps');
  }
  const methargs = JSON.parse(body.slice(1));
  return { methargs, slots: slots || [] };
};

const isSupportedSlogEntryLine = (line: string): boolean => {
  return /"type":"(create-vat|cosmic-swingset-begin-block|deliver|syscall)"/.test(
    line,
  );
};

export const readJSONLines = async function* (
  data: AsyncIterable<Buffer>,
): AsyncGenerator<Record<string, any>> {
  let buf = '';
  for await (const chunk of data) {
    buf += chunk;
    for (let pos = buf.indexOf('\n'); pos >= 0; pos = buf.indexOf('\n')) {
      let line = buf.slice(0, pos);
      buf = buf.slice(pos + 1);
      try {
        // Skip lines that are not relevant
        if (!isSupportedSlogEntryLine(line)) {
          continue;
        }

        yield JSON.parse(line);
      } catch (err) {
        const error = new Error(
          `❌ Failed to parse JSON line: ${line.slice(0, 300)}...`,
        );
        (error as any).line = line;
        (error as any).originalError = err;
        throw error;
      }
    }
  }
};

export const processSlogEntries = async (
  entries: AsyncIterable<SlogEntries>,
): Promise<SlogData> => {
  const vats: Vat[] = [];
  const blocks: Block[] = [];
  const deliveries: Delivery[] = [];
  const syscalls: Syscall[] = [];
  const promises: Map<string, TrackedPromise> = new Map();

  let currentBlockHeight = 0;

  for await (const entry of entries) {
    switch (entry.type) {
      case 'create-vat': {
        const createVatEntry = entry as CreateVatLogEntry;
        const { vatID, name, time } = createVatEntry;
        vats.push({
          vatID,
          name: name || vatID,
          time,
        });
        break;
      }
      case 'cosmic-swingset-begin-block': {
        const beginBlockEntry = entry as CosmicSwingsetBeginBlockLogEntry;
        const { blockHeight, time, blockTime } = beginBlockEntry;
        currentBlockHeight = beginBlockEntry.blockHeight;
        blocks.push({
          height: blockHeight,
          time: time,
          blockTime: blockTime,
        });
        break;
      }
      case 'deliver': {
        const deliverEntry = entry as DeliverLogEntry;
        const { vatID, crankNum, time, kd } = deliverEntry;
        if (!kd) break;

        if (kd[0] === 'message') {
          const target = kd[1];
          const methargs = kd[2].methargs;
          const result = kd[2].result;

          let method = 'unknown';
          let methodArguments = 'unknown';
          try {
            const { methargs: args } = extractSmallcaps(methargs);
            method = args[0];
            methodArguments = args[1];
          } catch (error) {
            console.warn('Failed to extract method name:', error);
          }

          deliveries.push({
            type: 'message',
            crankNum,
            vatID,
            target,
            method,
            methargs: methodArguments,
            result,
            time,
            blockHeight: currentBlockHeight,
          });

          // Track promise if it exists
          if (result) {
            promises.set(result, {
              kpid: result,
              state: 'pending',
              created: time,
              creator: vatID,
            });
          }
        } else if (kd[0] === 'notify') {
          for (const [kpid, resolution] of kd[1]) {
            deliveries.push({
              type: 'notify',
              vatID,
              kpid,
              state: resolution.state,
              time,
              blockHeight: currentBlockHeight,
            });

            if (promises.has(kpid)) {
              const promise = promises.get(kpid)!;
              promise.state = resolution.state;
              promise.resolved = time;
              promise.resolver = vatID;
            }
          }
        }
        break;
      }
      case 'syscall': {
        const syscallEntry = entry as SyscallLogEntry;
        const { vatID, time, ksc } = syscallEntry;
        if (!ksc) break;

        if (ksc[0] === 'send') {
          const target = ksc[1];
          const methargs = ksc[2].methargs;
          const result = ksc[2].result;

          let method = 'unknown';
          let methodArguments = 'unknown';
          try {
            const { methargs: args } = extractSmallcaps(methargs);
            method = args[0];
            methodArguments = args[1];
          } catch (error) {
            console.warn('Failed to extract method name:', error);
          }

          const syscall: SyscallSend = {
            type: 'send',
            vatID,
            target,
            method,
            methargs: methodArguments,
            result,
            time,
            blockHeight: currentBlockHeight,
          };

          syscalls.push(syscall);

          // Track promise if it exists
          if (result) {
            promises.set(result, {
              kpid: result,
              state: 'pending',
              created: time,
              creator: vatID,
            });
          }
        } else if (ksc[0] === 'resolve') {
          const resolutions = ksc[2];
          for (const [kpid, rejected] of resolutions) {
            const syscall: SyscallResolve = {
              type: 'resolve',
              vatID,
              kpid,
              rejected,
              time,
              blockHeight: currentBlockHeight,
            };

            syscalls.push(syscall);

            // Update the state of the resolved promise
            if (promises.has(kpid)) {
              const promise = promises.get(kpid)!;
              promise.state = rejected ? 'rejected' : 'fulfilled';
              promise.resolved = time;
              promise.resolver = vatID;
            }
          }
        }
        break;
      }
    }
  }

  return {
    vats,
    deliveries,
    syscalls,
    blocks,
    promises: Array.from(promises.values()),
  };
};
