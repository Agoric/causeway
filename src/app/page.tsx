'use client';

import { Suspense } from 'react';
import 'index.css';
import InteractionProvider from 'context/interactions';
import LeftPane from 'components/LeftPane';
import MermaidDiagram from 'components/MermaidDiagram';

const Page = () => (
  <InteractionProvider>
    <div className="flex flex-col h-screen sm:flex-row overflow-hidden w-screen">
      <LeftPane />
      <Suspense>
        <MermaidDiagram />
      </Suspense>
    </div>
  </InteractionProvider>
);

export default Page;
