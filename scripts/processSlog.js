// This file is a copy of the root file, moved to the tools directory for better organization

// Original content from processSlogSvg.js
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

// Import PlantUML formatter from Agoric SDK
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
export async function processSlogEntries(entries) {
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
  
  let currentBlockHeight = 0;
  let currentBlockTime = 0;
  
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
 * Generate PlantUML sequence diagram from processed slog data
 * @param {Object} data Processed slog data
 * @returns {string} PlantUML content
 */
function generatePlantUML(data) {
  const { vats, deliveries, syscalls, blocks } = data;
  
  // Sort vats by creation time
  const sortedVats = [...vats].sort((a, b) => a.time - b.time);
  
  let plantUml = fmtPlantUml.start('Slog Sequence Diagram');
  
  // Add participants
  for (const vat of sortedVats) {
    const label = JSON.stringify(`${vat.vatID}:${vat.name}`);
    plantUml += fmtPlantUml.participant(label, vat.vatID);
  }
  
  // Sort all events chronologically
  const allEvents = [
    ...deliveries.map(d => ({ ...d, eventType: 'delivery' })),
    ...syscalls.map(s => ({ ...s, eventType: 'syscall' })),
    ...blocks.map(b => ({ ...b, eventType: 'block' }))
  ].sort((a, b) => a.time - b.time);
  
  // Process events
  let currentBlock = null;
  
  for (const event of allEvents) {
    if (event.eventType === 'block') {
      currentBlock = event;
      const blockTime = new Date(event.blockTime * 1000).toISOString().slice(0, -5);
      plantUml += fmtPlantUml.delay(`Block ${event.height} ${blockTime}`);
    } else if (event.eventType === 'delivery' && event.type === 'message') {
      const targetVat = event.vatID;
      plantUml += fmtPlantUml.incoming(targetVat, `${event.method}()`);
    } else if (event.eventType === 'syscall' && event.type === 'send') {
      const sourceVat = event.vatID;
      plantUml += fmtPlantUml.send(sourceVat, 'kernel', `${event.method}()`);
    }
  }
  
  plantUml += fmtPlantUml.end();
  return plantUml;
}

/**
 * Process a slog file and generate diagrams
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
    
    // Generate PlantUML file as well
    const plantUmlFile = outputFile.replace(/\.svg$/, '.puml');
    const plantUml = generatePlantUML(diagramData);
    fs.writeFileSync(plantUmlFile, plantUml);
    
    console.log(`SVG diagram generated successfully: ${outputFile}`);
    console.log(`PlantUML diagram generated: ${plantUmlFile}`);
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