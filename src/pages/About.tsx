import type { ReactElement } from 'react';
import { AboutPage } from 'react-cheminfo/ui';

import { ABOUT } from '../about.ts';

/**
 * The About page of the site: the shared page, drawn from this site's record.
 * @returns The page.
 */
export function About(): ReactElement {
  return <AboutPage content={ABOUT} />;
}
