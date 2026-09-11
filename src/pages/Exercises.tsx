import {
  Alert,
  Button,
  Callout,
  ProgressBar,
  Tag,
  TextArea,
} from '@blueprintjs/core';
import { useSignals } from '@preact/signals-react/runtime';
import type { ReactElement } from 'react';
import { useState } from 'react';

import { GlossaryText } from '../components/GlossaryText.tsx';
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

const LEVEL_INTENT = {
  beginner: 'success',
  intermediate: 'warning',
  advanced: 'danger',
} as const;

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
  const [clearing, setClearing] = useState(false);
  const current = EXERCISES.find(
    (exercise) => exercise.id === props.exerciseId,
  );
  const solved = EXERCISES.filter(
    (exercise) => attempts.value[exercise.id]?.status === 'solved',
  ).length;

  return (
    <div className="exercises">
      <header className="exercises__head">
        <div>
          <h1 className="page__title">Exercises</h1>
          <p className="page__lead">
            {solved} of {EXERCISES.length} solved
          </p>
        </div>
        <Button
          variant="minimal"
          intent="danger"
          text="Clear all answers"
          onClick={() => setClearing(true)}
        />
      </header>
      <ProgressBar
        value={solved / EXERCISES.length}
        intent="primary"
        stripes={false}
      />

      <div className="exercises__body">
        <ol className="exercises__list">
          {EXERCISES.map((exercise) => {
            const attempt = attempts.value[exercise.id];
            return (
              <li key={exercise.id}>
                <Button
                  className="exercises__entry"
                  active={exercise.id === current?.id}
                  onClick={() => navigate('exercises', exercise.id)}
                  icon={
                    attempt?.status === 'solved'
                      ? 'tick-circle'
                      : attempt?.status === 'attempted'
                        ? 'warning-sign'
                        : 'circle'
                  }
                  intent={attempt?.status === 'solved' ? 'success' : 'none'}
                  alignText="start"
                  fill
                >
                  <span className="exercises__entry-title">
                    {exercise.title}
                  </span>
                  <Tag minimal intent={LEVEL_INTENT[exercise.level]}>
                    {exercise.level}
                  </Tag>
                  <Tag minimal>{exercise.language}</Tag>
                  {attempt?.status === 'solved' && attempt.hintsRevealed > 0 ? (
                    <Tag minimal>
                      {attempt.hintsRevealed} hint
                      {attempt.hintsRevealed === 1 ? '' : 's'}
                    </Tag>
                  ) : null}
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

      <Alert
        isOpen={clearing}
        intent="danger"
        confirmButtonText="Clear everything"
        cancelButtonText="Keep them"
        onConfirm={() => {
          clearAttempts();
          setClearing(false);
        }}
        onCancel={() => setClearing(false)}
      >
        Every answer and every revealed hint is forgotten. This cannot be
        undone.
      </Alert>
    </div>
  );
}

function ExerciseCard({ exercise }: { exercise: Exercise }): ReactElement {
  useSignals();
  const database = useDatabase();
  const attempt = attemptFor(exercise.id);
  const query = attempt.query || exercise.starter || '';

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
          updateAttempt(exercise.id, { query: event.currentTarget.value })
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

      <div className="exercise__actions">
        <Button
          intent="primary"
          text="Check"
          onClick={commit}
          disabled={!check}
        />
        <Button
          text={`Reveal hint (${attempt.hintsRevealed}/${exercise.hints.length})`}
          disabled={attempt.hintsRevealed >= exercise.hints.length}
          onClick={() =>
            updateAttempt(exercise.id, {
              hintsRevealed: attempt.hintsRevealed + 1,
            })
          }
        />
        <Button
          text={attempt.showSolution ? 'Hide solution' : 'Reveal solution'}
          onClick={() =>
            updateAttempt(exercise.id, { showSolution: !attempt.showSolution })
          }
        />
        <Button
          variant="minimal"
          text="Reset"
          onClick={() =>
            updateAttempt(exercise.id, {
              query: '',
              status: 'idle',
              hintsRevealed: 0,
              showSolution: false,
            })
          }
        />
      </div>

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
          <pre>{exercise.solution}</pre>
          {exercise.mangoSolution ? (
            <>
              <h3>The same, in Mango</h3>
              <pre>{exercise.mangoSolution}</pre>
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
