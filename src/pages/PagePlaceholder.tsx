import type { ReactElement, ReactNode } from 'react';

export interface PagePlaceholderProps {
  /** The heading the page carries, which is the route's own title. */
  title: string;
  /** One line saying what will be here. */
  children: ReactNode;
}

/**
 * The body of a page that is routed, indexed and reachable but not written
 * yet: its heading and one line saying what it will hold.
 * @param props - The heading and the line under it.
 * @returns The page body.
 */
export function PagePlaceholder(props: PagePlaceholderProps): ReactElement {
  const { title, children } = props;

  return (
    <section className="page">
      <h1 className="page__title">{title}</h1>
      <p className="page__lead">{children}</p>
    </section>
  );
}
