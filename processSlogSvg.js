// Source: https://github.com/Agoric/agoric-sdk/blob/2ee9664ffacae4d958eed998bad1030e961134b8/packages/SwingSet/misc-tools/slog-to-diagram.mjs
import { fs } from 'zx';
import { pipeline } from 'stream';
import { promisify } from 'util';

// [PlantUML \- Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=jebbs.plantuml)

/**
 * TODO: refactor as readLines, map JSON.parse
 *
 * @param {AsyncIterable<Buffer>} data
 * @yields { unknown }
 */
async function* readJSONLines(data) {
  let buf = '';
  for await (const chunk of data) {
    buf += chunk;
    for (let pos = buf.indexOf('\n'); pos >= 0; pos = buf.indexOf('\n')) {
      const line = buf.slice(0, pos);
      yield JSON.parse(line);
      buf = buf.slice(pos + 1);
    }
  }
}

/**
 * @param {AsyncIterable<SlogEntry>} entries
 *
 * @typedef {{time: number}} TimedEvent
 * @typedef {{blockTime: number} | DInfo} Arrival
 * @typedef {DeliveryInfo | NotifyInfo} DInfo
 * @typedef {{
 *   type: 'deliver',
 *   elapsed: number,
 *   crankNum: number,
 *   deliveryNum: number,
 *   vatID: string,
 *   target: unknown,
 *   method: string,
 *   argSize: number,
 *   compute?: number,
 * }} DeliveryInfo
 * @typedef {{
 *   type: 'deliver',
 *   elapsed: number,
 *   vatID: string,
 *   target: unknown,
 *   state: unknown,
 *   compute?: number,
 * }} NotifyInfo
 * @typedef {{
 *   type: 'syscall',
 *   vatID: string,
 *   target?: string,
 *   method?: string,
 * } | {
 *   type: 'resolve',
 *   vatID: string,
 * }} Departure
 *
 * @typedef {['deliver-result', {
 *   time: number, type: 'deliver-result', vatID: string
 * }]} DeliverResult
 */
async function slogSummary(entries) {
  /** @type { Map<string, SlogCreateVatEntry> } */
  const vatInfo = new Map();
  /** @type { Map<number | string | {}, TimedEvent & Arrival>} */
  const arrival = new Map();
  /** @type { Map<string | {}, TimedEvent & Departure>} */
  const departure = new Map();
  // track end-of-delivery for deactivating actors
  /** @type {DeliverResult[]} */
  const deliverResults = [];

  /** @type {number|undefined} */
  let tBlock;
  /** @type {number} */
  let blockHeight;
  /** @type { TimedEvent & DInfo | undefined } */
  let dInfo;

  const seen = {
    type: new Set(),
    deliver: new Set(),
    syscall: new Set(),
  };

  for await (const entry of entries) {
    // handle off-chain use, such as in unit tests
    if (!tBlock) {
      tBlock = entry.time;
    }
    switch (entry.type) {
      case 'create-vat':
        vatInfo.set(entry.vatID, entry);
        break;
      case 'cosmic-swingset-end-block-start':
        tBlock = entry.time;
        blockHeight = entry.blockHeight;
        arrival.set(blockHeight, {
          time: entry.time,
          blockTime: entry.blockTime,
        });
        break;
      case 'deliver': {
        const { kd } = entry;
        if (!vatInfo.has(entry.vatID))
          vatInfo.set(entry.vatID, {
            type: 'create-vat',
            time: entry.time,
            vatID: entry.vatID,
          });
        switch (kd?.[0]) {
          case 'startVat': {
            const [_tag, _vatParams] = kd;
            dInfo = {
              type: entry.type,
              time: entry.time,
              elapsed: entry.time - tBlock,
              crankNum: entry.crankNum,
              deliveryNum: entry.deliveryNum,
              vatID: entry.vatID,
              method: '!startVat',
            };
            arrival.set({}, dInfo);
            break;
          }
          case 'message': {
            const [
              _tag,
              target,
              {
                methargs: { body },
                result,
              },
            ] = kd;
            const jsonString = body.startsWith('#') ? body.slice(1) : body;
            const [method] = JSON.parse(jsonString);
            dInfo = {
              type: entry.type,
              time: entry.time,
              elapsed: entry.time - tBlock,
              crankNum: entry.crankNum,
              deliveryNum: entry.deliveryNum,
              vatID: entry.vatID,
              target,
              method,
              argSize: body.length,
            };
            arrival.set(result || {}, dInfo);
            break;
          }
          case 'notify': {
            const [_tag, resolutions] = kd;
            for (const [kp, { state }] of resolutions) {
              dInfo = {
                type: entry.type,
                time: entry.time,
                elapsed: entry.time - tBlock,
                vatID: entry.vatID,
                state,
                target: kp,
              };
              arrival.set(`R${kp}`, dInfo);
            }
            break;
          }
          default:
            if (!seen.deliver.has(kd?.[0])) {
              console.warn('delivery tag unknown:', kd?.[0]);
              seen.deliver.add(kd?.[0]);
            }
            break;
        }
        break;
      }
      case 'deliver-result': {
        // track end-of-delivery for deactivating actors
        deliverResults.push([
          entry.type,
          { time: entry.time, type: entry.type, vatID: entry.vatID },
        ]);
        // supplement deliver entry with compute meter
        const { dr } = entry;
        if (dr[2] && 'compute' in dr[2]) {
          if (!dInfo) {
            console.warn('no dInfo???', dr[2]);
            break;
          }
          const { compute } = dr[2];
          dInfo.compute = compute;
        }
        break;
      }
      case 'syscall': {
        switch (entry.ksc?.[0]) {
          case 'send': {
            const {
              ksc: [_, target, { method, result }],
            } = entry;
            departure.set(result, {
              type: entry.type,
              time: entry.time,
              vatID: entry.vatID,
              target,
              method,
            });
            break;
          }
          case 'resolve': {
            const {
              ksc: [_, _thatVat, parts],
            } = entry;
            for (const [kp, _rejected, _args] of parts) {
              departure.set(`R${kp}`, {
                type: entry.type,
                time: entry.time,
                vatID: entry.vatID,
              });
            }
            break;
          }
          default:
            if (!seen.syscall.has(entry.ksc?.[0])) {
              console.warn('syscall tag unknown:', entry.ksc?.[0]);
              seen.syscall.add(entry.ksc?.[0]);
            }
            // skip
            break;
        }
        break;
      }
      default:
        if (!seen.type.has(entry.type)) {
          console.warn('type unknown:', entry.type);
          seen.type.add(entry.type);
        }
        break;
    }
  }

  return { vatInfo, arrival, departure, deliverResults };
}

