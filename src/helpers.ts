import mermaid from 'mermaid';
import { RefObject } from 'react';

import { Interaction } from 'types/common';
import { Vat } from 'types/create-vat';

const LINE_NUMBER_ATTRIBUTE_NAME = 'messagelinenumber';
const MESSAGE_NUMBER_ATTRIBUTE_NAME = 'messagenumber';
const SVG_NS = 'http://www.w3.org/2000/svg';

const addParticipantTooltips = (
  currentPage: number,
  interactions: Array<Interaction>,
  interactionsPerPage: number,
  svg: SVGSVGElement,
) => {
  const messageTooltipMap: { [key: string]: SVGGElement } = {};
  svg
    .querySelectorAll<SVGTextElement>('text[class="messageText"]')
    .forEach((textElement) => {
      textElement.style.removeProperty('font-size');
      textElement.classList.add('text-xs');
    });

  svg
    .querySelectorAll<SVGLineElement>(`[${LINE_NUMBER_ATTRIBUTE_NAME}]`)
    .forEach((lineElement) => {
      const defaultOpacity = '0';
      const messageNumber = lineElement.getAttribute(
        LINE_NUMBER_ATTRIBUTE_NAME,
      )!;

      const interaction =
        interactions[
          currentPage * interactionsPerPage + Number(messageNumber) - 1
        ];
      if (!interaction?.crankNum) return;

      const horizontalPadding = 6;
      const verticalPadding = 3;
      const x =
        Math.max(
          Number(lineElement.getAttribute('x1')),
          Number(lineElement.getAttribute('x2')),
        ) + 16;
      const y = Number(lineElement.getAttribute('y1'));

      const group = document.createElementNS(SVG_NS, 'g');
      group.setAttribute('tooltipLineNumber', messageNumber);
      group.style.opacity = defaultOpacity;

      const toolTip = document.createElementNS(SVG_NS, 'text');
      toolTip.classList.add(...'font-mono text-gray-L900 text-xs'.split(' '));
      toolTip.setAttribute('tooltipLineNumber', messageNumber);
      toolTip.setAttribute('x', String(x));
      toolTip.setAttribute('y', String(y));
      toolTip.textContent = `${interaction.crankNum}@${interaction.targetVat}`;

      group.appendChild(toolTip);
      lineElement.parentElement?.appendChild(group);

      const bbox = toolTip.getBBox();

      const backgroundProvider = document.createElementNS(SVG_NS, 'rect');
      backgroundProvider.setAttribute(
        'height',
        String(bbox.height + verticalPadding * 2),
      );
      backgroundProvider.setAttribute('rx', '2');
      backgroundProvider.setAttribute('ry', '2');
      backgroundProvider.setAttribute(
        'width',
        String(bbox.width + horizontalPadding * 2),
      );
      backgroundProvider.setAttribute('x', String(bbox.x - horizontalPadding));
      backgroundProvider.setAttribute('y', String(bbox.y - verticalPadding));
      backgroundProvider.classList.add(
        ...'fill-yellow-100 stroke-yellow-200'.split(' '),
      );

      group.insertBefore(backgroundProvider, toolTip);

      lineElement.addEventListener(
        'mouseenter',
        () => (group.style.opacity = '1'),
      );
      lineElement.addEventListener(
        'mouseleave',
        () => (group.style.opacity = defaultOpacity),
      );

      messageTooltipMap[messageNumber] = group;
    });

  svg
    .querySelectorAll<SVGTextElement>(`[${MESSAGE_NUMBER_ATTRIBUTE_NAME}]`)
    .forEach((textElement) => {
      const messageNumber = textElement.getAttribute(
        MESSAGE_NUMBER_ATTRIBUTE_NAME,
      )!;

      const toolTip = messageTooltipMap[messageNumber];
      if (!toolTip) return;

      textElement.addEventListener(
        'mouseenter',
        () => (toolTip.style.opacity = '1'),
      );
      textElement.addEventListener(
        'mouseleave',
        () => (toolTip.style.opacity = '0'),
      );
    });

  const actorRects = svg.querySelectorAll('rect.actor, .labelBox');
  const actorLabels = svg.querySelectorAll('.actor, .labelText');

  actorRects.forEach((rect: SVGRectElement) => {
    const textLabel = findLabelForRect(rect, actorLabels);
    if (textLabel && textLabel.textContent) {
      const displayedName = textLabel.textContent.trim();
      let tooltipText;

      if (displayedName.includes('System'))
        tooltipText = 'System: The Neo4j system participant';
      else {
        let vatName = displayedName;
        if (displayedName.endsWith('...'))
          vatName = displayedName.replace('...', '');
        tooltipText = `Vat: ${vatName}\nClick to focus on this vat's interactions`;
      }

      const title = document.createElementNS(SVG_NS, 'title');
      title.textContent = tooltipText;
      rect.appendChild(title);

      rect.classList.add('participant-hover');
    }
  });

  actorLabels.forEach((label) => {
    if (label && label.textContent) {
      const displayedName = label.textContent.trim();
      let tooltipText;

      if (displayedName.includes('System'))
        tooltipText = 'System: The Neo4j system participant';
      else {
        let vatName = displayedName;

        if (displayedName.endsWith('...'))
          vatName = displayedName.replace('...', '');
        tooltipText = `Vat: ${vatName}`;
      }

      const title = document.createElementNS(SVG_NS, 'title');
      title.textContent = tooltipText;
      label.appendChild(title);
      label.classList.add('has-tooltip');
    }
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

const fixAlignments = (svgElement: SVGSVGElement) => {
  const centres: { [key: string]: number } = {};

  const findActor = (x: number) =>
    Object.entries(centres).reduce(
      (best, [id, cx]) => {
        const d = Math.abs(cx - x);
        return d < best.dist ? { id, dist: d } : best;
      },
      { id: null, dist: Infinity },
    ).id;

  svgElement
    .querySelectorAll<SVGLineElement>('line[id^="actor"]')
    .forEach(
      (line) =>
        (centres[line.id.replace(/^actor/, '')] =
          parseFloat(line.getAttribute('x1')!) + 1),
    );

  svgElement
    .querySelectorAll<SVGLineElement>('line[class^="messageLine"]')
    .forEach((line) => {
      const x1 = parseFloat(line.getAttribute('x1')!);
      const x2 = parseFloat(line.getAttribute('x2')!);

      const callerId = findActor(x1);
      const targetId = findActor(x2);

      if (!callerId || !targetId)
        return console.log('Failed to find best actors for: ', line.outerHTML);

      line.setAttribute('x1', String(centres[callerId]));
      line.setAttribute('x2', String(centres[targetId]));
    });
};

const generateInteractions = (interactions: Interaction[], vats: Vat[]) => {
  let result = '';

  const vatIds = new Set();
  vats.forEach((vat) => {
    vatIds.add(vat.vatID);
  });

  interactions.forEach((interaction, index) => {
    const {
      argSize,
      blockHeight,
      elapsed,
      method,
      promiseId,
      sourceVat,
      targetId,
      targetVat,
      time,
      type,
    } = interaction;

    if (!sourceVat || !targetVat) return;

    if (type === 'syscall' && vatIds.has(sourceVat)) {
      if (!vatIds.has(targetVat) && targetVat !== 'system') {
        const externalName = targetVat.startsWith('target:')
          ? targetVat.substring(7)
          : targetVat;

        const safeSourceVat = getMermaidId(sourceVat);

        const methodDisplay =
          method && method.length > 15
            ? `${method.substring(0, 15)}... (${externalName.substring(0, 15)})`
            : `${method} (${externalName.substring(0, 15)})`;

        result += `    ${safeSourceVat}-x>External: ${methodDisplay}\n`;
      } else if (vatIds.has(targetVat)) {
        const safeSourceVat = getMermaidId(sourceVat);
        const safeTargetVat = getMermaidId(targetVat);

        const methodDisplay =
          method && method.length > 20
            ? `${method.substring(0, 20)}...`
            : method;

        result += `    ${safeSourceVat}->>>${safeTargetVat}: ${methodDisplay}\n`;
      }
    }
    // Handle normal vat-to-vat or system-to-vat interactions
    else {
      let safeSourceVat;
      let safeTargetVat;

      if (sourceVat === 'system') safeSourceVat = 'System';
      else if (vatIds.has(sourceVat)) safeSourceVat = getMermaidId(sourceVat);
      else return;

      if (targetVat === 'system') safeTargetVat = 'System';
      else if (vatIds.has(targetVat)) safeTargetVat = getMermaidId(targetVat);
      else return;

      let arrow = '->>+';
      if (type === 'notify') arrow = '-->>+';
      else if (type === 'message') arrow = '->>+';

      let methodDisplay =
        method && method.length > 25 ? method.substring(0, 25) + '...' : method;

      methodDisplay = methodDisplay.replace(/[^\w\s\-.,;:()]/g, '_');
      result += [
        safeSourceVat,
        arrow,
        safeTargetVat,
        `: ${blockHeight} ${Math.round(elapsed * 1000) / 1000} `,
        promiseId && `${promiseId} <-`,
        targetId,
        '.',
        methodDisplay,
        `(${argSize || ''})`,
        '\n',
      ]
        .filter(Boolean)
        .join('');
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

const getMermaidId = (vatId: string) => `Vat_${vatId.replace(/[^\w]/g, '_')}`;

export const getSanitizedInteractionsPerPage = (
  interactionsPerPage: string | null,
) => Math.max(5, Math.min(50, Number(interactionsPerPage) || 20));

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

const generateParticipants = (
  interactions: Interaction[],
  vats: Vat[],
): string => {
  let result = '';
  const hasSystemMessages = interactions.some(
    (i) => i.sourceVat === 'system' || i.targetVat === 'system',
  );

  for (const vat of vats) {
    const mermaidId = getMermaidId(vat.vatID);
    const displayName =
      vat.vatID !== vat.name ? `${vat.vatID}:${truncate(vat.name)}` : vat.vatID;
    result += `    participant ${mermaidId} as ${displayName}\n`;
  }

  if (hasSystemMessages) result += '    participant System as "System"\n';

  return result;
};

const generateSinglePageDiagram = (
  interactions: Interaction[],
  vats: Vat[],
) => {
  let diagram = 'sequenceDiagram\n';

  diagram += generateParticipants(interactions, vats);
  diagram += generateInteractions(interactions, vats);

  return diagram;
};

// Convert string timestamp (1729570627.218393) to numeric timestamp
export const parseTimestamp = (timestampStr: string | null) => {
  if (!timestampStr) return null;
  const num = parseFloat(timestampStr);
  return isNaN(num) ? null : num;
};

type RenderDiagramArgs = {
  currentPage: number;
  interactions: Array<Interaction>;
  interactionsPerPage: number;
  mermaidRef: RefObject<HTMLDivElement | null>;
  pages: string[];
};

export const renderDiagram = async ({
  currentPage,
  interactions,
  interactionsPerPage,
  mermaidRef,
  pages,
}: RenderDiagramArgs) => {
  if (!(pages.length && mermaidRef.current)) return;

  try {
    const { svg } = await mermaid.render(
      'mermaid-svg',
      pages[currentPage],
      mermaidRef.current,
    );
    mermaidRef.current.innerHTML = svg;

    const svgElement = mermaidRef.current.querySelector('svg');

    if (svgElement) {
      svgElement.classList.add('flex-shrink-0', '!max-w-none');
      svgElement.style.minWidth = svgElement.style.maxWidth;

      fixAlignments(svgElement);
      addParticipantTooltips(
        currentPage,
        interactions,
        interactionsPerPage,
        svgElement,
      );
    }
  } catch (error) {
    console.error('Mermaid rendering error:', error);
    mermaidRef.current.innerHTML = `
      <div class="border border-red-500 border-solid flex flex-col gap-y-3 p-3 rounded-sm text-red-500">
        <strong>Error rendering diagram:</strong>
        <p>${error.message}</p>
      </div>
    `;
  }
};

const truncate = (name: string, maxLength = 15) =>
  name.length > maxLength ? `${name.slice(0, maxLength)}...` : name;
