import { Session, Driver } from 'neo4j-driver';
import driver from '../lib/neo4j';
import mermaid from 'mermaid';
import { Interaction, SlogData, PromiseState } from './types/common';
import { Vat } from './types/create-vat';

export const createNeo4jDriver = async (): Promise<Driver> => {
  try {
    await driver.verifyConnectivity();
    return driver;
  } catch (error) {
    let errorMessage = error.message;

    if (error.code === 'ServiceUnavailable') {
      errorMessage =
        'Neo4j database is not available at the provided URI. Please check that the database is running and accessible.';
    } else if (error.code === 'Neo.ClientError.Security.Unauthorized') {
      errorMessage =
        'Invalid username or password. Please check your credentials.';
    } else if (error.message.includes('WebSocket connection failure')) {
      errorMessage =
        'WebSocket connection failed. This may be due to CORS restrictions or network issues. For local Neo4j, make sure to use bolt://localhost:7687 and not http://localhost:7474.';
    }

    throw new Error(errorMessage);
  }
};

// Convert string timestamp (1729570627.218393) to numeric timestamp
export const parseTimestamp = (timestampStr: string) => {
  if (!timestampStr) return null;
  const num = parseFloat(timestampStr);
  return isNaN(num) ? null : num;
};

export const formatUnixTimestamp = (timestamp: number) => {
  if (!timestamp) return 'N/A';
  try {
    // Convert to ms if needed and format
    const date = new Date(timestamp * (timestamp > 10000000000 ? 1 : 1000));
    return date.toISOString().replace('T', ' ').substring(0, 19);
  } catch (err) {
    console.error(err);
    return 'Invalid timestamp';
  }
};

export const generateNeo4jGraph = async (data: SlogData, session: Session) => {
  const { vats, deliveries, syscalls, blocks } = data;
  const promises = data.promises || [];

  // Create Vat nodes
  for (const vat of vats) {
    try {
      await session.run(
        `MERGE (v:Vat {vatID: $vatID})
         SET v.name = $name, v.createdAt = $time`,
        { vatID: vat.vatID, name: vat.name, time: vat.time },
      );
    } catch (error) {
      console.error('Error creating Vat node:', error);
    }
  }

  // Create Block nodes
  for (const block of blocks) {
    try {
      await session.run(
        `MERGE (b:Block {height: $height})
         SET b.time = $time, b.blockTime = $blockTime`,
        { height: block.height, time: block.time, blockTime: block.blockTime },
      );
    } catch (error) {
      console.error('Error creating Block node:', error);
    }
  }

  // Create Message deliveries as nodes and relationships
  for (const msg of deliveries) {
    try {
      if (msg.type === 'notify') {
        await session.run(
          `CREATE (n:Notify {method: $method, time: $time, kpid: $kpid, blockHeight: $blockHeight})
           WITH n
           MATCH (v:Vat {vatID: $vatID})
           OPTIONAL MATCH (m:Message {result: $kpid})
           WITH n, v, m
           WHERE m IS NOT NULL
           CREATE (v)-[:CALLED_BY{object: $kpid}]->(m)
           CREATE (n)-[:CALL{object: $kpid, method: $method, call: $call }]->(v)`,
          {
            method: msg.state || 'unknown',
            time: msg.time,
            vatID: msg.vatID,
            kpid: msg.kpid || null,
            call: `${msg.kpid}->${msg.state}()`,
            blockHeight: msg.blockHeight || null,
          },
        );
      } else if (msg.type === 'message') {
        await session.run(
          `CREATE (m:Message {method: $method, time: $time, crankNum: $crankNum, target: $target, result: $result, blockHeight: $blockHeight})
           WITH m
           MATCH (v:Vat {vatID: $vatID})
           CREATE (m)-[:CALL{object: $target, method: $method, call: $call }]->(v)`,
          {
            method: msg.method || 'unknown',
            time: msg.time,
            crankNum: msg.crankNum || null,
            vatID: msg.vatID,
            target: msg.target || null,
            result: msg.result || null,
            call: `${msg.target || 'unknown'}->${msg.method || 'unknown'}()`,
            blockHeight: msg.blockHeight || null,
          },
        );
      }
    } catch (error) {
      console.error('Error creating delivery node:', error);
    }
  }

  // Create Syscalls and relationships
  for (const syscall of syscalls) {
    try {
      if (syscall.type === 'send') {
        await session.run(
          `CREATE (s:Syscall {method: $method, time: $time, result: $result, target: $target, rejected: $rejected})
           WITH s
           MATCH (v:Vat {vatID: $vatID})
           CREATE (s)-[:SYSCALL_FROM]->(v)`,
          {
            method: syscall.method || 'unknown',
            result: syscall.result || null,
            time: syscall.time,
            vatID: syscall.vatID,
            target: syscall.target || 'unknown',
            rejected: syscall.rejected || 'false',
          },
        );
      }
    } catch (error) {
      console.error('Error creating syscall node:', error);
    }
  }

  for (const promise of promises) {
    try {
      await session.run(
        `MATCH (c:Vat {vatID: $creator})
         MATCH (n:Notify {kpid: $kpid})
         CREATE (n)-[:CALLED_BY]->(c)`,
        {
          kpid: promise.kpid || 'unknown',
          creator: promise.creator || 'unknown',
          resolver: promise.resolver || 'unknown',
        },
      );
    } catch (error) {
      console.error('Error creating promise relationship:', error);
    }
  }
};

