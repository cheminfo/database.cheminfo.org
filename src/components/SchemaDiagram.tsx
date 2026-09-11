import type { ReactElement } from 'react';

import type { DiagramNode } from '../data/schemaDiagram.ts';
import {
  NODE_HEIGHT,
  NODE_WIDTH,
  SCHEMA_DIAGRAM,
} from '../data/schemaDiagram.ts';

/**
 * The tables and the keys between them, drawn from `SCHEMA`.
 *
 * Every box links to the card that lists that table's columns, so the picture
 * is the page's table of contents as well as its map.
 * @returns The diagram.
 */
export function SchemaDiagram(): ReactElement {
  const { width, height, nodes, edges } = SCHEMA_DIAGRAM;
  return (
    <figure className="schema__diagram">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`The ${nodes.length} tables of the database and the ${edges.length} keys between them`}
      >
        <defs>
          <marker
            id="schema-arrow"
            className="schema__arrow-head"
            viewBox="0 0 8 8"
            refX="8"
            refY="4"
            markerWidth="9"
            markerHeight="9"
            markerUnits="userSpaceOnUse"
            orient="auto"
          >
            <path d="M 0 0 L 8 4 L 0 8 Z" />
          </marker>
        </defs>
        {edges.map((edge) => (
          <path
            key={`${edge.from}-${edge.to}`}
            className={
              edge.dashed ? 'schema__edge schema__edge--reads' : 'schema__edge'
            }
            d={edge.path}
            markerEnd="url(#schema-arrow)"
          >
            <title>{edge.label}</title>
          </path>
        ))}
        {nodes.map((node) => (
          <Box key={node.name} node={node} />
        ))}
      </svg>
      <figcaption>
        An arrow points at the table its key names. A dashed box is a view, and
        a dashed arrow is a column it reads rather than a key it declares.
        Follow a box to the columns it holds.
      </figcaption>
    </figure>
  );
}

function Box({ node }: { node: DiagramNode }): ReactElement {
  return (
    <a
      className={
        node.kind === 'view'
          ? 'schema__node schema__node--view'
          : 'schema__node'
      }
      href={`#table-${node.name}`}
    >
      <title>{node.blurb}</title>
      <rect
        x={node.x}
        y={node.y}
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        rx={8}
      />
      <text
        className="schema__node-name"
        x={node.x + NODE_WIDTH / 2}
        y={node.y + 20}
        textAnchor="middle"
      >
        {node.name}
      </text>
      <text
        className="schema__node-rows"
        x={node.x + NODE_WIDTH / 2}
        y={node.y + 36}
        textAnchor="middle"
      >
        {node.rowCount.toLocaleString('en')} rows
        {node.kind === 'view' ? ' · view' : ''}
      </text>
    </a>
  );
}
