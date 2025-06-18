import mermaid from 'mermaid';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useContext, useEffect, useRef, useState } from 'react';
import { Context as InteractionContext } from 'context/interactions';
import {
  generateMermaidSequenceDiagram,
  getSanitizedInteractionsPerPage,
  renderDiagram,
} from 'helpers';

mermaid.initialize({
  flowchart: {
    curve: 'basis',
    diagramPadding: 8,
  },
  fontFamily: 'monospace',
  fontSize: 16,
  logLevel: 'error',
  startOnLoad: true,
  theme: 'default',
  securityLevel: 'loose',
  sequence: {
    arrowMarkerAbsolute: true,
    actorFontSize: 16,
    bottomMarginAdj: 0,
    boxMargin: 8,
    diagramMarginX: 8,
    diagramMarginY: 8,
    messageFontSize: 16,
    messageMargin: 60,
    mirrorActors: true,
    noteFontSize: 14,
    noteMargin: 8,
    rightAngles: false,
    showSequenceNumbers: false,
    useMaxWidth: true,
    width: 150,
    wrap: true,
  },
});

type MermaidDiagramProps = {
  code: string;
};

const MermaidDiagram = () => {
  const { interactions, vats } = useContext(InteractionContext);
  const pathName = usePathname();
  const mermaidRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pages, setPages] = useState<string[]>([]);

  const _currentPage = Number(searchParams.get('currentPage')) || 1;
  const routerBlockHeight = searchParams.get('blockHeight') || '';
  const routerEndTime = searchParams.get('endTime') || '';
  const routerInteractionsPerPage =
    searchParams.get('interactionsPerPage') || '';
  const routerRunId = searchParams.get('runId') || '';
  const routerStartTime = searchParams.get('startTime') || '';
  const totalPages = pages.length;

  const currentPage = _currentPage - 1;

  const interactionsPerPage = getSanitizedInteractionsPerPage(
    routerInteractionsPerPage,
  );

  const changeCurrentPage = (currentPage: number) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    current.set('currentPage', String(currentPage + 1));
    const search = current.toString();
    router.push(`${pathName}?${search}`);
  };

  useEffect(() => {
    renderDiagram({
      currentPage: Math.max(Math.min(currentPage, totalPages - 1), 0),
      interactions,
      interactionsPerPage,
      mermaidRef: mermaidRef,
      pages,
    });
  }, [currentPage, pages]);

  useEffect(() => {
    const code = generateMermaidSequenceDiagram(
      interactions,
      vats,
      interactionsPerPage,
    );

    if (code)
      setPages(
        code.includes('%%DIAGRAM_PAGE_BREAK%%')
          ? code.split('%%DIAGRAM_PAGE_BREAK%%')
          : [code],
      );
  }, [
    interactions,
    routerBlockHeight,
    routerEndTime,
    routerRunId,
    routerStartTime,
    vats,
  ]);

  return (
    <div
      className="flex flex-col gap-y-4 grow p-5 shrink w-full"
      style={{ maxWidth: 'calc(100% - 20rem)' }}
    >
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3">
          <button
            className="pagination-button"
            disabled={!currentPage}
            onClick={() => currentPage && changeCurrentPage(currentPage - 1)}
          >
            ← Previous Page
          </button>
          <span className="font-bold px-4">
            {`Page ${currentPage + 1} of ${totalPages}`}
          </span>
          <button
            className="pagination-button"
            disabled={currentPage === totalPages - 1}
            onClick={() =>
              currentPage < totalPages - 1 && changeCurrentPage(currentPage + 1)
            }
          >
            Next Page →
          </button>
        </div>
      )}
      <div
        ref={mermaidRef}
        className="bg-white border border-gray-L300 border-solid grow max-w-full no-scrollbar overflow-scroll p-4 rounded-sm shrink"
      />
    </div>
  );
};

export default MermaidDiagram;
