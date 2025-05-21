import { Session, Driver } from 'neo4j-driver';
import neo4j from './lib/neo4j';
import mermaid from 'mermaid';

export const createNeo4jDriver = async (
  uri: string,
  username: string,
  password: string
): Promise<Driver> => {
  try {
    const driver: Driver = neo4j.driver(
      uri,
      neo4j.auth.basic(username, password),
      {
        encrypted: uri.includes('neo4j+s') || uri.includes('bolt+s'),
        disableLosslessIntegers: true,
      }
    );

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

export const generateNeo4jGraph = async (data: any, session: Session) => {
  const { vats, deliveries, syscalls, blocks } = data;
  const promises = data.promises || [];

  // Create Vat nodes
  for (const vat of vats) {
    try {
      await session.run(
        `MERGE (v:Vat {vatID: $vatID})
         SET v.name = $name, v.createdAt = $time`,
        { vatID: vat.vatID, name: vat.name, time: vat.time }
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
        { height: block.height, time: block.time, blockTime: block.blockTime }
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
          }
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
          }
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
          }
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
        }
      );
    } catch (error) {
      console.error('Error creating promise relationship:', error);
    }
  }
};

export const processLogFile = async (file, setProgress) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        if (!event.target || !event.target.result) {
          reject(
            new Error('Failed to read file: event.target or result is null')
          );
          return;
        }
        const lines = (event.target.result as string).split('\n');
        const totalLines = lines.length;

        setProgress(`Processing ${totalLines} log entries...`);

        type Vat = { vatID: any; name: any; time: any };
        type Block = { height: any; time: any; blockTime: any };
        type Delivery =
          | {
              type: 'message';
              method: any;
              vatID: any;
              time: any;
              target: any;
              result: any;
              crankNum: any;
              blockHeight: any;
            }
          | {
              type: 'notify';
              state: any;
              vatID: any;
              time: any;
              kpid: any;
              blockHeight: any;
            };
        type Syscall = {
          type: 'send';
          method: any;
          vatID: any;
          time: any;
          target: any;
          result: any;
        };
        type PromiseObj = {
          kpid?: any;
          creator?: any;
          resolver?: any;
        };

        const data: {
          vats: Vat[];
          deliveries: Delivery[];
          syscalls: Syscall[];
          blocks: Block[];
          promises: PromiseObj[];
        } = {
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
                    state: state,
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
              `Processed ${processedLines}/${totalLines} log entries...`
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

const findLabelForRect = (rect, labels) => {
  const rectX = parseFloat(rect.getAttribute('x'));
  const rectY = parseFloat(rect.getAttribute('y'));
  const rectWidth = parseFloat(rect.getAttribute('width'));

  for (const label of labels) {
    const labelX = parseFloat(label.getAttribute('x'));
    const labelY = parseFloat(label.getAttribute('y'));

    if (
      Math.abs(labelX - (rectX + rectWidth / 2)) < rectWidth / 2 + 5 &&
      Math.abs(labelY - (rectY + 15)) < 20
    ) {
      return label;
    }
  }

  return null;
};

const addParticipantTooltips = (svg) => {
  const actorRects = svg.querySelectorAll('rect.actor, .labelBox');
  const actorLabels = svg.querySelectorAll('.actor, .labelText');

  actorRects.forEach((rect) => {
    const textLabel = findLabelForRect(rect, actorLabels);
    if (textLabel) {
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
        'title'
      );
      title.textContent = tooltipText;
      rect.appendChild(title);

      rect.classList.add('participant-hover');
    }
  });

  actorLabels.forEach((label) => {
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
      'title'
    );
    title.textContent = tooltipText;
    label.appendChild(title);
    label.classList.add('has-tooltip');
  });
};

const extendLifelines = (svg, originalHeight, newHeight) => {
  const lifelines = svg.querySelectorAll(
    'line.messageLine1, line.loopLine, line[class*="actor-line"]'
  );

  const actors = svg.querySelectorAll('rect.actor, .labelBox');
  const extensionFactor = newHeight / originalHeight;

  lifelines.forEach((line) => {
    if (line.getAttribute('x1') === line.getAttribute('x2')) {
      const currentY2 = parseFloat(line.getAttribute('y2'));
      line.setAttribute('y2', currentY2 * extensionFactor);
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
        parseFloat(box.getAttribute('x')) +
        parseFloat(box.getAttribute('width')) / 2;

      const y1 =
        parseFloat(box.getAttribute('y')) +
        parseFloat(box.getAttribute('height'));

      const newLine = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'line'
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

export const renderDiagram = async ({ mermaidRef, pages, currentPage }) => {
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
      const originalWidth = parseInt(svgElement.getAttribute('width') || 800);
      const originalHeight = parseInt(svgElement.getAttribute('height') || 600);

      const newWidth = Math.max(900, originalWidth * 1.2);
      const newHeight = Math.max(800, originalHeight * 1.5);

      svgElement.style.width = `${newWidth}px`;
      svgElement.style.height = `${newHeight}px`;
      svgElement.style.maxWidth = 'none';

      svgElement.setAttribute(
        'viewBox',
        `0 0 ${originalWidth} ${originalHeight}`
      );
      svgElement.setAttribute('preserveAspectRatio', 'xMinYMin meet');

      extendLifelines(svgElement, originalHeight, newHeight);

      const textElements = svgElement.querySelectorAll('text');
      textElements.forEach((text) => {
        const currentSize = parseFloat(text.getAttribute('font-size') || 12);
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
