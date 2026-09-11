import { Button, InputGroup, Tag } from '@blueprintjs/core';
import type { ReactElement } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { CompoundSummary } from '../data/readCompound.ts';

export interface CompoundListProps {
  /** Every compound the database holds. */
  compounds: CompoundSummary[];
  /** The one on screen. */
  selectedId: number | null;
  /** Called when another is chosen. */
  onSelect: (compound: CompoundSummary) => void;
}

/**
 * The 541 compounds, searchable, with the arrow keys moving through them.
 *
 * The search reads names, formulas and SMILES together, because someone
 * checking the harvest looks for whichever of the three they have in front of
 * them.
 * @param props - The compounds and what to do when one is picked.
 * @returns The list.
 */
export function CompoundList(props: CompoundListProps): ReactElement {
  const { compounds, selectedId, onSelect } = props;
  const [search, setSearch] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<CompoundSummary[]>([]);
  const selectedRef = useRef<number | null>(selectedId);
  const selectRef = useRef(onSelect);
  const selectedRowRef = useRef<HTMLButtonElement | null>(null);

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (needle === '') return compounds;
    return compounds.filter(
      (compound) =>
        (compound.name ?? '').toLowerCase().includes(needle) ||
        compound.formula.toLowerCase().includes(needle) ||
        compound.smiles.toLowerCase().includes(needle),
    );
  }, [compounds, search]);

  useLayoutEffect(() => {
    itemsRef.current = shown;
    selectedRef.current = selectedId;
    selectRef.current = onSelect;
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement
      ) {
        return;
      }
      const list = itemsRef.current;
      if (list.length === 0) return;
      event.preventDefault();
      const currentIndex =
        selectedRef.current === null
          ? -1
          : list.findIndex((compound) => compound.id === selectedRef.current);
      const nextIndex =
        event.key === 'ArrowDown'
          ? Math.min(currentIndex + 1, list.length - 1)
          : Math.max(currentIndex - 1, 0);
      if (nextIndex !== currentIndex) {
        selectRef.current(list[nextIndex] as CompoundSummary);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Keeping the chosen row visible is the scroller's own business: the parent
  // owns which compound is selected, but not where this list is scrolled to.
  useLayoutEffect(() => {
    selectedRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  return (
    <section className="browse__list" aria-label="Compounds">
      <InputGroup
        value={search}
        onValueChange={setSearch}
        placeholder="Name, formula or SMILES…"
        leftIcon="search"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-label="Search the compounds"
      />
      <p className="browse__count">
        {shown.length === compounds.length
          ? `${compounds.length} compounds`
          : `${shown.length} of ${compounds.length}`}
      </p>
      <div className="browse__scroll" ref={listRef}>
        {shown.map((compound) => (
          <Button
            key={compound.id}
            className="browse__entry"
            active={compound.id === selectedId}
            data-selected={compound.id === selectedId ? 'true' : undefined}
            ref={compound.id === selectedId ? selectedRowRef : undefined}
            onClick={() => onSelect(compound)}
            alignText="start"
            fill
          >
            <span className="browse__entry-name">
              {compound.name ?? compound.smiles}
            </span>
            <Tag minimal className="browse__entry-formula">
              {compound.formula}
            </Tag>
          </Button>
        ))}
      </div>
    </section>
  );
}
