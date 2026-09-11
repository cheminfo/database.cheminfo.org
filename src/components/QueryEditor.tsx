import { Button, TextArea } from '@blueprintjs/core';
import type { KeyboardEvent, ReactElement } from 'react';

export interface QueryEditorProps {
  /** Which language this pane speaks. */
  language: 'sql' | 'mango';
  /** The heading shown above the box. */
  title: string;
  /** The query as typed. */
  value: string;
  /** Called on every keystroke. */
  onChange: (value: string) => void;
  /** Called when the visitor asks for the query to run. */
  onRun: () => void;
  /** Whether the query is running right now. */
  busy?: boolean;
  /** Extra controls placed beside the Run button. */
  children?: ReactElement | null;
}

/**
 * One half of the playground: a query, and the button that runs it.
 *
 * Cmd/Ctrl+Enter runs it too, because that is what every SQL client does and
 * a student should not have to learn a second habit here.
 * @param props - The pane's contents and callbacks.
 * @returns The editor pane.
 */
export function QueryEditor(props: QueryEditorProps): ReactElement {
  const {
    language,
    title,
    value,
    onChange,
    onRun,
    busy = false,
    children = null,
  } = props;

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onRun();
    }
  }

  return (
    <section className="query-editor" aria-label={title}>
      <header className="query-editor__head">
        <h2 className="query-editor__title">{title}</h2>
        <div className="query-editor__actions">
          {children}
          <Button
            intent="primary"
            onClick={onRun}
            loading={busy}
            text="Run"
            title="Run this query (Cmd/Ctrl + Enter)"
          />
        </div>
      </header>
      <TextArea
        className="query-editor__input"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        aria-label={language === 'sql' ? 'SQL query' : 'Mango query'}
        fill
      />
    </section>
  );
}
