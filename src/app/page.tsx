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
    <div className="flex flex-col h-screen sm:flex-row overflow-hidden w-screen">
      <div className="bg-gray-L100 border-0 border-b border-gray-L300 flex flex-col sm:border-b-0 sm:border-r border-solid sm:max-w-xs p-0 w-full">
        <LeftPane onDiagramGenerated={handleDiagramGenerated} />
      </div>
      <MermaidDiagram code={mermaidCode} />
    </div>
  );
};

export default Page;
