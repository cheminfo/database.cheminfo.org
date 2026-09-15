import { Tooltip } from '@blueprintjs/core';
import type { CSSProperties, ReactElement } from 'react';
import { formatInteger } from 'react-cheminfo/core';

import type { DiagramNode } from '../data/schemaDiagram.ts';
import {
  NODE_HEIGHT,
  NODE_WIDTH,
  SCHEMA_DIAGRAM,
} from '../data/schemaDiagram.ts';

/**
 * The tables and the keys between them, drawn from `SCHEMA` as a tree.
 *
 * Every box links to the card that lists that table's columns, so the picture
 * is the page's table of contents as well as its map, and hovering a box lists
 * its columns and their types.
 * @returns The diagram.
 */
export function SchemaDiagram(): ReactElement {
  const { width, height, nodes, edges, marks } = SCHEMA_DIAGRAM;
  const canvasStyle = {
    aspectRatio: `${width} / ${height}`,
    '--schema-width': width,
  } as CSSProperties;
  return (
    <figure className="schema__diagram">
      <div
        className="schema__canvas"
        style={canvasStyle}
        role="group"
        aria-label={`The ${nodes.length} tables of the database and the ${edges.length} keys between them`}
      >
        <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          <defs>
            <marker
              id="schema-arrow"
              className="schema__arrow-head"
              viewBox="0 0 8 8"
              refX="8"
              refY="4"
              markerWidth="8"
              markerHeight="8"
              markerUnits="userSpaceOnUse"
              orient="auto"
            >
              <path d="M 0 0 L 8 4 L 0 8 Z" />
            </marker>
          </defs>
          {edges.map((edge) => (
            <path
              key={`${edge.parent}-${edge.child}`}
              className={edgeClassName(edge.dashed, edge.secondary)}
              d={edge.path}
              markerEnd="url(#schema-arrow)"
            >
              <title>{`${edge.label} (${edge.cardinality.replace(':', ' to ')})`}</title>
            </path>
          ))}
          {marks.map((mark) => (
            <text
              key={`${mark.x},${mark.y}`}
              className="schema__cardinality"
              x={mark.x}
              y={mark.y}
              textAnchor={mark.anchor}
            >
              {mark.text}
            </text>
          ))}
        </svg>
        {nodes.map((node) => (
          <Box key={node.name} node={node} width={width} height={height} />
        ))}
      </div>
      <figcaption>
        An arrow runs from a table to the table whose key names it: one row on
        the <strong>1</strong> side has <strong>n</strong> rows on the other. A
        dashed box is a view, and a dashed arrow is a column it reads rather
        than a key it declares. Hover a box for its columns; follow it to its
        card.
      </figcaption>
    </figure>
  );
}

function edgeClassName(dashed: boolean, secondary: boolean): string {
  let className = 'schema__edge';
  if (dashed) className += ' schema__edge--reads';
  if (secondary) className += ' schema__edge--secondary';
  return className;
}

interface BoxProps {
  node: DiagramNode;
  width: number;
  height: number;
}

function Box({ node, width, height }: BoxProps): ReactElement {
  const style: CSSProperties = {
    left: percent(node.x, width),
    top: percent(node.y, height),
    width: percent(NODE_WIDTH, width),
    height: percent(NODE_HEIGHT, height),
  };
  const kindClass = node.kind === 'view' ? ' schema__node--view' : '';
  return (
    <Tooltip
      content={<ColumnTypes node={node} />}
      placement="right"
      hoverOpenDelay={150}
      renderTarget={({ ref, isOpen, className, ...targetProps }) => (
        <a
          {...targetProps}
          ref={ref}
          className={`${className ?? ''} schema__node${kindClass}`}
          data-open={isOpen}
          href={`#table-${node.name}`}
          style={style}
        >
          <span className="schema__node-name">{node.name}</span>
          <span className="schema__node-rows">
            {formatInteger(node.rowCount)} rows
            {node.kind === 'view' ? ' · view' : ''}
          </span>
        </a>
      )}
    />
  );
}

function ColumnTypes({ node }: { node: DiagramNode }): ReactElement {
  return (
    <div className="schema__tip">
      <div className="schema__tip-title">
        {node.name}
        {node.kind === 'view' ? ' (view)' : ''}
      </div>
      <p className="schema__tip-blurb">{node.blurb}</p>
      <table className="schema__tip-columns">
        <tbody>
          {node.columns.map((column) => (
            <tr key={column.name}>
              <td className="schema__tip-name">{column.name}</td>
              <td className="schema__tip-type">
                {column.type || 'computed'}
                {column.nullable ? '' : ' NOT NULL'}
              </td>
              <td className="schema__tip-key">
                {column.references
                  ? `→ ${column.references.table}.${column.references.column}`
                  : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function percent(value: number, total: number): string {
  return `${(value / total) * 100}%`;
}
