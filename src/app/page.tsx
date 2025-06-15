'use client';

import { useState } from 'react';
import 'index.css';
import LeftPane from 'components/LeftPane';
import MermaidDiagram from 'components/MermaidDiagram';

const Page = () => {
  const [mermaidCode, setMermaidCode] = useState(`sequenceDiagram
    participant A as System
    participant B as Vat1
    A->>B: Example
    Note over A,B: Connect to Neo4j and set time range to generate a real diagram
  `);

  const handleDiagramGenerated = (diagramCode: string) =>
    setMermaidCode(diagramCode);

  return (
    <div className="app">
      <div className="left-pane">
        <LeftPane onDiagramGenerated={handleDiagramGenerated} />
      </div>
      <div className="canvas-pane">
        <MermaidDiagram code={mermaidCode} />
      </div>
    </div>
  );
};

export default Page;
