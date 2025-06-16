import { Suspense, useState } from 'react';
import Neo4jSequenceDiagram from 'components/Neo4jSequenceDiagram';

type Props = {
  onDiagramGenerated: (diagramCode: string) => void;
};

const LeftPane = ({ onDiagramGenerated }: Props) => {
  const [activeTab, setActiveTab] = useState<'view' | 'import'>('view');

  return (
    <>
      <div className="border-0 border-b border-gray-L300 border-solid flex">
        <button
          className={`border-0 border-b-2 border-solid cursor-pointer duration-300 flex font-bold grow hover:bg-gray-L200 justify-center p-3 shrink transition-all ${
            activeTab === 'view'
              ? 'bg-white border-blue-500 text-blue-500'
              : 'bg-gray-L50 border-transparent'
          }`}
          onClick={() => setActiveTab('view')}
        >
          View Diagram
        </button>
      </div>

      <div className="no-scrollbar p-4 overflow-y-scroll">
        <Suspense>
          <Neo4jSequenceDiagram onDiagramGenerated={onDiagramGenerated} />
        </Suspense>
      </div>
    </>
  );
};

export default LeftPane;