export const processLogFile = async (
  file: File,
  setProgress: React.Dispatch<React.SetStateAction<string>>,
) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        if (!event.target || !event.target.result) {
          reject(
            new Error('Failed to read file: event.target or result is null'),
          );
          return;
        }
        const lines = (event.target.result as string).split('\n');
        const totalLines = lines.length;

        setProgress(`Processing ${totalLines} log entries...`);

        const data: SlogData = {
          vats: [],
          deliveries: [],
          syscalls: [],
          blocks: [],
          promises: [],
        };

        let processedLines = 0;
        let minTime = Number.MAX_VALUE;
        let maxTime = 0;

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const entry = JSON.parse(line);
            const { type, vatID, time } = entry;

            // Track min/max times for reporting
            if (time && !isNaN(parseFloat(time))) {
              const timeValue = parseFloat(time);
              minTime = Math.min(minTime, timeValue);
              maxTime = Math.max(maxTime, timeValue);
            }

            switch (type) {
              case 'create-vat':
                data.vats.push({
                  vatID,
                  name: entry.name || 'unknown',
                  time,
                });
                break;

              case 'cosmic-swingset-end-block-start':
                data.blocks.push({
                  height: entry.blockHeight,
                  time,
                  blockTime: entry.blockTime,
                });
                break;

              case 'deliver':
                const { kd } = entry;
                if (kd && kd[0] === 'message') {
                  let method = 'unknown';
                  try {
                    const [
                      ,
                      targetRef,
                      {
                        methargs: { body },
                        result,
                      },
                    ] = kd; // Skip first item (tag)
                    const jsonString = body.startsWith('#')
                      ? body.slice(1)
                      : body;
                    [method] = JSON.parse(jsonString);

                    data.deliveries.push({
                      type: 'message',
                      method,
                      vatID,
                      time,
                      target: targetRef,
                      result,
                      crankNum: entry.crankNum,
                      blockHeight: entry.blockHeight,
                    });
                  } catch (parseError) {
                    // Log error and continue with default values
                    console.warn('Error parsing deliver message:', parseError);
                    data.deliveries.push({
                      type: 'message',
                      method: 'unknown',
                      vatID,
                      time,
                      target: 'unknown',
                      result: null,
                      crankNum: entry.crankNum,
                      blockHeight: entry.blockHeight,
                    });
                  }
                } else if (kd && kd[0] === 'notify') {
                  // Ensure state is a valid string for Mermaid diagrams
                  let state = 'notification';
                  if (kd[2]) {
                    // Convert to string and sanitize
                    state = String(kd[2]).replace(/[^\w\s\-.,;:()]/g, '_');
                  }

                  data.deliveries.push({
                    type: 'notify',
                    state: state as PromiseState,
                    vatID,
                    time,
                    kpid: kd[1],
                    blockHeight: entry.blockHeight,
                  });
                }
                break;

              case 'syscall':
                const { ksc } = entry;
                if (ksc && ksc[0] === 'send') {
                  try {
                    const [, target, { method, result }] = ksc;

                    data.syscalls.push({
                      type: 'send',
                      method,
                      vatID,
                      time,
                      target,
                      result,
                    });
                  } catch (parseError) {
                    console.warn('Error parsing syscall send:', parseError);
                  }
                }
                break;

              default:
                // Skip other types
                break;
            }
          } catch (e) {
            console.warn('Error parsing JSON line:', e);
          }

          processedLines++;
          if (processedLines % 1000 === 0) {
            setProgress(
              `Processed ${processedLines}/${totalLines} log entries...`,
            );
          }
        }

        const formattedMinTime = formatUnixTimestamp(minTime);
        const formattedMaxTime = formatUnixTimestamp(maxTime);

        setProgress(`Log processing complete. 
          Found ${data.vats.length} vats, ${
            data.deliveries.length
          } deliveries, ${data.syscalls.length} syscalls, ${
            data.blocks.length
          } blocks
          Time range: ${formattedMinTime} to ${formattedMaxTime}
          Timestamp range: ${
            minTime !== Number.MAX_VALUE ? minTime : 'N/A'
          } to ${maxTime !== 0 ? maxTime : 'N/A'}`);

        resolve(data);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (error) => {
      reject(error);
    };

    reader.readAsText(file);
  });
};

