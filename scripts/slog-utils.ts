import {
  Block,
  CosmicSwingsetBeginBlockLogEntry,
} from '../app/types/cosmic-swingset-block';
import { Vat, CreateVatLogEntry } from '../app/types/create-vat';
import { DeliverLogEntry, Delivery } from '../app/types/delivery';
import {
  Syscall,
  SyscallLogEntry,
  SyscallResolve,
  SyscallSend,
} from '../app/types/syscall';
import { SlogData, TrackedPromise } from '../app/types/common';

/**
 * Helper to extract method name and slots from smallcaps
 */
const extractSmallcaps = (methargs_smallcaps: {
  body: string;
  slots?: any[];
}) => {
  const { body, slots } = methargs_smallcaps;
  if (body[0] !== '#') {
    throw Error('ersatz decoder only handles smallcaps');
  }
  const methargs = JSON.parse(body.slice(1));
  const methname = methargs[0];
  return { methname, slots: slots || [] };
};

export const readJSONLines = async function* (
  data: AsyncIterable<Buffer>,
): AsyncGenerator<Record<string, any>> {
  let buf = '';
  for await (const chunk of data) {
    buf += chunk;
    for (let pos = buf.indexOf('\n'); pos >= 0; pos = buf.indexOf('\n')) {
      const line = buf.slice(0, pos);
      try {
        yield JSON.parse(line);
      } catch (err) {
        const error = new Error(`Failed to parse JSON line: ${line}`);
        (error as any).line = line;
        (error as any).originalError = err;
        throw error;
      }
      buf = buf.slice(pos + 1);
    }
  }
};

export const processSlogEntries = async (
  entries: AsyncIterable<Record<string, any>>,
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
        vats.push({
          vatID: createVatEntry.vatID,
          name: createVatEntry.name || createVatEntry.vatID,
          time: createVatEntry.time,
        });
        break;
      }
      case 'cosmic-swingset-begin-block': {
        const beginBlockEntry = entry as CosmicSwingsetBeginBlockLogEntry;
        // TODO: understand why this height is used in `deliver` and `syscall` entries
        currentBlockHeight = beginBlockEntry.blockHeight;
        blocks.push({
          height: beginBlockEntry.blockHeight,
          time: beginBlockEntry.time,
          blockTime: beginBlockEntry.blockTime,
        });
        break;
      }
      case 'deliver': {
        const deliverEntry = entry as DeliverLogEntry;

        if (deliverEntry.kd && deliverEntry.kd[0] === 'message') {
          const target = deliverEntry.kd[1];
          const methargs = deliverEntry.kd[2].methargs;
          const result = deliverEntry.kd[2].result;

          let methodName = 'unknown';
          try {
            const { methname } = extractSmallcaps(methargs);
            methodName = methname;
          } catch (error) {
            console.warn('Failed to extract method name:', error);
          }

          deliveries.push({
            type: 'message',
            crankNum: deliverEntry.crankNum,
            vatID: deliverEntry.vatID,
            target,
            method: methodName,
            result,
            time: deliverEntry.time,
            blockHeight: currentBlockHeight,
          });

          // Track promise if it exists
          if (result) {
            promises.set(result, {
              kpid: result,
              state: 'pending',
              created: deliverEntry.time,
              creator: deliverEntry.vatID,
            });
          }
        } else if (deliverEntry.kd && deliverEntry.kd[0] === 'notify') {
          for (const [kpid, resolution] of deliverEntry.kd[1]) {
            deliveries.push({
              type: 'notify',
              vatID: deliverEntry.vatID,
              kpid,
              state: resolution.state,
              time: deliverEntry.time,
              blockHeight: currentBlockHeight,
            });

            if (promises.has(kpid)) {
              const promise = promises.get(kpid)!;
              promise.state = resolution.state;
              promise.resolved = deliverEntry.time;
              promise.resolver = deliverEntry.vatID;
            }
          }
        }
        break;
      }
      case 'syscall': {
        const syscallEntry = entry as SyscallLogEntry;

        if (syscallEntry.ksc && syscallEntry.ksc[0] === 'send') {
          const target = syscallEntry.ksc[1];
          const method = syscallEntry.ksc[2].methargs
            ? (extractSmallcaps(syscallEntry.ksc[2].methargs)?.methname ??
              'unknown')
            : 'unknown';
          const result = syscallEntry.ksc[2].result;

          const syscall: SyscallSend = {
            type: 'send',
            vatID: syscallEntry.vatID,
            target,
            method,
            result,
            time: syscallEntry.time,
            blockHeight: currentBlockHeight,
          };

          syscalls.push(syscall);

          // Track promise if it exists
          if (result) {
            promises.set(result, {
              kpid: result,
              state: 'pending',
              created: syscallEntry.time,
              creator: syscallEntry.vatID,
            });
          }
        } else if (syscallEntry.ksc && syscallEntry.ksc[0] === 'resolve') {
          const resolutions = syscallEntry.ksc[2];
          for (const [kpid, rejected] of resolutions) {
            const syscall: SyscallResolve = {
              type: 'resolve',
              vatID: syscallEntry.vatID,
              kpid,
              rejected,
              time: syscallEntry.time,
              blockHeight: currentBlockHeight,
            };

            syscalls.push(syscall);

            // Update the state of the resolved promise
            if (promises.has(kpid)) {
              const promise = promises.get(kpid)!;
              promise.state = rejected ? 'rejected' : 'fulfilled';
              promise.resolved = syscallEntry.time;
              promise.resolver = syscallEntry.vatID;
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
