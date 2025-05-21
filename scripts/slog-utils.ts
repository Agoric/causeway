#!/usr/bin/env ts-node

import { Block, Delivery, Syscall, SlogData } from '../app/types';

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
  data: AsyncIterable<Buffer>
): AsyncGenerator<Record<string, any>> {
  let buf = '';
  for await (const chunk of data) {
    buf += chunk;
    for (let pos = buf.indexOf('\n'); pos >= 0; pos = buf.indexOf('\n')) {
      const line = buf.slice(0, pos);
      yield JSON.parse(line);
      buf = buf.slice(pos + 1);
    }
  }
};

export const processSlogEntries = async (
  entries: AsyncIterable<Record<string, any>>
): Promise<SlogData> => {
  // Track vat information
  const vatInfo = new Map();
  // Track message deliveries
  const deliveries: Delivery[] = [];
  // Track syscalls
  const syscalls: Syscall[] = [];
  // Track blocks
  const blocks: Block[] = [];
  // Track promises
  const promises = new Map();

  let currentBlockHeight = 0;
  let currentBlockTime = 0;

  for await (const entry of entries) {
    switch (entry.type) {
      case 'create-vat':
        vatInfo.set(entry.vatID, {
          vatID: entry.vatID,
          name: entry.name || entry.vatID,
          time: entry.time,
        });
        break;

      case 'cosmic-swingset-begin-block':
        currentBlockHeight = entry.blockHeight;
        currentBlockTime = entry.blockTime;
        blocks.push({
          height: currentBlockHeight,
          time: entry.time,
          blockTime: currentBlockTime,
        });
        break;

      case 'deliver':
        if (entry.kd && entry.kd[0] === 'message') {
          const target = entry.kd[1];
          const methargs = entry.kd[2].methargs;
          const result = entry.kd[2].result;

          // Extract method name from smallcaps
          let methodName = 'unknown';
          try {
            const { methname } = extractSmallcaps(methargs);
            methodName = methname;
          } catch (error) {
            console.warn('Failed to extract method name:', error);
          }

          deliveries.push({
            type: 'message',
            crankNum: entry.crankNum,
            vatID: entry.vatID,
            target,
            method: methodName,
            result,
            time: entry.time,
            blockHeight: currentBlockHeight,
          });

          // Track promise if it exists
          if (result) {
            promises.set(result, {
              kpid: result,
              state: 'pending',
              created: entry.time,
              creator: entry.vatID,
            });
          }
        } else if (entry.kd && entry.kd[0] === 'notify') {
          for (const [kpid, resolution] of entry.kd[1]) {
            deliveries.push({
              type: 'notify',
              vatID: entry.vatID,
              kpid,
              state: resolution.state,
              time: entry.time,
              blockHeight: currentBlockHeight,
            });

            // Update promise state
            if (promises.has(kpid)) {
              const promise = promises.get(kpid);
              promise.state = resolution.state;
              promise.resolved = entry.time;
              promise.resolver = entry.vatID;
            }
          }
        }
        break;

      case 'syscall':
        if (entry.ksc && entry.ksc[0] === 'send') {
          const target = entry.ksc[1];
          const method = entry.ksc[2].method;
          const result = entry.ksc[2].result;

          syscalls.push({
            type: 'send',
            vatID: entry.vatID,
            target,
            method,
            result,
            time: entry.time,
            blockHeight: currentBlockHeight,
          });

          // Track promise if it exists
          if (result) {
            promises.set(result, {
              kpid: result,
              state: 'pending',
              created: entry.time,
              creator: entry.vatID,
            });
          }
        } else if (entry.ksc && entry.ksc[0] === 'resolve') {
          for (const resolution of entry.ksc[2]) {
            const [kpid, rejected] = resolution;

            syscalls.push({
              type: 'resolve',
              vatID: entry.vatID,
              kpid,
              rejected,
              time: entry.time,
              blockHeight: currentBlockHeight,
            });

            // Update promise state
            if (promises.has(kpid)) {
              const promise = promises.get(kpid);
              promise.state = rejected ? 'rejected' : 'fulfilled';
              promise.resolved = entry.time;
              promise.resolver = entry.vatID;
            }
          }
        }
        break;
    }
  }

  return {
    vats: Array.from(vatInfo.values()),
    deliveries,
    syscalls,
    blocks,
    promises: Array.from(promises.values()),
  };
};
