import { auth, driver as createDriver, int as neoInt } from 'neo4j-driver';

/**
 * @typedef { [tag: 'bringOutYourDead']} KernelDeliveryBringOutYourDead
 *
 * @typedef { [tag: 'changeVatOptions', options: Record<string, unknown> ]} KernelDeliveryChangeVatOptions
 *
 * @typedef { [tag: 'dropExports', krefs: string[] ]} KernelDeliveryDropExports
 *
 * @typedef { [tag: 'message', target: string, msg: Message]} KernelDeliveryMessage
 *
 * @typedef { [tag: 'notify', resolutions: KernelDeliveryOneNotify[] ]} KernelDeliveryNotify
 *
 * @typedef { KernelDeliveryMessage
 *  | KernelDeliveryNotify
 *  | KernelDeliveryDropExports
 *  | KernelDeliveryRetireExports
 *  | KernelDeliveryRetireImports
 *  | KernelDeliveryChangeVatOptions
 *  | KernelDeliveryStartVat
 *  | KernelDeliveryStopVat
 *  | KernelDeliveryBringOutYourDead
 * } KernelDeliveryObject
 *
 * @typedef { [kpid: string, rejected: boolean, data: SwingSetCapData]} KernelOneResolution
 *
 * @typedef { [tag: 'abandonExports', vatID: string, krefs: string[] ]} KernelSyscallAbandonExports
 *
 * @typedef { [tag: 'callKernelHook', hookName: string, args: SwingSetCapData]} KernelSyscallCallKernelHook
 *
 * @typedef { [tag: 'dropImports', krefs: string[] ]} KernelSyscallDropImports
 *
 * @typedef { [tag: 'exit', vatID: string, isFailure: boolean, info: SwingSetCapData ]} KernelSyscallExit
 *
 * @typedef { [tag: 'invoke', target: string, method: string, args: SwingSetCapData]} KernelSyscallInvoke
 *
 * @typedef { [tag: 'resolve', vatID: string, resolutions: KernelOneResolution[] ]} KernelSyscallResolve
 *
 * @typedef { [tag: 'retireExports', krefs: string[] ]} KernelSyscallRetireExports
 *
 * @typedef { [tag: 'retireImports', krefs: string[] ]} KernelSyscallRetireImports
 *
 * @typedef { [tag: 'send', target: string, msg: Message] } KernelSyscallSend
 *
 * @typedef { [tag: 'subscribe', vatID: string, kpid: string ]} KernelSyscallSubscribe
 *
 * @typedef { [tag: 'vatstoreDelete', vatID: string, key: string ]} KernelSyscallVatstoreDelete
 *
 * @typedef { [tag: 'vatstoreGet', vatID: string, key: string ]} KernelSyscallVatstoreGet
 *
 * @typedef { [tag: 'vatstoreGetNextKey', vatID: string, priorKey: string ]} KernelSyscallVatstoreGetNextKey
 *
 * @typedef { [tag: 'vatstoreSet', vatID: string, key: string, data: string ]} KernelSyscallVatstoreSet
 *
 * @typedef { KernelSyscallAbandonExports
 *  | KernelSyscallCallKernelHook
 *  | KernelSyscallDropImports
 *  | KernelSyscallExit
 *  | KernelSyscallInvoke
 *  | KernelSyscallResolve
 *  | KernelSyscallRetireExports
 *  | KernelSyscallRetireImports
 *  | KernelSyscallSend
 *  | KernelSyscallSubscribe
 *  | KernelSyscallVatstoreDelete
 *  | KernelSyscallVatstoreGet
 *  | KernelSyscallVatstoreGetNextKey
 *  | KernelSyscallVatstoreSet
 * } KernelSyscallObject
 *
 * @typedef { [kpid: string, kp: { state: string, data: SwingSetCapData }] } KernelDeliveryOneNotify
 *
 * @typedef { [tag: 'retireExports', krefs: string[] ]} KernelDeliveryRetireExports
 *
 * @typedef { [tag: 'retireImports', krefs: string[] ]} KernelDeliveryRetireImports
 *
 * @typedef { [tag: 'startVat', vatParameters: SwingSetCapData ]} KernelDeliveryStartVat
 *
 * @typedef { [tag: 'stopVat', disconnectObject: SwingSetCapData ]} KernelDeliveryStopVat
 *
 * @typedef {object} MakeSlogSenderCommonOptions
 * @property {typeof process.env} env
 * @property {string} [stateDir]
 * @property {string} [serviceName]
 *
 * @typedef {MakeSlogSenderCommonOptions & Record<string, unknown>} MakeSlogSenderOptions
 *
 * @typedef {{ methargs: SwingSetCapData; result: string | undefined | null }} Message
 *
 * @typedef {{
 *  blockHeight?: number;
 *  blockTime?: number;
 *  crankNum?: bigint;
 *  crankType?: string;
 *  deliveryNum?: bigint;
 *  inboundNum?: string;
 *  kd?: KernelDeliveryObject;
 *  ksc?: KernelSyscallObject;
 *  monotime: number;
 *  name?: string;
 *  remainingBeans?: bigint;
 *  replay?: boolean;
 *  runNum?: number;
 *  sender?: string;
 *  source?: string;
 *  endoZipBase64Sha512?: string;
 *  syscall?: VatSyscallObject[0];
 *  syscallNum?: number;
 *  time: number;
 *  type: string;
 *  vatID?: string;
 *  vsc?: VatSyscallObject;
 * }} Slog
 *
 * @typedef {object} SwingSetCapData
 * @property {string} body
 * @property {Array<string>} slots
 *
 * @typedef { [vpid: string, isReject: boolean, data: SwingSetCapData ] } VatOneResolution
 *
 * @typedef { [tag: 'abandonExports', slots: string[] ]} VatSyscallAbandonExports
 *
 * @typedef { [tag: 'callNow', target: string, method: string, args: SwingSetCapData]} VatSyscallCallNow
 *
 * @typedef { [tag: 'dropImports', slots: string[] ]} VatSyscallDropImports
 *
 * @typedef { [tag: 'exit', isFailure: boolean, info: SwingSetCapData ]} VatSyscallExit
 *
 * @typedef { [tag: 'resolve', resolutions: VatOneResolution[] ]} VatSyscallResolve
 *
 * @typedef { [tag: 'retireExports', slots: string[] ]} VatSyscallRetireExports
 *
 * @typedef { [tag: 'retireImports', slots: string[] ]} VatSyscallRetireImports
 *
 * @typedef { [tag: 'send', target: string, msg: Message] } VatSyscallSend
 *
 * @typedef { [tag: 'subscribe', vpid: string ]} VatSyscallSubscribe
 *
 * @typedef { [tag: 'vatstoreDelete', key: string ]} VatSyscallVatstoreDelete
 *
 * @typedef { [tag: 'vatstoreGet', key: string ]} VatSyscallVatstoreGet
 *
 * @typedef { [tag: 'vatstoreGetNextKey', priorKey: string ]} VatSyscallVatstoreGetNextKey
 *
 * @typedef { [tag: 'vatstoreSet', key: string, data: string ]} VatSyscallVatstoreSet
 *
 * @typedef { VatSyscallAbandonExports
 *  | VatSyscallCallNow
 *  | VatSyscallDropImports
 *  | VatSyscallExit
 *  | VatSyscallResolve
 *  | VatSyscallRetireExports
 *  | VatSyscallRetireImports
 *  | VatSyscallSend
 *  | VatSyscallSubscribe
 *  | VatSyscallVatstoreDelete
 *  | VatSyscallVatstoreGet
 *  | VatSyscallVatstoreGetNextKey
 *  | VatSyscallVatstoreSet
 * } VatSyscallObject
 */

