import { Button, Callout, Tag, TextArea } from '@blueprintjs/core';
import { useSignals } from '@preact/signals-react/runtime';
import type { ReactElement } from 'react';
import { progressSummary } from 'react-cheminfo/core';
import {
  ExerciseActions,
  ExerciseLevelTag,
  ExerciseProgressHeader,
  ExerciseStatusIcon,
} from 'react-cheminfo/ui';

import { GlossaryText } from '../components/GlossaryText.tsx';
import { QueryCode } from '../components/QueryCode.tsx';
import type { Exercise } from '../data/exercises.ts';
import { EXERCISES } from '../data/exercises.ts';
import { useDatabase } from '../data/useDatabase.ts';
import type { AnswerCheck } from '../query/checkAnswer.ts';
import { checkAnswer } from '../query/checkAnswer.ts';
import {
  attemptFor,
  attempts,
  clearAttempts,
  updateAttempt,
} from '../state/exerciseProgress.ts';
import { navigate } from '../state/index.ts';

/** Every exercise the progress bar counts against, in the order they are given. */
const EXERCISE_IDS = EXERCISES.map((exercise) => exercise.id);

/**
 * The challenges: write a query until every requirement is met.
 *
 * Requirements are checked as the student types, so the list lights up while
 * the query is being written; Check only commits the attempt. The solution is
 * always one click away — being stuck and then reading the answer is part of
 * how this is learned, not a failure to be gated.
 * @param props - The exercise the address names, if any.
 * @returns The page.
 */
export function Exercises(props: { exerciseId: string | null }): ReactElement {
  useSignals();
  const current = EXERCISES.find(
    (exercise) => exercise.id === props.exerciseId,
  );
  const summary = progressSummary(attempts.value, EXERCISE_IDS);

  return (
    <div className="exercises">
      <header className="exercises__head">
        <h1 className="page__title">Exercises</h1>
      </header>
      <ExerciseProgressHeader summary={summary} onClearAll={clearAttempts} />

      <div className="exercises__body">
        <ol className="exercises__list">
          {EXERCISES.map((exercise) => {
            const attempt = attempts.value[exercise.id];
            const status = attempt?.status ?? 'idle';
            const hintsRevealed = attempt?.hintsRevealed ?? 0;
            return (
              <li key={exercise.id}>
                <Button
                  className="exercises__entry"
                  active={exercise.id === current?.id}
                  onClick={() => navigate('exercises', exercise.id)}
                  icon={<ExerciseStatusIcon status={status} />}
                  intent={status === 'solved' ? 'success' : 'none'}
                  alignText="start"
                  fill
                >
                  <span className="exercises__entry-title">
                    {exercise.title}
                  </span>
                  <span className="exercises__entry-tags">
                    <ExerciseLevelTag level={exercise.level} />
                    <Tag minimal>{exercise.language}</Tag>
                    {status === 'solved' && hintsRevealed > 0 ? (
                      <Tag minimal>
                        {hintsRevealed} hint{hintsRevealed === 1 ? '' : 's'}
                      </Tag>
                    ) : null}
                  </span>
                </Button>
              </li>
            );
          })}
        </ol>

        {current ? (
          <ExerciseCard exercise={current} />
        ) : (
          <Callout className="exercises__pick">
            Pick an exercise to start.
          </Callout>
        )}
      </div>
    </div>
  );
}

function ExerciseCard({ exercise }: { exercise: Exercise }): ReactElement {
  useSignals();
  const database = useDatabase();
  const attempt = attemptFor(exercise.id);
  const query = attempt.answer || exercise.starter || '';

  const check: AnswerCheck | null =
    database.state === 'ready' && query.trim() !== ''
      ? checkAnswer(exercise, query, {
          database: database.database.database,
          documents: database.documents,
        })
      : null;

  function commit(): void {
    if (!check) return;
    updateAttempt(exercise.id, {
      status: check.passed ? 'solved' : 'attempted',
    });
  }

  return (
    <article className="exercise">
      <header>
        <h2 className="exercise__title">{exercise.title}</h2>
        <p className="exercise__description">
          <GlossaryText>{exercise.description}</GlossaryText>
        </p>
      </header>

      <TextArea
        className="exercise__editor"
        value={query}
        onChange={(event) =>
          updateAttempt(exercise.id, { answer: event.currentTarget.value })
        }
        placeholder={
          exercise.language === 'mango'
            ? 'Write a Mango query, as JSON…'
            : 'Write a SELECT…'
        }
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        aria-label={`Answer for ${exercise.title}`}
        fill
      />

      <ExerciseActions
        className="exercise__actions"
        onCheck={commit}
        checkDisabled={!check}
        hintsRevealed={attempt.hintsRevealed}
        hintCount={exercise.hints.length}
        onRevealHint={() =>
          updateAttempt(exercise.id, {
            hintsRevealed: attempt.hintsRevealed + 1,
          })
        }
        showSolution={attempt.showSolution}
        onToggleSolution={() =>
          updateAttempt(exercise.id, { showSolution: !attempt.showSolution })
        }
        onReset={() =>
          updateAttempt(exercise.id, {
            answer: '',
            status: 'idle',
            hintsRevealed: 0,
            showSolution: false,
          })
        }
      />

      {exercise.hints.slice(0, attempt.hintsRevealed).map((hint, index) => (
        <Callout key={hint} intent="primary" className="exercise__hint">
          {index + 1}. <GlossaryText>{hint}</GlossaryText>
        </Callout>
      ))}

      {check?.error ? (
        <Callout intent="danger" className="exercise__error">
          {check.error}
        </Callout>
      ) : null}

      {check && !check.error ? (
        <ul className="exercise__cases">
          {check.cases.map((item) => (
            <li
              key={item.description}
              className={item.passed ? 'is-pass' : 'is-fail'}
            >
              <span className="exercise__case-mark">
                {item.passed ? '✓' : '✗'}
              </span>
              <span>{item.description}</span>
              <span className="exercise__case-reason">{item.reason}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {check?.passed ? (
        <Callout intent="success" className="exercise__done">
          Every requirement is met.
        </Callout>
      ) : null}

      {attempt.showSolution ? (
        <div className="exercise__solution">
          <h3>One answer</h3>
          <QueryCode code={exercise.solution} language="sql" />
          {exercise.mangoSolution ? (
            <>
              <h3>The same, in Mango</h3>
              <QueryCode code={exercise.mangoSolution} language="mango" />
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
