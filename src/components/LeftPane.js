import React, { useState } from 'react';
import Neo4jSequenceDiagram from './Neo4jSequenceDiagram';
import LogImporter from './LogImporter';

function LeftPane({ onDiagramGenerated }) {
  const [activeTab, setActiveTab] = useState('view'); // 'view' or 'import'
  
  return (
    <div className="left-pane-content">
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'view' ? 'active' : ''}`} 
          onClick={() => setActiveTab('view')}
        >
          View Diagram
        </button>
        <button 
          className={`tab ${activeTab === 'import' ? 'active' : ''}`} 
          onClick={() => setActiveTab('import')}
        >
          Import Logs
        </button>
      </div>
      
      <div className="tab-content">
        {activeTab === 'view' ? (
          <Neo4jSequenceDiagram onDiagramGenerated={onDiagramGenerated} />
        ) : (
          <LogImporter />
        )}
      </div>
    </div>
  );
}

export default LeftPane;