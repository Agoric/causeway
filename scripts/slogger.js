import { readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { auth, driver as createDriver, int as neoInt } from 'neo4j-driver';
import { makeContextualSlogProcessor } from '@agoric/telemetry/src/context-aware-slog.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONTEXT_FILE = 'slog-context.json';
const FILE_ENCODING = 'utf8';
export const SLOG_TYPES = {
  CLIST: 'clist',
  CONSOLE: 'console',
  COSMIC_SWINGSET: {
    AFTER_COMMIT_STATS: 'cosmic-swingset-after-commit-stats',
    BEGIN_BLOCK: 'cosmic-swingset-begin-block',
    BOOTSTRAP_BLOCK: {
      FINISH: 'cosmic-swingset-bootstrap-block-finish',
      START: 'cosmic-swingset-bootstrap-block-start',
    },
    COMMIT: {
      FINISH: 'cosmic-swingset-commit-block-finish',
      START: 'cosmic-swingset-commit-block-start',
    },
    END_BLOCK: {
      FINISH: 'cosmic-swingset-end-block-finish',
      START: 'cosmic-swingset-end-block-start',
    },
    RUN: {
      FINISH: 'cosmic-swingset-run-finish',
      START: 'cosmic-swingset-run-start',
    },
    UPGRADE: {
      FINISH: 'cosmic-swingset-upgrade-finish',
      START: 'cosmic-swingset-upgrade-start',
    },
  },
  COSMIC_SWINGSET_TRIGGERS: {
    BRIDGE_INBOUND: 'cosmic-swingset-bridge-inbound',
    DELIVER_INBOUND: 'cosmic-swingset-deliver-inbound',
    TIMER_POLL: 'cosmic-swingset-timer-poll',
    INSTALL_BUNDLE: 'cosmic-swingset-install-bundle',
  },
  CRANK: {
    FINISH: 'crank-finish',
    START: 'crank-start',
  },
  CREATE_VAT: 'create-vat',
  DELIVER: 'deliver',
  DELIVER_RESULT: 'deliver-result',
  KERNEL: {
    INIT: {
      FINISH: 'kernel-init-finish',
      START: 'kernel-init-start',
    },
  },
  REPLAY: {
    FINISH: 'finish-replay',
    START: 'start-replay',
  },
  SYSCALL: 'syscall',
  SYSCALL_RESULT: 'syscall-result',
};

// @ts-ignore
if (!globalThis.assert)
  // @ts-ignore
  globalThis.assert = (val) => {
    if (!val) throw Error(`value ${val} is not truthy`);
  };

/**
 * @param {string} filePath
 */
const getContextFilePersistenceUtils = (filePath) => {
  console.warn(`Using file ${filePath} for slogger context`);

  return {
    /**
     * @param {Context} context
     */
    persistContext: (context) => {
      try {
        writeFileSync(filePath, serializeSlogObj(context), FILE_ENCODING);
      } catch (err) {
        console.error('Error writing context to file: ', err);
      }
    },

    /**
     * @returns {Context | null}
     */
    restoreContext: () => {
      try {
        return JSON.parse(readFileSync(filePath, FILE_ENCODING));
      } catch (parseErr) {
        console.error('Error reading context from file: ', parseErr);
        return null;
      }
    },
  };
};

/**
 * @param {Context} slogObj
 */
const serializeSlogObj = (slogObj) =>
  JSON.stringify(slogObj, (_, value) =>
    typeof value === BigInt.name.toLowerCase() ? Number(value) : value,
  );

/**
 * @param {ReturnType<ReturnType<typeof createDriver>['session']>} session
 */
const setupIndexes = async (session) => {
  const indexes = [
    'CREATE INDEX message_result IF NOT EXISTS FOR (message:Message) ON (message.result)',
    'CREATE INDEX message_runId IF NOT EXISTS FOR (message:Message) ON (message.runID)',
    'CREATE INDEX notify_kpid IF NOT EXISTS FOR (notify:Notify) ON (notify.kpid)',
    'CREATE INDEX notify_runId IF NOT EXISTS FOR (notify:Notify) ON (notify.runID)',
    'CREATE INDEX resolve_result IF NOT EXISTS FOR (resolve:Resolve) ON (resolve.result)',
    'CREATE INDEX syscall_result IF NOT EXISTS FOR (syscall:Syscall) ON (syscall.result)',
  ];

  for (const index of indexes) await session.run(index);
  await session.close();
};

/**
 * @param {MakeSlogSenderOptions} options
 */
export const makeSlogSender = async (options) => {
  const NEO4J_PASSWORD = options.env.NEO4J_PASSWORD || 'secretpassword';
  const NEO4J_URI = options.env.NEO4J_URI || 'neo4j://localhost:7687';
  const NEO4J_USER = options.env.NEO4J_USER || 'neo4j';

  const driver = createDriver(NEO4J_URI);
  const persistenceUtils = getContextFilePersistenceUtils(
    options.env.SLOG_CONTEXT_FILE_PATH ||
      `${options.stateDir || __dirname}/${DEFAULT_CONTEXT_FILE}`,
  );

  const createNewSession = () =>
    driver.session({
      auth: auth.basic(NEO4J_USER, NEO4J_PASSWORD),
    });

  /**
   * @param {Array<() => Promise<void>>} promises
   */
  const addPromisesToChain = (...promises) =>
    promises.forEach(
      (promise) =>
        (promiseChain = promiseChain.then(promise, (err) =>
          console.log('Caught error: ', err),
        )),
    );

  /**
   * @param {SwingSetCapData} data
   */
  const extractSmallcaps = (data) => {
    const { body, slots = [] } = data;
    if (body[0] !== '#') throw Error('decoder only handles smallcaps');
    const methargs = JSON.parse(body.slice(1));
    return { methargs, slots };
  };

  /**
   *
   * @param {{[key: string]: any}} obj
   * @returns
   */
  const prepareParams = (obj) =>
    Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toNeoProp(v)]));

  /**
   * @param {any} value
   */
  const toNeoProp = (value) => {
    if (typeof value === 'bigint') return neoInt(value);
    else if (value && typeof value === 'object') return JSON.stringify(value);
    else return value;
  };

  const contextualSlogProcessor = makeContextualSlogProcessor(
    {},
    persistenceUtils,
  );
  await setupIndexes(createNewSession());

  /** @type {Slog['blockHeight']} */
  let currentBlockHeight = 0;
  /** @type {Slog['time']} */
  let lastBlockTime = 0;
  let promiseChain = Promise.resolve();
  const session = createNewSession();

  const callBacks = {
    [SLOG_TYPES.COSMIC_SWINGSET.BEGIN_BLOCK]:
      /**
       * @param {ReturnType<typeof contextualSlogProcessor>} slog
       */
      ({ body: { blockHeight, blockTime }, time }) => {
        currentBlockHeight = blockHeight;
        addPromisesToChain(async () => {
          await session.run(
            `MERGE (
                block:Block {
                  height: $height
                }
              )
             SET block.time = $time, block.blockTime = $blockTime`,
            prepareParams({ blockTime, height: blockHeight, time }),
          );
        });
      },
    [SLOG_TYPES.CREATE_VAT]:
      /**
       * @param {ReturnType<typeof contextualSlogProcessor>} slog
       */
      ({ body: { name, vatID }, time }) =>
        addPromisesToChain(async () => {
          await session.run(
            `MERGE (
                vat:Vat {
                  vatID: $vatID
                }
              )
             SET vat.name = $name, vat.createdAt = $time`,
            prepareParams({ name: name || vatID, time, vatID }),
          );
        }),
    [SLOG_TYPES.DELIVER]:
      /**
       * @param {ReturnType<typeof contextualSlogProcessor>} slog
       */
      ({ attributes, body, time }) => {
        const { crankNum, kd, type, vatID } = body;
        const deliveryNum = body.deliveryNum || attributes['crank.deliveryNum'];
        const runID = attributes['run.id'] || 'N/A';

        if (!kd) return;
        const [deliveryType] = kd;

        switch (deliveryType) {
          case 'message': {
            const [, ...rest] = kd;
            const [target, { methargs, result }] = rest;

            let method = 'unknown';
            let methodArguments = 'unknown';
            try {
              const { methargs: args } = extractSmallcaps(methargs);
              [method, methodArguments] = args;
            } catch (error) {
              console.warn('Failed to extract method name:', error);
            }

            addPromisesToChain(async () => {
              await session.run(
                `CREATE (
                    message:Message {
                      argSize: $argSize,
                      blockHeight: $blockHeight,
                      crankNum: $crankNum,
                      deliveryNum: $deliveryNum,
                      elapsed: $elapsed,
                      methargs: $methargs,
                      method: $method,
                      result: $result,
                      runID: $runID,
                      target: $target,
                      time: $time,
                      type: $type
                    }
                  )
                 WITH message
                 MATCH (vat:Vat {vatID: $vatID})
                 CREATE (message)-[
                    :CALL
                  ]->(vat)`,
                prepareParams({
                  argSize: methargs.body.length,
                  blockHeight: currentBlockHeight,
                  crankNum,
                  deliveryNum,
                  elapsed: time - lastBlockTime,
                  methargs: methodArguments || 'unknown',
                  method,
                  result,
                  runID,
                  target,
                  time,
                  type,
                  vatID,
                }),
              );
            });

            break;
          }
          case 'notify': {
            const [, resolutions] = kd;
            for (const [kpid, { state = 'unknown' }] of resolutions) {
              addPromisesToChain(async () => {
                await session.run(
                  `CREATE (
                      notify:Notify {
                        blockHeight: $blockHeight,
                        elapsed: $elapsed,
                        kpid: $kpid,
                        method: $state,
                        runID: $runID,
                        time: $time,
                        type: $type
                      }
                    )
                   WITH notify
                   MATCH (vat:Vat {vatID: $vatID})
                   CREATE (notify)-[
                      :CALL
                    ]->(vat)`,
                  prepareParams({
                    blockHeight: currentBlockHeight,
                    elapsed: time - lastBlockTime,
                    kpid,
                    runID,
                    state,
                    time,
                    type,
                    vatID,
                  }),
                );
              });
            }

            break;
          }
          default:
            break;
        }
      },
    [SLOG_TYPES.SYSCALL]:
      /**
       * @param {ReturnType<typeof contextualSlogProcessor>} slog
       */
      ({ attributes, body, time }) => {
        const { ksc, type, vatID } = body;
        const runID = attributes['run.id'] || 'N/A';

        if (!ksc) return;
        const [kernelSyscallType] = ksc;

        switch (kernelSyscallType) {
          case 'resolve': {
            const [_, __, parts] = ksc;
            for (const [kp] of parts) {
              addPromisesToChain(async () => {
                await session.run(
                  `CREATE (
                      resolve:Resolve {
                        blockHeight: $blockHeight,
                        elapsed: $elapsed,
                        result: $result,
                        runID: $runID,
                        time: $time,
                        type: $type
                      }
                    )
                   WITH resolve
                   MATCH (vat:Vat {vatID: $vatID})
                   CREATE (vat)-[
                      :RESOLVE
                    ]->(resolve)`,
                  prepareParams({
                    blockHeight: currentBlockHeight,
                    elapsed: time - lastBlockTime,
                    result: kp,
                    runID,
                    time,
                    type,
                    vatID,
                  }),
                );
              });
            }
            break;
          }
          case 'send': {
            const [, target, { methargs, result }] = ksc;

            let method = 'unknown';
            let methodArguments = 'unknown';
            try {
              const { methargs: args } = extractSmallcaps(methargs);
              [method, methodArguments] = args;
            } catch (error) {
              console.warn('Failed to extract method name:', error);
            }

            addPromisesToChain(async () => {
              await session.run(
                `CREATE (
                    syscall:Syscall {
                      blockHeight: $blockHeight,
                      elapsed: $elapsed,
                      methargs: $methargs,
                      method: $method,
                      result: $result,
                      runID: $runID,
                      target: $target,
                      time: $time,
                      type: $type
                    }
                  )
                 WITH syscall
                 MATCH (vat:Vat {vatID: $vatID})
                 CREATE (vat)-[
                    :SYSCALL
                 ]->(syscall)`,
                prepareParams({
                  blockHeight: currentBlockHeight,
                  elapsed: time - lastBlockTime,
                  methargs: methodArguments,
                  method,
                  result,
                  runID,
                  target,
                  time,
                  type,
                  vatID,
                }),
              );
            });

            break;
          }
          default:
            break;
        }
      },
  };

  /**
   * @param {Slog} slog
   */
  const slogSender = (slog) => {
    if (!lastBlockTime) lastBlockTime = slog.time;
    return callBacks[slog.type]?.(contextualSlogProcessor(slog));
  };

  return Object.assign(slogSender, {
    forceFlush: () => promiseChain,
    shutdown: () => promiseChain.then(() => driver.close()),
  });
};
