/**
 * What one link to this site can say beyond the query it carries.
 *
 * `?embed` drops the chrome so the page can be framed in a course; `?hide=`
 * switches parts off by name; `?rows=` caps the result table. This module is
 * the only place that knows those names — a component asks `isHidden(key)` and
 * never reads the address itself — and the one number a link carries is clamped
 * here, because a shared link is untrusted input.
 */

import type {
  ShareConfig,
  ShareParamCodec,
  ShareVocabulary,
} from 'react-cheminfo/core';
import { integerParam } from 'react-cheminfo/core';

/** Rows the result table shows when a link asks for no other number. */
export const DEFAULT_ROWS = 50;

/** The most rows a link may ask for, so a link cannot hang the page. */
export const MAX_ROWS = 500;

/**
 * The vocabulary of this site's links: the parts an embedder can switch off,
 * and the one number they can preset.
 *
 * Each part is named positively — the dialog shows a ticked box for a part that
 * stays visible — and its description says what switching it off does, for the
 * person building the link rather than for the visitor.
 */
export const SHARE_VOCABULARY = {
  parts: [
    {
      key: 'sql',
      label: 'SQL editor',
      description:
        'Hiding it leaves the Mango side alone, for a lesson about one language.',
    },
    {
      key: 'mango',
      label: 'Mango editor',
      description:
        'Hiding it leaves the SQL side alone; the query the link carries still runs.',
    },
    {
      key: 'schema',
      label: 'Table list',
      description:
        'Hiding it removes the tables and columns listed beside the editors.',
    },
    {
      key: 'examples',
      label: 'Example queries',
      description:
        'Hiding it removes the ready-made queries under the editors.',
      // Inside a host page these repeat what the course itself is asking.
      hiddenByDefault: true,
    },
    {
      key: 'solutions',
      label: 'Exercise solutions',
      description:
        'Hiding it removes the Reveal solution button; the hints stay.',
    },
    {
      key: 'download',
      label: 'Result download',
      description: 'Hiding it removes the CSV download under the result table.',
    },
  ],
  params: {
    rows: integerParam({ min: 1, max: MAX_ROWS, default: DEFAULT_ROWS }),
  },
} as const satisfies ShareVocabulary<{ rows: ShareParamCodec<number> }>;

/** The parts a link can switch off, as `?hide=` names them. */
export type HideKey = (typeof SHARE_VOCABULARY)['parts'][number]['key'];

/** The configuration one link carries, once every value has been clamped. */
export type DatabaseShareConfig = ShareConfig<
  (typeof SHARE_VOCABULARY)['params']
>;