const { freeze } = Object;

/**
 * ref: https://plantuml.com/sequence-diagram
 */
const fmtPlantUml = freeze({
  /** @param {string} name */
  start: (name) => `@startuml ${name}\n`,
  /** @type {() => string} */
  end: () => '@enduml\n',
  /** @type {(l: string, v: string) => string} */
  participant: (label, vatID) => `control ${label} as ${vatID}\n`,
  /** @type {(s: string, t: string) => string} */
  note: (side, text) => `note ${side}\n${text}\nend note\n`,
  /** @param {string} text */
  delay: (text) => `... ${text} ...\n`,
  /** @param {number} x */
  autonumber: (x) => `autonumber ${x}\n`,
  /** @type {(d: string, msg: string, m?: boolean) => string} */
  incoming: (dest, msg, missing) =>
    `[${missing ? 'o' : ''}-> ${dest} : ${msg}\n`,
  /** @type {(s: string, d: string, msg: string) => string} */
  send: (src, dest, label) => `${src} -> ${dest} : ${label}\n`,
  /** @type {(s: string, d: string, msg: string) => string} */
  response: (src, dest, label) => `${src} --> ${dest} : ${label}\n`,
});

/* eslint-disable no-unused-vars */
/**
 * ref: https://mermaid-js.github.io/mermaid/
 */
const fmtMermaid = freeze({
  /** @param {string} _name */
  start: (_name) =>
    `\`\`\`mermaid\nsequenceDiagram\n  autonumber\n  participant Incoming\n`,
  end: () => '```\n',
  /** @type {(l: string, v: string) => string} */
  participant: (label, vatID) => `  participant ${vatID} as ${label}\n`,
  /** @type {(s: string, t: string) => string} */
  note: (side, text) => `  note ${side} of XXXActor ${text}\n`,
  /** @param {string} text */
  delay: (text) => `  %% TODO: delay ... ${text} ...\n`,
  /** @param {number} _x */
  autonumber: (_x) => '',
  /** @type {(d: string, msg: string, m?: boolean) => string} */
  incoming: (dest, msg, _missing) => `  Incoming ->> ${dest} : ${msg}\n`,
  /** @type {(s: string, d: string, msg: string) => string} */
  send: (src, dest, label) => `  ${src} -) ${dest} : ${label}\n`,
  /** @type {(s: string, d: string, msg: string) => string} */
  response: (src, dest, label) => `  ${src} -->> ${dest} : ${label}\n`,
});
/* eslint-enable no-unused-vars */

