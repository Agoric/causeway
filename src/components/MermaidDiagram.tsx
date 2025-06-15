import { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { renderDiagram } from 'helpers';

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
    diagramMarginX: 0,
    diagramMarginY: 8,
    height: 65,
    messageFontSize: 16,
    messageMargin: 60,
    mirrorActors: false,
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

const MermaidDiagram = ({ code }: MermaidDiagramProps) => {
  const mermaidRef = useRef<HTMLDivElement | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [pages, setPages] = useState<string[]>([]);
  const [totalPages, setTotalPages] = useState(0);

  // Render the current page diagram
  useEffect(() => {
    renderDiagram({
      mermaidRef: mermaidRef,
      pages,
      currentPage,
    });
  }, [pages, currentPage]);

  useEffect(() => {
    if (code) {
      if (code.includes('%%DIAGRAM_PAGE_BREAK%%')) {
        const diagramPages = code.split('%%DIAGRAM_PAGE_BREAK%%');
        setPages(diagramPages);
        setTotalPages(diagramPages.length);
        setCurrentPage(0);
      } else {
        setPages([code]);
        setTotalPages(1);
        setCurrentPage(0);
      }
    }
  }, [code]);

  const nextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <div className="mermaid-wrapper">
      {totalPages > 1 && (
        <div className="pagination-controls">
          <button
            onClick={prevPage}
            disabled={currentPage === 0}
            className="pagination-button"
          >
            ← Previous Page
          </button>
          <span className="page-indicator">
            Page {currentPage + 1} of {totalPages}
          </span>
          <button
            onClick={nextPage}
            disabled={currentPage === totalPages - 1}
            className="pagination-button"
          >
            Next Page →
          </button>
        </div>
      )}
      <div ref={mermaidRef} className="mermaid-container" />
    </div>
  );
};

export default MermaidDiagram;