const SLOG_TYPES = {
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

/**
 * @param {ReturnType<ReturnType<typeof createDriver>['session']>} session
 */
const setupIndexes = async (session) => {
  const indexes = [
    'CREATE INDEX delivery_id IF NOT EXISTS FOR (d:Delivery) ON (d.crankNum)',
    'CREATE INDEX delivery_time IF NOT EXISTS FOR (d:Delivery) ON (d.timestamp)',
    'CREATE INDEX object_ref IF NOT EXISTS FOR (o:Object) ON (o.kref)',
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

  await setupIndexes(createNewSession());

  /** @type {Slog['blockHeight']} */
  let currentBlockHeight = 0;
  let promiseChain = Promise.resolve();
  const session = createNewSession();
  const trackedPromises =
    /** @type {{ [key: string]: Partial<{ created: Slog['time']; creator: Slog['vatID']; kpid: Message['result']; resolved: Slog['time']; resolver: Slog['vatID']; state: string; }> }} */ ({});

  const callBacks = {
    [SLOG_TYPES.COSMIC_SWINGSET.BEGIN_BLOCK]:
      /**
       * @param {Slog} slog
       */
      ({ blockHeight, blockTime, time }) => {
        currentBlockHeight = blockHeight;
        addPromisesToChain(async () => {
          await session.run(
            'MERGE (b:Block {height: $height}) SET b.time = $time, b.blockTime = $blockTime',
            prepareParams({ blockTime, height: blockHeight, time }),
          );
        });
      },
    [SLOG_TYPES.CREATE_VAT]:
      /**
       * @param {Slog} slog
       */
      ({ name, time, vatID }) =>
        addPromisesToChain(async () => {
          await session.run(
            'MERGE (v:Vat {vatID: $vatID}) SET v.name = $name, v.createdAt = $time',
            prepareParams({ name, time, vatID }),
          );
        }),
    [SLOG_TYPES.DELIVER]:
      /**
       * @param {Slog} slog
       */
      ({ crankNum, kd, time, vatID }) => {
        if (!kd) return;

        const [deliveryType] = kd;

        if (deliveryType === 'message') {
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
              `CREATE (m:Message {method: $method, methargs: $methargs, time: $time, crankNum: $crankNum, target: $target, result: $result, blockHeight: $blockHeight})
               WITH m
               MATCH (v:Vat {vatID: $vatID})
               CREATE (m)-[:CALL{object: $target, method: $method, call: $call }]->(v)`,
              prepareParams({
                blockHeight: currentBlockHeight,
                call: `${target}->${method}()`,
                crankNum: toNeoProp(crankNum),
                methargs: toNeoProp(methodArguments || 'unknown'),
                method,
                result,
                target,
                time,
                vatID,
              }),
            );
          });

          if (result)
            trackedPromises[result] = {
              created: time,
              creator: vatID,
              kpid: result,
              resolver: 'unknown',
              state: 'pending',
            };
        } else if (deliveryType === 'notify') {
          const [, resolutions] = kd;
          for (const [kpid, { state = 'unknown' }] of resolutions) {
            addPromisesToChain(async () => {
              await session.run(
                `CREATE (n:Notify {method: $method, time: $time, kpid: $kpid, blockHeight: $blockHeight})
                 WITH n
                 MATCH (v:Vat {vatID: $vatID})
                 MATCH (m:Message {result: $kpid})
                 CREATE (v)-[:CALLED_BY{object: $kpid}]->(m)
                 CREATE (n)-[:CALL{object: $kpid, method: $method, call: $call }]->(v)`,
                prepareParams({
                  blockHeight: currentBlockHeight || null,
                  call: `${kpid}->${state}()`,
                  kpid,
                  method: state,
                  time,
                  vatID,
                }),
              );
            });

            if (kpid in trackedPromises) {
              const promise = trackedPromises[kpid];
              addPromisesToChain(async () => {
                await session.run(
                  `MATCH (c:Vat {vatID: $creator})
                   MATCH (n:Notify {kpid: $kpid})
                   CREATE (n)-[:CALLED_BY]->(c)`,
                  prepareParams({
                    creator: promise.creator,
                    kpid,
                    resolver: vatID,
                  }),
                );
              });
              delete trackedPromises[kpid];
            }
          }
        }
      },
    [SLOG_TYPES.SYSCALL]:
      /**
       * @param {Slog} slog
       */
      ({ ksc, time, vatID }) => {
        if (!ksc) return;
        const [kernelSyscallType] = ksc;

        if (kernelSyscallType === 'send') {
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
              `CREATE (s:Syscall {method: $method, methargs: $methargs, time: $time, result: $result, target: $target, rejected: $rejected})
               WITH s
               MATCH (v:Vat {vatID: $vatID})
               CREATE (s)-[:SYSCALL_FROM]->(v)`,
              prepareParams({
                method,
                methargs: methodArguments,
                result,
                time,
                vatID,
                target,
                rejected: 'false',
              }),
            );
          });

          if (result) {
            const promise = {
              created: time,
              creator: vatID,
              kpid: result,
              resolver: 'unknown',
              state: 'pending',
            };
            trackedPromises[result] = promise;
            addPromisesToChain(async () => {
              await session.run(
                `MATCH (c:Vat {vatID: $creator})
                 MATCH (n:Notify {kpid: $kpid})
                 CREATE (n)-[:CALLED_BY]->(c)`,
                prepareParams(promise),
              );
            });
          }
        }
      },
  };

  /**
   * @param {Slog} slog
   */
  const slogSender = (slog) => callBacks[slog.type]?.(slog);

  return Object.assign(slogSender, {
    forceFlush: () => promiseChain,
    shutdown: session.close,
  });
};
