import React, { useState } from 'react';
import './App.css';
import LeftPane from './components/LeftPane';
import MermaidDiagram from './components/MermaidDiagram';

function App() {
  const [mermaidCode, setMermaidCode] = useState(`sequenceDiagram
    participant A as System
    participant B as Vat1
    A->>B: Example
    Note over A,B: Connect to Neo4j and set time range to generate a real diagram
  `);

  const handleDiagramGenerated = (diagramCode) => {
    setMermaidCode(diagramCode);
  };

  return (
    <div className="app">
      <div className="left-pane">
        <LeftPane onDiagramGenerated={handleDiagramGenerated} />
      </div>
      <div className="canvas-pane">
        <MermaidDiagram code={mermaidCode} />
        <textarea
          className="mermaid-editor"
          value={mermaidCode}
          onChange={(e) => setMermaidCode(e.target.value)}
          placeholder="Enter Mermaid diagram code here"
        />
      </div>
    </div>
  );
}

export default App;