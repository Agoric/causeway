import { useState } from 'react';
import Neo4jSequenceDiagram from './Neo4jSequenceDiagram';

type Props = {
  onDiagramGenerated: (diagramCode: string) => void;
};
const LeftPane = ({ onDiagramGenerated }: Props) => {
  const [activeTab, setActiveTab] = useState<'view' | 'import'>('view');
  return (
    <div className="left-pane-content">
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'view' ? 'active' : ''}`}
          onClick={() => setActiveTab('view')}
        >
          View Diagram
        </button>
      </div>

      <div className="tab-content">
        <Neo4jSequenceDiagram onDiagramGenerated={onDiagramGenerated} />
      </div>
    </div>
  );
};

export default LeftPane;
