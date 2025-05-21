'use client';

import { useState } from 'react';
import './page.css';
import LeftPane from './components/LeftPane';
import MermaidDiagram from './components/MermaidDiagram';

export default function Page() {
  const [mermaidCode, setMermaidCode] = useState(`sequenceDiagram
    participant A as System
    participant B as Vat1
    A->>B: Example
    Note over A,B: Connect to Neo4j and set time range to generate a real diagram
  `);

  const handleDiagramGenerated = (diagramCode: string) => {
    setMermaidCode(diagramCode);
  };

  return (
    <div className='app'>
      <div className='left-pane'>
        <LeftPane onDiagramGenerated={handleDiagramGenerated} />
      </div>
      <div className='canvas-pane'>
        <MermaidDiagram code={mermaidCode} />
        <textarea
          className='mermaid-editor'
          value={mermaidCode}
          onChange={(e) => setMermaidCode(e.target.value)}
          placeholder='Enter Mermaid diagram code here'
        />
      </div>
    </div>
  );
}
