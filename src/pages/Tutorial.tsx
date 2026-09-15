import { Button, Callout } from '@blueprintjs/core';
import { useSignals } from '@preact/signals-react/runtime';
import type { ReactElement } from 'react';
import { TutorialStepStrip } from 'react-cheminfo/ui';

import { GlossaryText } from '../components/GlossaryText.tsx';
import { QueryCode } from '../components/QueryCode.tsx';
import type { TutorialStep } from '../data/tutorialSteps.ts';
import {
  TUTORIAL_LEVEL_LABELS,
  TUTORIAL_STEPS,
} from '../data/tutorialSteps.ts';
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
  const named = TUTORIAL_STEPS.findIndex((step) => step.id === props.step);
  const index = Math.max(named, 0);
  const current = TUTORIAL_STEPS[index] as TutorialStep;

  function goToStep(position: number): void {
    const target = TUTORIAL_STEPS[position];
    if (target) navigate('tutorial', target.id);
  }

  return (
    <div className="tutorial">
      <header>
        <h1 className="page__title">Querying chemistry, step by step</h1>
        <p className="page__lead">
          Each step opens both editors on the same question. Change anything you
          like — nothing here can be broken.
        </p>
      </header>

      <TutorialStepStrip
        className="no-print"
        steps={TUTORIAL_STEPS}
        activeIndex={index}
        onSelect={goToStep}
        levelLabels={TUTORIAL_LEVEL_LABELS}
      />

      <StepDetail step={current} position={index + 1} />
    </div>
  );
}

function StepDetail(props: {
  step: TutorialStep;
  position: number;
}): ReactElement {
  const { step, position } = props;

  function open(): void {
    loadQueries({ sql: step.sql, mango: step.mango });
    navigate('playground');
  }

  return (
    <article className={`tutorial__step tutorial__step--${step.level}`}>
      <h2 className="tutorial__step-title">
        {position}. {step.title}
      </h2>
      <p className="tutorial__step-description">
        <GlossaryText>{step.description}</GlossaryText>
      </p>

      <div className="tutorial__queries">
        <div className="tutorial__query">
          <h3>SQL</h3>
          <QueryCode code={step.sql} language="sql" />
        </div>
        <div className="tutorial__query">
          <h3>Mango</h3>
          {step.mango ? (
            <QueryCode code={step.mango} language="mango" />
          ) : (
            <Callout intent="warning" className="tutorial__gap">
              {step.mangoNote}
            </Callout>
          )}
        </div>
      </div>

      <div>
        <Button intent="primary" onClick={open} text="Open in the playground" />
      </div>
    </article>
  );
}