const findLabelForRect = (
  rect: SVGRectElement,
  labels: NodeListOf<Element>,
) => {
  const rectX = parseFloat(rect.getAttribute('x') || '0');
  const rectY = parseFloat(rect.getAttribute('y') || '0');
  const rectWidth = parseFloat(rect.getAttribute('width') || '0');

  for (const label of labels) {
    const labelX = parseFloat(label.getAttribute('x') || '0');
    const labelY = parseFloat(label.getAttribute('y') || '0');

    if (
      Math.abs(labelX - (rectX + rectWidth / 2)) < rectWidth / 2 + 5 &&
      Math.abs(labelY - (rectY + 15)) < 20
    ) {
      return label;
    }
  }

  return null;
};

const addParticipantTooltips = (svg: SVGSVGElement) => {
  const actorRects = svg.querySelectorAll('rect.actor, .labelBox');
  const actorLabels = svg.querySelectorAll('.actor, .labelText');

  actorRects.forEach((rect: SVGRectElement) => {
    const textLabel = findLabelForRect(rect, actorLabels);
    if (textLabel && textLabel.textContent) {
      const displayedName = textLabel.textContent.trim();
      let tooltipText;

      if (displayedName.includes('System')) {
        tooltipText = 'System: The Neo4j system participant';
      } else {
        let vatName = displayedName;
        if (displayedName.endsWith('...')) {
          vatName = displayedName.replace('...', '');
        }
        tooltipText = `Vat: ${vatName}\nClick to focus on this vat's interactions`;
      }

      const title = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'title',
      );
      title.textContent = tooltipText;
      rect.appendChild(title);

      rect.classList.add('participant-hover');
    }
  });

  actorLabels.forEach((label) => {
    if (label && label.textContent) {
      const displayedName = label.textContent.trim();
      let tooltipText;

      if (displayedName.includes('System')) {
        tooltipText = 'System: The Neo4j system participant';
      } else {
        let vatName = displayedName;

        if (displayedName.endsWith('...')) {
          vatName = displayedName.replace('...', '');
        }
        tooltipText = `Vat: ${vatName}`;
      }

      const title = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'title',
      );
      title.textContent = tooltipText;
      label.appendChild(title);
      label.classList.add('has-tooltip');
    }
  });
};