/**
 * @param {typeof fmtPlantUml} fmt
 * @param {Awaited<ReturnType<typeof slogSummary>>} param0
 * @yields {string}
 */
async function* diagramLines(
  fmt,
  { vatInfo, arrival, departure, deliverResults }
) {
  yield fmt.start('slog');

  for (const [vatID, info] of vatInfo) {
    const { name = '???' } = info || {};
    const label = JSON.stringify(`${vatID}:${name}`); // stringify to add ""s
    yield fmt.participant(label, vatID);
  }

  const byTime = [...arrival, ...deliverResults].sort(
    (a, b) => a[1].time - b[1].time
  );

  let active;
  let blockHeight;

  for (const [
    ref,
    {
      type,
      elapsed,
      vatID: dest,
      crankNum,
      target,
      method,
      state,
      argSize,
      _compute,
      blockTime,
    },
  ] of byTime) {
    if (type === 'deliver-result') {
      // failed experiment
      continue;
    }
    if (typeof ref === 'number') {
      blockHeight = ref;
      const dt = new Date(blockTime * 1000).toISOString().slice(0, -5);
      yield fmt.delay(`block ${blockHeight} ${dt}`);
      continue;
    }
    const t = Math.round(elapsed * 1000) / 1000;

    // add note to compute-intensive deliveries
    // const computeNote =
    //   compute && compute > 50000
    //     ? fmt.note(`right`, `${compute.toLocaleString()} compute`)
    //     : undefined;

    const computeNote = crankNum
      ? fmt.note('right', `${crankNum}@${dest}`)
      : undefined;

    // yield `autonumber ${blockHeight}.${t}\n`;
    if (t > 0) {
      yield fmt.autonumber(t);
    } else {
      console.warn('??? t < 0', elapsed);
    }
    const call = `${target}.${method || state}(${argSize || ''})`;
    if (typeof ref === 'object') {
      yield fmt.incoming(dest, `${call}`);
      if (computeNote) yield computeNote;
      continue;
    }
    if (!departure.has(ref)) {
      console.warn('no source for', { ref });
      yield fmt.incoming(dest, `${ref} <- ${call}`, true);
      if (computeNote) yield computeNote;
      continue;
    }
    const { vatID: src } = departure.get(ref);
    const label = method
      ? `${ref} <- ${target}.${method}(${argSize || ''})`
      : `${target}.${state}()`;

    yield method ? fmt.send(src, dest, label) : fmt.response(src, dest, label);

    // show active vat
    if (type === 'deliver' && active !== dest) {
      // yield `activate ${dest}\n`;
      active = dest;
    }

    if (computeNote) yield computeNote;
  }

  yield fmt.end();
}

/**
 * @param {AsyncIterable<SlogEntry>} entries
 * @yields {string}
 */
async function* slogToDiagram(entries) {
  const summary = await slogSummary(entries);
  for await (const line of diagramLines(fmtPlantUml, summary)) {
    yield line;
  }
}

const pipelineAsync = promisify(pipeline);

export const processSlogs = async ({ inputFile, outputFile }) => {
  const inputStream = fs.createReadStream(inputFile, { encoding: 'utf-8' });
  const outputStream = fs.createWriteStream(outputFile, {
    encoding: 'utf-8',
  });

  await pipelineAsync(inputStream, readJSONLines, slogToDiagram, outputStream);
};
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';
import zlib from 'zlib';
import readline from 'readline';
import { fileURLToPath } from 'url';

const pipelineAsync = promisify(pipeline);

/**
 * Read JSON lines from a stream
 * @param {AsyncIterable<Buffer>} data
 * @yields {Object} Parsed JSON objects
 */
async function* readJSONLines(data) {
  let buf = '';
  for await (const chunk of data) {
    buf += chunk;
    for (let pos = buf.indexOf('\n'); pos >= 0; pos = buf.indexOf('\n')) {
      const line = buf.slice(0, pos);
      yield JSON.parse(line);
      buf = buf.slice(pos + 1);
    }
  }
}

/**
 * Process slog entries to generate SVG diagram data
 * @param {AsyncIterable<Object>} entries
 * @returns {Promise<Object>} Diagram data
 */
