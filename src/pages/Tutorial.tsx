import { Button, Callout } from '@blueprintjs/core';
import { useSignals } from '@preact/signals-react/runtime';
import type { ReactElement } from 'react';

import { GlossaryText } from '../components/GlossaryText.tsx';
import type { TutorialStep } from '../data/tutorialSteps.ts';
import { TUTORIAL_LEVELS, TUTORIAL_STEPS } from '../data/tutorialSteps.ts';
import { navigate } from '../state/index.ts';
import { loadQueries } from '../state/queries.ts';

/**
 * The guided tour: eighteen preloaded questions, each asked twice.
 *
 * A step is not a slide. Opening one loads both editors and sends the visitor
 * to the playground, where every value is theirs to change — the tour teaches
 * by handing over a working query, not by describing one.
 * @param props - The step the address names, if any.
 * @returns The page.
 */
export function Tutorial(props: { step: string | null }): ReactElement {
  useSignals();
  const current = TUTORIAL_STEPS.find((step) => step.id === props.step);

  return (
    <div className="tutorial">
      <header>
        <h1 className="page__title">Querying chemistry, step by step</h1>
        <p className="page__lead">
          Each step opens both editors on the same question. Change anything you
          like — nothing here can be broken.
        </p>
      </header>

      {TUTORIAL_LEVELS.map((level) => {
        const steps = TUTORIAL_STEPS.filter(
          (step) => step.level === level.level,
        );
        const offset = TUTORIAL_STEPS.indexOf(steps[0] as TutorialStep);
        return (
          <section
            key={level.level}
            className={`tutorial__strip tutorial__strip--${level.level}`}
          >
            <div className="tutorial__strip-head">
              <h2 className="tutorial__strip-title">{level.label}</h2>
              <p className="tutorial__strip-blurb">{level.blurb}</p>
            </div>
            <ol className="tutorial__numbers">
              {steps.map((step, index) => (
                <li key={step.id}>
                  <Button
                    className="tutorial__number"
                    active={step.id === current?.id}
                    onClick={() => navigate('tutorial', step.id)}
                    title={step.title}
                  >
                    {offset + index + 1}
                  </Button>
                </li>
              ))}
            </ol>
          </section>
        );
      })}

      {current ? <StepDetail step={current} /> : null}
    </div>
  );
}

function StepDetail({ step }: { step: TutorialStep }): ReactElement {
  const index = TUTORIAL_STEPS.indexOf(step);
  const previous = TUTORIAL_STEPS[index - 1];
  const next = TUTORIAL_STEPS[index + 1];

  function open(): void {
    loadQueries({ sql: step.sql, mango: step.mango });
    navigate('playground');
  }

  return (
    <article className={`tutorial__step tutorial__step--${step.level}`}>
      <h2 className="tutorial__step-title">
        {index + 1}. {step.title}
      </h2>
      <p className="tutorial__step-description">
        <GlossaryText>{step.description}</GlossaryText>
      </p>

      <div className="tutorial__queries">
        <div className="tutorial__query">
          <h3>SQL</h3>
          <pre>{step.sql}</pre>
        </div>
        <div className="tutorial__query">
          <h3>Mango</h3>
          {step.mango ? (
            <pre>{step.mango}</pre>
          ) : (
            <Callout intent="warning" className="tutorial__gap">
              {step.mangoNote}
            </Callout>
          )}
        </div>
      </div>

      <div className="tutorial__pager">
        <Button
          disabled={!previous}
          onClick={() => previous && navigate('tutorial', previous.id)}
          text="Previous"
        />
        <Button intent="primary" onClick={open} text="Open in the playground" />
        <Button
          disabled={!next}
          onClick={() => next && navigate('tutorial', next.id)}
          text="Next"
        />
      </div>
    </article>
  );
}