const extendLifelines = (
  svg: SVGSVGElement,
  originalHeight: number,
  newHeight: number,
) => {
  const lifelines = svg.querySelectorAll(
    'line.messageLine1, line.loopLine, line[class*="actor-line"]',
  );

  const actors = svg.querySelectorAll('rect.actor, .labelBox');
  const extensionFactor = newHeight / originalHeight;

  lifelines.forEach((line) => {
    if (line.getAttribute('x1') === line.getAttribute('x2')) {
      const currentY2 = parseFloat(line.getAttribute('y2') || '0');
      line.setAttribute('y2', String(currentY2 * extensionFactor));
    }
  });

  const notes = svg.querySelectorAll('rect.note');
  actors.forEach((actor) => {
    if (actor.parentNode) {
      actor.parentNode.appendChild(actor);
    }
  });

  notes.forEach((note) => {
    if (note.parentNode) {
      note.parentNode.appendChild(note);
    }
  });

  const actorLabels = svg.querySelectorAll('text.actor, .labelText');

  actorLabels.forEach((label) => {
    if (label.parentNode) {
      label.parentNode.appendChild(label);
    }
  });

  const defs = svg.querySelector('defs');
  if (defs) {
    const actorBoxes = svg.querySelectorAll('.actor-man, .actor-box');
    actorBoxes.forEach((box) => {
      const x =
        parseFloat(box.getAttribute('x') || '0') +
        parseFloat(box.getAttribute('width') || '0') / 2;

      const y1 =
        parseFloat(box.getAttribute('y') || '0') +
        parseFloat(box.getAttribute('height') || '0');

      const newLine = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'line',
      );
      newLine.setAttribute('x1', String(x));
      newLine.setAttribute('y1', String(y1));
      newLine.setAttribute('x2', String(x));
      newLine.setAttribute('y2', String(originalHeight * extensionFactor));
      newLine.setAttribute('class', 'actor-line');
      newLine.setAttribute('stroke', '#999');
      newLine.setAttribute('stroke-width', '0.5px');
      newLine.setAttribute('stroke-dasharray', '5,5');

      svg.appendChild(newLine);
    });
  }
};

type RenderDiagramArgs = {
  mermaidRef: React.RefObject<HTMLDivElement> | null;
  pages: string[];
  currentPage: number;
};

export const renderDiagram = async ({
  mermaidRef,
  pages,
  currentPage,
}: RenderDiagramArgs) => {
  if (pages.length === 0) return;
  if (!mermaidRef) return;

  try {
    mermaidRef.current.innerHTML = '';

    const tempDiv = document.createElement('div');
    tempDiv.className = 'mermaid';
    tempDiv.style.fontSize = '16px';

    tempDiv.textContent = pages[currentPage];
    mermaidRef.current.appendChild(tempDiv);

    await mermaid.run();

    const svgElement = mermaidRef.current.querySelector('svg');
    if (svgElement) {
      const originalWidth = parseInt(svgElement.getAttribute('width') || '800');
      const originalHeight = parseInt(
        svgElement.getAttribute('height') || '600',
      );

      const newWidth = Math.max(900, originalWidth * 1.2);
      const newHeight = Math.max(800, originalHeight * 1.5);

      svgElement.style.width = `${newWidth}px`;
      svgElement.style.height = `${newHeight}px`;
      svgElement.style.maxWidth = 'none';

      svgElement.setAttribute(
        'viewBox',
        `0 0 ${originalWidth} ${originalHeight}`,
      );
      svgElement.setAttribute('preserveAspectRatio', 'xMinYMin meet');

      extendLifelines(svgElement, originalHeight, newHeight);

      const textElements = svgElement.querySelectorAll('text');
      textElements.forEach((text) => {
        const currentSize = parseFloat(text.getAttribute('font-size') || '12');
        text.setAttribute('font-size', `${currentSize * 1.2}`);
      });

      addParticipantTooltips(svgElement);
    }
  } catch (error) {
    console.error('Mermaid rendering error:', error);
    mermaidRef.current.innerHTML = `
            <div class="error" style="color: red; padding: 10px; border: 1px solid red; border-radius: 4px; margin: 10px 0;">
              <strong>Error rendering diagram:</strong><br>
              ${error.message}<br><br>
              Check the Mermaid syntax in the editor below.
            </div>
          `;
  }
};