async function processSlogEntries(entries) {
  // Track vat information
  const vatInfo = new Map();
  // Track message deliveries
  const deliveries = [];
  // Track syscalls
  const syscalls = [];
  // Track blocks
  const blocks = [];
  // Track promises
  const promises = new Map();
  
  let currentBlockHeight;
  let currentBlockTime;
  
  for await (const entry of entries) {
    switch (entry.type) {
      case 'create-vat':
        vatInfo.set(entry.vatID, {
          vatID: entry.vatID,
          name: entry.name || entry.vatID,
          time: entry.time
        });
        break;
        
      case 'cosmic-swingset-begin-block':
        currentBlockHeight = entry.blockHeight;
        currentBlockTime = entry.blockTime;
        blocks.push({
          height: currentBlockHeight,
          time: entry.time,
          blockTime: currentBlockTime
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
            blockHeight: currentBlockHeight
          });
          
          // Track promise if it exists
          if (result) {
            promises.set(result, {
              kpid: result,
              state: 'pending',
              created: entry.time,
              creator: entry.vatID
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
              blockHeight: currentBlockHeight
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
            blockHeight: currentBlockHeight
          });
          
          // Track promise if it exists
          if (result) {
            promises.set(result, {
              kpid: result,
              state: 'pending',
              created: entry.time,
              creator: entry.vatID
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
              blockHeight: currentBlockHeight
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
    promises: Array.from(promises.values())
  };
}

/**
 * Helper function to extract method name and slots from smallcaps
 */
function extractSmallcaps(methargs_smallcaps) {
  const { body, slots } = methargs_smallcaps;
  if (body[0] !== '#') {
    throw Error('ersatz decoder only handles smallcaps');
  }
  const methargs = JSON.parse(body.slice(1));
  const methname = methargs[0];
  return { methname, slots: slots || [] };
}

/**
 * Generate SVG sequence diagram from processed slog data
 * @param {Object} data Processed slog data
 * @returns {string} SVG content
 */
function generateSVG(data) {
  const { vats, deliveries, syscalls, blocks } = data;
  
  // Sort vats by creation time
  const sortedVats = [...vats].sort((a, b) => a.time - b.time);
  
  // Calculate diagram dimensions
  const padding = 20;
  const headerHeight = 50;
  const vatWidth = 120;
  const vatSpacing = 150;
  const messageHeight = 30;
  const blockHeight = 40;
  
  // Calculate total width based on number of vats
  const width = padding * 2 + sortedVats.length * vatSpacing;
  
  // Sort all events chronologically
  const allEvents = [
    ...deliveries.map(d => ({ ...d, eventType: 'delivery' })),
    ...syscalls.map(s => ({ ...s, eventType: 'syscall' })),
    ...blocks.map(b => ({ ...b, eventType: 'block' }))
  ].sort((a, b) => a.time - b.time);
  
  // Calculate total height based on number of events
  const height = headerHeight + allEvents.length * messageHeight + padding * 2;
  
  // Start building SVG
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    .vat-box { fill: #e6f7ff; stroke: #1890ff; stroke-width: 2; }
    .vat-label { font-family: Arial; font-size: 14px; text-anchor: middle; }
    .lifeline { stroke: #d9d9d9; stroke-width: 1; stroke-dasharray: 5,5; }
    .message { stroke: #1890ff; stroke-width: 1.5; }
    .message-text { font-family: Arial; font-size: 12px; fill: #333; }
    .syscall { stroke: #722ed1; stroke-width: 1.5; }
    .block-line { stroke: #f5222d; stroke-width: 1; }
    .block-text { font-family: Arial; font-size: 10px; fill: #f5222d; }
    .arrowhead { fill: #1890ff; }
    .syscall-arrowhead { fill: #722ed1; }
  </style>
  
  <!-- Vat boxes and lifelines -->
`;
  
  // Add vat boxes and lifelines
  sortedVats.forEach((vat, index) => {
    const x = padding + index * vatSpacing;
    const centerX = x + vatWidth / 2;
    
    // Vat box
    svg += `  <rect class="vat-box" x="${x}" y="${padding}" width="${vatWidth}" height="${headerHeight - padding}" rx="5" ry="5" />
  <text class="vat-label" x="${centerX}" y="${padding + 25}">${vat.name}</text>
  
  <!-- Lifeline for ${vat.name} -->
  <line class="lifeline" x1="${centerX}" y1="${headerHeight}" x2="${centerX}" y2="${height - padding}" />
`;
  });
  
  // Add events (messages, syscalls, blocks)
  let currentY = headerHeight + messageHeight;
  
  allEvents.forEach(event => {
    if (event.eventType === 'block') {
      // Draw block line
      svg += `  <!-- Block ${event.height} -->
  <line class="block-line" x1="${padding}" y1="${currentY}" x2="${width - padding}" y2="${currentY}" />
  <text class="block-text" x="${padding + 5}" y="${currentY - 5}">Block ${event.height}</text>
`;
    } else if (event.eventType === 'delivery' && event.type === 'message') {
      // Find source and target vat indices
      const targetVatIndex = sortedVats.findIndex(v => v.vatID === event.vatID);
      
      if (targetVatIndex !== -1) {
        const targetX = padding + targetVatIndex * vatSpacing + vatWidth / 2;
        const sourceX = padding + 30; // Default to left edge for incoming messages
        
        // Draw message arrow
        svg += `  <!-- Delivery to ${event.vatID}: ${event.method} -->
  <line class="message" x1="${sourceX}" y1="${currentY}" x2="${targetX}" y2="${currentY}" marker-end="url(#arrowhead)" />
  <text class="message-text" x="${(sourceX + targetX) / 2}" y="${currentY - 5}">${event.method}</text>
`;
      }
    } else if (event.eventType === 'syscall' && event.type === 'send') {
      // Find source vat index
      const sourceVatIndex = sortedVats.findIndex(v => v.vatID === event.vatID);
      
      if (sourceVatIndex !== -1) {
        const sourceX = padding + sourceVatIndex * vatSpacing + vatWidth / 2;
        const targetX = width - padding - 30; // Default to right edge for outgoing syscalls
        
        // Draw syscall arrow
        svg += `  <!-- Syscall from ${event.vatID}: ${event.method} -->
  <line class="syscall" x1="${sourceX}" y1="${currentY}" x2="${targetX}" y2="${currentY}" marker-end="url(#syscall-arrowhead)" />
  <text class="message-text" x="${(sourceX + targetX) / 2}" y="${currentY - 5}">${event.method}</text>
`;
      }
    }
    
    currentY += messageHeight;
  });
  
  // Add arrow definitions
  svg += `  <!-- Arrow definitions -->
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon class="arrowhead" points="0 0, 10 3.5, 0 7" />
    </marker>
    <marker id="syscall-arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon class="syscall-arrowhead" points="0 0, 10 3.5, 0 7" />
    </marker>
  </defs>
</svg>`;
  
  return svg;
}

/**
 * Process a slog file and generate an SVG diagram
 * @param {string} inputFile Path to input slog file
 * @param {string} outputFile Path to output SVG file
 */
export async function processSlogToSvg({ inputFile, outputFile }) {
  console.log(`Processing ${inputFile} to generate SVG diagram`);
  
  // Create read stream for input file
  let inputStream = fs.createReadStream(inputFile, { encoding: 'utf-8' });
  
  // Handle gzipped files
  if (inputFile.endsWith('.gz')) {
    inputStream = inputStream.pipe(zlib.createGunzip());
  }
  
  try {
    // Process the slog entries
    const entries = readJSONLines(inputStream);
    const diagramData = await processSlogEntries(entries);
    
    // Generate SVG
    const svg = generateSVG(diagramData);
    
    // Write SVG to output file
    fs.writeFileSync(outputFile, svg);
    
    console.log(`SVG diagram generated successfully: ${outputFile}`);
    console.log(`Processed ${diagramData.vats.length} vats, ${diagramData.deliveries.length} deliveries, ${diagramData.syscalls.length} syscalls`);
    
    return {
      vats: diagramData.vats.length,
      deliveries: diagramData.deliveries.length,
      syscalls: diagramData.syscalls.length,
      blocks: diagramData.blocks.length
    };
  } catch (error) {
    console.error('Error processing slog file:', error);
    throw error;
  }
}

/**
 * Main execution function
 */
export async function run() {
  const [_node, _script, inputFile, outputFile] = process.argv;
  
  if (!inputFile) {
    console.log('Usage: node processSlogSvg.js <inputFile> [outputFile]');
    process.exit(64);
  }
  
  // Default output file name if not provided
  const defaultOutputFile = path.basename(inputFile, path.extname(inputFile)) + '.svg';
  const finalOutputFile = outputFile || defaultOutputFile;
  
  try {
    await processSlogToSvg({ 
      inputFile, 
      outputFile: finalOutputFile 
    });
  } catch (error) {
    console.error('Fatal error during processing:', error);
    process.exit(1);
  }
}

// Run the program if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch(error => {
    console.error('Error in main execution:', error);
    process.exit(1);
  });
}
