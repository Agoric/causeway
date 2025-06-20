import { readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { auth, driver as createDriver, int as neoInt } from 'neo4j-driver';
import {
  makeContextualSlogProcessor,
  SLOG_TYPES,
} from '@agoric/telemetry/src/context-aware-slog.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONTEXT_FILE = 'slog-context.json';
const FILE_ENCODING = 'utf8';

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
 * @param {any} slogObj
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
    'CREATE INDEX run_block_height IF NOT EXISTS FOR (run:Run) ON (run.blockHeight)',
    'CREATE INDEX run_id IF NOT EXISTS FOR (run:Run) ON (run.id)',
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

  /**
   * @param {Slog} slog
   */
  const slogSender = (slog) => {
    if (!lastBlockTime) lastBlockTime = slog.time;
    const contextualSlog = contextualSlogProcessor(slog);

    const {
      attributes: {
        'block.height': blockHeight,
        'block.time': blockTime,
        'crank.deliveryNum': deliveryNum,
        'run.id': _runId,
        'run.num': runNumber,
        'run.trigger.bundleHash': triggerBundleHash,
        'run.trigger.msgIdx': triggerMsgIdx,
        'run.trigger.sender': triggerSender,
        'run.trigger.source': triggerSource,
        'run.trigger.txHash': triggerTxHash,
        'run.trigger.type': runTriggerType,
      },
      body: {
        crankNum,
        kd,
        ksc,
        name,
        phase,
        type,
        usedBeans,
        vatID,
      },
      time,
    } = contextualSlog;

    const runId = _runId || 'N/A';

    switch (slog.type) {
      case SLOG_TYPES.COSMIC_SWINGSET.BEGIN_BLOCK: {
        currentBlockHeight = blockHeight;
        addPromisesToChain(async () => {
          await session.run(
            `MERGE (
                block:Block {
                  height: $height
                }
              )
             SET
              block.time = $time,
              block.blockTime = $blockTime
            `,
            prepareParams({ blockTime, height: blockHeight, time }),
          );
        });

        break;
      }
      case SLOG_TYPES.COSMIC_SWINGSET.RUN.FINISH:
      case SLOG_TYPES.COSMIC_SWINGSET_TRIGGERS.BRIDGE_INBOUND:
      case SLOG_TYPES.COSMIC_SWINGSET_TRIGGERS.DELIVER_INBOUND:
      case SLOG_TYPES.COSMIC_SWINGSET_TRIGGERS.INSTALL_BUNDLE:
      case SLOG_TYPES.COSMIC_SWINGSET_TRIGGERS.TIMER_POLL: {
        const unknowDataIdentifier = 'unknown';

        let currentRunId = _runId;
        let triggerType = runTriggerType;

        if (
          !currentRunId ||
          currentRunId.startsWith(`${unknowDataIdentifier}-`)
        )
          currentRunId = `${phase}-${blockHeight}-${runNumber}`;
        if (!triggerType || triggerType === unknowDataIdentifier)
          triggerType = phase;

        addPromisesToChain(async () => {
          await session.run(
            `CREATE (
                run:Run {
                  blockHeight:        $blockHeight,
                  blockTime:          $blockTime,
                  computrons:         $computrons,
                  id:                 $id,
                  number:             $number,
                  time:               $time,
                  triggerBundleHash:  $triggerBundleHash,
                  triggerMsgIdx:      $triggerMsgIdx,
                  triggerSender:      $triggerSender,
                  triggerSource:      $triggerSource,
                  triggerTxHash:      $triggerTxHash,
                  triggerType:        $triggerType
                }
              )
            `,
            prepareParams({
              blockHeight,
              blockTime,
              computrons: usedBeans || 0,
              id: currentRunId,
              number: runNumber || 'N/A',
              time,
              triggerBundleHash: triggerBundleHash || 'N/A',
              triggerMsgIdx: triggerMsgIdx || 0,
              triggerSender: triggerSender || 'N/A',
              triggerSource: triggerSource || 'N/A',
              triggerTxHash: triggerTxHash || 'N/A',
              triggerType,
            }),
          );
        });

        break;
      }
      case SLOG_TYPES.CREATE_VAT: {
        addPromisesToChain(async () => {
          await session.run(
            `MERGE (
                vat:Vat {
                  vatID: $vatID
                }
              )
             SET
              vat.name = $name,
              vat.createdAt = $time
            `,
            prepareParams({ name: name || vatID, time, vatID }),
          );
        });

        break;
      }
      case SLOG_TYPES.DELIVER: {
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
                      runID: $runId,
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
                  runId,
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
                        runID: $runId,
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
                    runId,
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

        break;
      }
      case SLOG_TYPES.SYSCALL: {
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
                        runID: $runId,
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
                    runId,
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
                      runID: $runId,
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
                  runId,
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

        break;
      }
      default:
        break;
    }
  };

  return Object.assign(slogSender, {
    forceFlush: () => promiseChain,
    shutdown: () => promiseChain.then(() => driver.close()),
  });
};