export const generateMermaidSequenceDiagram = (
  interactions: Interaction[],
  vats: Vat[],
  maxInteractionsPerPage: number = 20,
) => {
  if (!interactions || interactions.length === 0) {
    return `sequenceDiagram
    Note over System: No interactions found in the selected time range`;
  }

  interactions.sort((a, b) => a.time - b.time);
  const totalPages = Math.ceil(interactions.length / maxInteractionsPerPage);

  if (totalPages <= 1) {
    return generateSinglePageDiagram(interactions, vats);
  }

  const pages: Interaction[][] = [];
  for (let i = 0; i < totalPages; i++) {
    const startIdx = i * maxInteractionsPerPage;
    const endIdx = Math.min(
      (i + 1) * maxInteractionsPerPage,
      interactions.length,
    );
    pages.push(interactions.slice(startIdx, endIdx));
  }

  const diagrams = pages.map((pageInteractions, pageIndex) => {
    const fromTime = new Date(
      pageInteractions[0].time *
        (pageInteractions[0].time > 10000000000 ? 1 : 1000),
    )
      .toISOString()
      .replace('T', ' ')
      .substring(0, 19);
    const toTime = new Date(
      pageInteractions[pageInteractions.length - 1].time *
        (pageInteractions[pageInteractions.length - 1].time > 10000000000
          ? 1
          : 1000),
    )
      .toISOString()
      .replace('T', ' ')
      .substring(0, 19);

    let diagram = 'sequenceDiagram\n';
    diagram += `    title Page ${
      pageIndex + 1
    }/${totalPages}: ${fromTime} to ${toTime}\n`;

    diagram += generateParticipants(interactions, vats);

    // But only add the interactions for this specific page
    diagram += generateInteractions(pageInteractions, vats);

    // If this page has no interactions for a particular vat, add a note
    if (pageInteractions.length === 0) {
      diagram += '    Note over System: No interactions on this page\n';
    } else if (pageInteractions.length < 3) {
      // For pages with very few interactions, add a note to make the diagram more readable
      diagram += `    Note over System: Limited interactions on this page (${pageInteractions.length})\n`;
    }

    return diagram;
  });

  // Join with a special delimiter that we'll use to split the diagrams later
  return diagrams.join('\n%%DIAGRAM_PAGE_BREAK%%\n');
};

// Function to generate a single page diagram (no pagination)
export const generateSinglePageDiagram = (
  interactions: Interaction[],
  vats: Vat[],
) => {
  let diagram = 'sequenceDiagram\n';

  if (interactions.length > 0) {
    const fromTime = new Date(
      interactions[0].time * (interactions[0].time > 10000000000 ? 1 : 1000),
    )
      .toISOString()
      .replace('T', ' ')
      .substring(0, 19);
    const toTime = new Date(
      interactions[interactions.length - 1].time *
        (interactions[interactions.length - 1].time > 10000000000 ? 1 : 1000),
    )
      .toISOString()
      .replace('T', ' ')
      .substring(0, 19);

    diagram += `    title Sequence Diagram: ${fromTime} to ${toTime}\n`;
  }

  diagram += generateParticipants(interactions, vats);
  diagram += generateInteractions(interactions, vats);

  return diagram;
};

