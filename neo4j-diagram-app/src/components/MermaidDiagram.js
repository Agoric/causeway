import React, { useEffect, useRef } from 'react';
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

  useEffect(() => {
    if (mermaidRef.current) {
      const renderDiagram = async () => {
        try {
          // Clear previous content
          mermaidRef.current.innerHTML = '';
          
          // Create a new container for the diagram
          const tempDiv = document.createElement('div');
          tempDiv.className = 'mermaid';
          tempDiv.style.fontSize = '16px'; // Bigger font size
          
          // Add the code to the container
          tempDiv.textContent = code;
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
  }, [code]);

  return (
    <div className="mermaid-container" ref={containerRef}>
      <div ref={mermaidRef} className="mermaid-output" />
    </div>
  );
}

export default MermaidDiagram;