import React, { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';

// Configure Mermaid globally with bigger diagram settings
mermaid.initialize({
  startOnLoad: true,
  theme: 'default',
  logLevel: 'error',
  securityLevel: 'loose',  
  newpagePerSection: true, // Support multi-page diagrams
  flowchart: { 
    curve: 'basis',
    diagramPadding: 8,
  },
  sequence: {
    diagramMarginX: 50,
    diagramMarginY: 30,
    boxMargin: 10,
    noteMargin: 10,
    messageMargin: 40,
    mirrorActors: false,
    bottomMarginAdj: 20, // Increased for better lifeline rendering
    useMaxWidth: false,
    rightAngles: false,
    showSequenceNumbers: false,
    actorFontSize: 16,
    noteFontSize: 14,
    messageFontSize: 16,
    width: 150,
    height: 65,
    wrap: false, // Prevent wrapping of actor names
    hideUnusedParticipants: false, // Show all participants
  },
  fontFamily: 'monospace',
  fontSize: 16
});

function MermaidDiagram({ code }) {
  const mermaidRef = useRef(null);
  const containerRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [pages, setPages] = useState([]);
  const [totalPages, setTotalPages] = useState(0);

  // Split diagram code into separate pages when code changes
  useEffect(() => {
    if (code) {
      // Check if the code contains our page break marker
      if (code.includes('%%DIAGRAM_PAGE_BREAK%%')) {
        const diagramPages = code.split('%%DIAGRAM_PAGE_BREAK%%');
        setPages(diagramPages);
        setTotalPages(diagramPages.length);
        setCurrentPage(0); // Reset to first page when new diagram is loaded
      } else {
        // Single page diagram
        setPages([code]);
        setTotalPages(1);
        setCurrentPage(0);
      }
    }
  }, [code]);

  // Handle page navigation
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

  // Render the current page diagram
  useEffect(() => {
    if (mermaidRef.current && pages.length > 0) {
      const renderDiagram = async () => {
        try {
          // Clear previous content
          mermaidRef.current.innerHTML = '';
          
          // Create a new container for the diagram
          const tempDiv = document.createElement('div');
          tempDiv.className = 'mermaid';
          tempDiv.style.fontSize = '16px'; // Bigger font size
          
          // Add the code for the current page to the container
          tempDiv.textContent = pages[currentPage];
          mermaidRef.current.appendChild(tempDiv);
          
          // Process the diagram
          await mermaid.run();
          
          // Find the SVG element and make it larger
          const svgElement = mermaidRef.current.querySelector('svg');
          if (svgElement) {
            // Get original dimensions
            const originalWidth = parseInt(svgElement.getAttribute('width') || 800);
            const originalHeight = parseInt(svgElement.getAttribute('height') || 600);
            
            // Make it bigger
            const newWidth = Math.max(900, originalWidth * 1.2);
            const newHeight = Math.max(800, originalHeight * 1.5); // Increase height more
            
            // Apply new dimensions
            svgElement.style.width = `${newWidth}px`;
            svgElement.style.height = `${newHeight}px`;
            svgElement.style.maxWidth = 'none';
            
            // Set viewBox for better scaling
            svgElement.setAttribute('viewBox', `0 0 ${originalWidth} ${originalHeight}`);
            svgElement.setAttribute('preserveAspectRatio', 'xMinYMin meet');
            
            // Extend the lifelines (vertical dashed lines)
            extendLifelines(svgElement, originalHeight, newHeight);
            
            // Increase font size
            const textElements = svgElement.querySelectorAll('text');
            textElements.forEach(text => {
              const currentSize = parseFloat(text.getAttribute('font-size') || 12);
              text.setAttribute('font-size', `${currentSize * 1.2}`);
            });

            // Add tooltips to participant labels
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
      
      // Helper function to add tooltips to participant labels
      const addParticipantTooltips = (svg) => {
        // Find all participant rectangles and their text labels
        const actorRects = svg.querySelectorAll('rect.actor, .labelBox');
        const actorLabels = svg.querySelectorAll('.actor, .labelText');
        
        // Process both the rectangles and labels for better tooltip coverage
        // First, add tooltips to the actor rectangles (the participant boxes)
        actorRects.forEach(rect => {
          // Find the associated text label
          const textLabel = findLabelForRect(rect, actorLabels);
          if (textLabel) {
            const displayedName = textLabel.textContent.trim();
            let tooltipText;
            
            // Create a detailed tooltip based on participant type
            if (displayedName.includes('System')) {
              tooltipText = 'System: The Neo4j system participant';
            } else {
              // For vat participants, show full info
              let vatName = displayedName;
              // Check if truncated
              if (displayedName.endsWith('...')) {
                // Extract just the vat name without the truncation
                vatName = displayedName.replace('...', '');
              }
              tooltipText = `Vat: ${vatName}\nClick to focus on this vat's interactions`;
            }
            
            // Add title element for tooltip
            const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            title.textContent = tooltipText;
            rect.appendChild(title);
            
            // Add hover effect class
            rect.classList.add('participant-hover');
          }
        });
        
        // Also add tooltips to the text labels themselves
        actorLabels.forEach(label => {
          const displayedName = label.textContent.trim();
          let tooltipText;
          
          if (displayedName.includes('System')) {
            tooltipText = 'System: The Neo4j system participant';
          } else {
            // For vat participants, show full info
            let vatName = displayedName;
            // Check if truncated
            if (displayedName.endsWith('...')) {
              // Extract just the vat name without the truncation
              vatName = displayedName.replace('...', '');
            }
            tooltipText = `Vat: ${vatName}`;
          }
          
          // Add title element for tooltip
          const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
          title.textContent = tooltipText;
          label.appendChild(title);
          
          // Add hover effect class
          label.classList.add('has-tooltip');
        });
      };
      
      // Helper function to find the text label associated with a rectangle
      const findLabelForRect = (rect, labels) => {
        // Get the rectangle's position
        const rectX = parseFloat(rect.getAttribute('x'));
        const rectY = parseFloat(rect.getAttribute('y'));
        const rectWidth = parseFloat(rect.getAttribute('width'));
        
        // Find a label that's positioned within or near the rectangle
        for (const label of labels) {
          const labelX = parseFloat(label.getAttribute('x'));
          const labelY = parseFloat(label.getAttribute('y'));
          
          // Check if the label is positioned within/near the rectangle
          if (Math.abs(labelX - (rectX + rectWidth/2)) < rectWidth/2 + 5 &&
              Math.abs(labelY - (rectY + 15)) < 20) {
            return label;
          }
        }
        
        return null;
      };
      
      // Helper function to extend the lifelines in the sequence diagram
      const extendLifelines = (svg, originalHeight, newHeight) => {
        // Find all lifelines (dashed vertical lines)
        const lifelines = svg.querySelectorAll('line.messageLine1, line.loopLine, line[class*="actor-line"]');
        
        // Find all actor (participant) boxes
        const actors = svg.querySelectorAll('rect.actor, .labelBox');
        
        // Calculate how much we need to extend
        const extensionFactor = newHeight / originalHeight;
        
        // Extend each lifeline
        lifelines.forEach(line => {
          // Only extend vertical lines
          if (line.getAttribute('x1') === line.getAttribute('x2')) {
            // Get the current y2 (bottom point)
            const currentY2 = parseFloat(line.getAttribute('y2'));
            // Extend the line downward
            line.setAttribute('y2', currentY2 * extensionFactor);
          }
        });
        
        // Find all "note" rectangles
        const notes = svg.querySelectorAll('rect.note');
        
        // Fix actor boxes that may be obscured or cut off
        actors.forEach(actor => {
          // Make sure the actor boxes are on top of other elements
          if (actor.parentNode) {
            actor.parentNode.appendChild(actor);
          }
        });
        
        // Fix note boxes that may be obscured or cut off
        notes.forEach(note => {
          // Make sure the note boxes are on top of other elements
          if (note.parentNode) {
            note.parentNode.appendChild(note);
          }
        });
        
        // Find all actor labels (text elements)
        const actorLabels = svg.querySelectorAll('text.actor, .labelText');
        
        // Ensure labels are on top
        actorLabels.forEach(label => {
          if (label.parentNode) {
            label.parentNode.appendChild(label);
          }
        });
        
        // Add new vertical lines directly if needed
        const defs = svg.querySelector('defs');
        if (defs) {
          const actorBoxes = svg.querySelectorAll('.actor-man, .actor-box');
          actorBoxes.forEach(box => {
            // Calculate coordinates for a new vertical line
            const x = parseFloat(box.getAttribute('x')) + 
                     parseFloat(box.getAttribute('width'))/2;
            
            const y1 = parseFloat(box.getAttribute('y')) + 
                      parseFloat(box.getAttribute('height'));
            
            // Create a new line element
            const newLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            newLine.setAttribute('x1', x);
            newLine.setAttribute('y1', y1);
            newLine.setAttribute('x2', x);
            newLine.setAttribute('y2', originalHeight * extensionFactor);
            newLine.setAttribute('class', 'actor-line');
            newLine.setAttribute('stroke', '#999');
            newLine.setAttribute('stroke-width', '0.5px');
            newLine.setAttribute('stroke-dasharray', '5,5');
            
            // Add the line to the diagram
            svg.appendChild(newLine);
          });
        }
      };

      renderDiagram();
    }
  }, [pages, currentPage]); // Re-render when currentPage changes

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
}

export default MermaidDiagram;