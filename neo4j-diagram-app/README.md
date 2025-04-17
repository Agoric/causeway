# Neo4j Diagram App

A React-based web application with a left pane for components and a right pane canvas for rendering Mermaid diagrams.

## Features

- Split view layout with left sidebar and right canvas
- Mermaid diagram rendering in the canvas
- Live editing of diagrams with real-time preview
- Expandable left pane for future component additions

## Getting Started

1. Install dependencies:
   ```
   npm install
   ```

2. Start the development server:
   ```
   npm start
   ```

## Customizing the Mermaid Diagram

Edit the Mermaid code in the textarea to update the diagram in real-time. The default diagram is a simple flowchart, but you can create various types of diagrams including:

- Flowcharts
- Sequence diagrams
- Class diagrams
- State diagrams
- Entity-relationship diagrams
- and more

Learn more about Mermaid syntax at [Mermaid Documentation](https://mermaid.js.org/).

## Planned Features

- Add components to the left pane for interacting with the diagram
- Dynamic diagram generation from application state
- Connection to Neo4j databases for data visualization