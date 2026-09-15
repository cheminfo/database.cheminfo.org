import type { ReactElement } from 'react';
import { onActivateKey } from 'react-cheminfo/ui';

const WORDS = 16;
const BITS_PER_WORD = 32;
const CELL = 14;
const GAP = 2;
const LABEL_WIDTH = 62;

export interface IndexGridProps {
  /** The bits the index sets. */
  bits: ReadonlySet<number>;
  /** The bit whose key fragment is being shown, if any. */
  selected: number | null;
  /** Called with a set bit the reader picks. */
  onSelect: (bit: number) => void;
}

/**
 * The 512 bits of a substructure index, one row per word the table stores.
 *
 * Row `index00` holds bits 0 to 31 from left to right, which is also how the
 * words are written: bit 0 is the high bit of `index00`. A filled cell is a key
 * fragment the structure contains, and picking one shows which.
 * @param props - The bits, the selection and what picking does.
 * @returns The grid.
 */
export function IndexGrid(props: IndexGridProps): ReactElement {
  const { bits, selected, onSelect } = props;
  const pitch = CELL + GAP;
  const width = LABEL_WIDTH + BITS_PER_WORD * pitch - GAP;
  const height = WORDS * pitch - GAP;

  const labels: ReactElement[] = [];
  for (let word = 0; word < WORDS; word++) {
    labels.push(
      <text
        key={word}
        className="index-grid__label"
        x={LABEL_WIDTH - 8}
        y={word * pitch + CELL - 3}
        textAnchor="end"
      >
        {wordName(word)}
      </text>,
    );
  }

  const cells: ReactElement[] = [];
  for (let bit = 0; bit < WORDS * BITS_PER_WORD; bit++) {
    const word = bit >> 5;
    const offset = bit & 31;
    const isSet = bits.has(bit);
    let className = 'index-grid__cell';
    if (isSet) className += ' index-grid__cell--on';
    if (bit === selected) className += ' index-grid__cell--selected';
    const select = () => {
      onSelect(bit);
    };
    cells.push(
      <rect
        key={bit}
        className={className}
        x={LABEL_WIDTH + offset * pitch}
        y={word * pitch}
        width={CELL}
        height={CELL}
        rx={2}
        role={isSet ? 'button' : undefined}
        tabIndex={isSet ? 0 : undefined}
        aria-label={isSet ? `Bit ${bit}` : undefined}
        aria-pressed={isSet ? bit === selected : undefined}
        onClick={isSet ? select : undefined}
        onKeyDown={isSet ? onActivateKey(select) : undefined}
      >
        <title>
          {`bit ${bit}: ${wordName(word)} & ${(1 << (31 - offset)) >>> 0}${isSet ? '' : ', not set'}`}
        </title>
      </rect>,
    );
  }

  return (
    <svg
      className="index-grid"
      viewBox={`0 0 ${width} ${height}`}
      aria-label={`${bits.size} of ${WORDS * BITS_PER_WORD} index bits set`}
    >
      {labels}
      {cells}
    </svg>
  );
}

function wordName(word: number): string {
  return `index${String(word).padStart(2, '0')}`;
}
