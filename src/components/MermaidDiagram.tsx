import { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { renderDiagram } from 'helpers';

mermaid.initialize({
  startOnLoad: true,
  theme: 'default',
  logLevel: 'error',
  securityLevel: 'loose',
  flowchart: {
    curve: 'basis',
    diagramPadding: 8,
  },
  sequence: {
    diagramMarginX: 50,
    diagramMarginY: 50,
    boxMargin: 10,
    noteMargin: 10,
    messageMargin: 60,
    mirrorActors: false,
    bottomMarginAdj: 20,
    useMaxWidth: false,
    rightAngles: false,
    showSequenceNumbers: false,
    actorFontSize: 16,
    noteFontSize: 14,
    messageFontSize: 16,
    width: 150,
    height: 65,
    wrap: true,
    hideUnusedParticipants: true,
  },
  fontFamily: 'monospace',
  fontSize: 16,
});

type MermaidDiagramProps = {
  code: string;
};

const MermaidDiagram = ({ code }: MermaidDiagramProps) => {
  const mermaidRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [pages, setPages] = useState<string[]>([]);
  const [totalPages, setTotalPages] = useState(0);

  // Render the current page diagram
  useEffect(() => {
    renderDiagram({
      mermaidRef: mermaidRef as React.RefObject<HTMLDivElement>,
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
      <div className="mermaid-container" ref={containerRef}>
        <div ref={mermaidRef} className="mermaid-output" />
      </div>
    </div>
  );
};

export default MermaidDiagram;
