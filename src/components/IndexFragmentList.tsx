import type { ReactElement } from 'react';
import { pluralize } from 'react-cheminfo/core';
import { Structure } from 'react-cheminfo/structure';
import { useListKeyboardNavigation } from 'react-cheminfo/ui';

import type { IndexFragment } from '../chemistry/indexFragments.ts';

export interface IndexFragmentListProps {
  /** The key fragments the query contains, one per set bit. */
  fragments: readonly IndexFragment[];
  /** The bit being shown, if any. */
  selected: number | null;
  /** Called with the bit of the fragment the reader picks. */
  onSelect: (bit: number) => void;
}

/**
 * Every key fragment a structure contains, drawn, with the bit it sets and the
 * mask a SQL screen tests it with. Arrow keys walk the list.
 * @param props - The fragments, the selection and what picking does.
 * @returns The list.
 */
export function IndexFragmentList(props: IndexFragmentListProps): ReactElement {
  const { fragments, selected, onSelect } = props;
  const selectedIndex = fragments.findIndex(
    (fragment) => fragment.bit === selected,
  );
  const onKeyDown = useListKeyboardNavigation({
    length: fragments.length,
    selectedIndex,
    onSelect: (index) => {
      const fragment = fragments[index];
      if (fragment) onSelect(fragment.bit);
    },
  });

  if (fragments.length === 0) {
    return (
      <p className="substructure__note">
        Draw a structure to list the key fragments it contains.
      </p>
    );
  }

  return (
    <ul
      className="index-fragments"
      tabIndex={0}
      aria-label="Key fragments of the index"
      onKeyDown={onKeyDown}
    >
      {fragments.map((fragment) => (
        <li key={fragment.bit}>
          <button
            type="button"
            className="index-fragments__item"
            aria-pressed={fragment.bit === selected}
            onClick={() => {
              onSelect(fragment.bit);
            }}
          >
            <Structure idCode={fragment.idCode} width={110} height={70} />
            <span className="index-fragments__bit">bit {fragment.bit}</span>
            <code className="index-fragments__mask">
              index{String(fragment.word).padStart(2, '0')} & {fragment.mask}
            </code>
            <span className="substructure__note">
              {fragment.atoms.length}{' '}
              {pluralize(fragment.atoms.length, 'match', 'matches')}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