// Function to generate participant definitions
export const generateParticipants = (
  interactions: Interaction[],
  vats: Vat[],
) => {
  let result = '';

  const vatIds = new Set();
  vats.forEach((vat) => {
    vatIds.add(vat.vatID);
  });

  const hasSystemMessages = interactions.some(
    (i) => i.sourceVat === 'system' || i.targetVat === 'system',
  );

  Array.from(vatIds).forEach((vatId) => {
    // Sanitize vatId for Mermaid
    const safeVatId = `Vat_${String(vatId).replace(/[^\w]/g, '_')}`;

    const vat = vats.find((v) => v.vatID === vatId);
    const displayName: string = vat?.name || String(vatId);

    const truncatedName =
      displayName.length > 15
        ? displayName.substring(0, 15) + '...'
        : displayName;

    // Add all participants - Mermaid doesn't support conditional styling through syntax
    // Instead, we'll just include all participants consistently
    result += `    participant ${safeVatId} as "${truncatedName}"\n`;
  });

  if (hasSystemMessages) {
    result += '    participant System as "System"\n';
  }

  return result;
};

// Function to generate the interaction lines
export const generateInteractions = (
  interactions: Interaction[],
  vats: Vat[],
) => {
  let result = '';

  const vatIds = new Set();
  vats.forEach((vat) => {
    vatIds.add(vat.vatID);
  });

  interactions.forEach((interaction, index) => {
    const { sourceVat, targetVat, method, type, time } = interaction;

    if (!sourceVat || !targetVat) return;

    if (type === 'syscall' && vatIds.has(sourceVat)) {
      if (!vatIds.has(targetVat) && targetVat !== 'system') {
        const externalName = targetVat.startsWith('target:')
          ? targetVat.substring(7)
          : targetVat;

        const safeSourceVat = `Vat_${sourceVat.replace(/[^\w]/g, '_')}`;

        const methodDisplay =
          method && method.length > 15
            ? `${method.substring(0, 15)}... (${externalName.substring(0, 15)})`
            : `${method || 'unknown'} (${externalName.substring(0, 15)})`;

        result += `    ${safeSourceVat}-x>External: ${methodDisplay}\n`;
      } else if (vatIds.has(targetVat)) {
        const safeSourceVat = `Vat_${sourceVat.replace(/[^\w]/g, '_')}`;
        const safeTargetVat = `Vat_${targetVat.replace(/[^\w]/g, '_')}`;

        const methodDisplay =
          method && method.length > 20
            ? `${method.substring(0, 20)}...`
            : method || 'unknown';

        result += `    ${safeSourceVat}->>>${safeTargetVat}: ${methodDisplay}\n`;
      }
    }
    // Handle normal vat-to-vat or system-to-vat interactions
    else {
      let safeSourceVat;
      if (sourceVat === 'system') {
        safeSourceVat = 'System';
      } else if (vatIds.has(sourceVat)) {
        safeSourceVat = `Vat_${sourceVat.replace(/[^\w]/g, '_')}`;
      } else {
        return;
      }

      let safeTargetVat;
      if (targetVat === 'system') {
        safeTargetVat = 'System';
      } else if (vatIds.has(targetVat)) {
        safeTargetVat = `Vat_${targetVat.replace(/[^\w]/g, '_')}`;
      } else {
        return;
      }

      let arrow = '->>+';
      if (type === 'notify') {
        arrow = '-->>+';
      } else if (type === 'message') {
        arrow = '->>+';
      }

      let methodDisplay =
        method && method.length > 25
          ? method.substring(0, 25) + '...'
          : method || 'unknown';

      methodDisplay = methodDisplay.replace(/[^\w\s\-.,;:()]/g, '_');
      result += `    ${safeSourceVat}${arrow}${safeTargetVat}: ${methodDisplay}\n`;
    }

    // Add logical breaks every 5 interactions for better readability
    if (index % 5 === 4 && index < interactions.length - 1) {
      const nextTime = interactions[index + 1].time;
      const timeGap = nextTime - time;
      const significantGap = timeGap > 30;
      if (significantGap) {
        result += `    Note over System: Time gap (${Math.floor(
          timeGap,
        )} seconds)\n`;
      }
    }
  });

  return result;
};
