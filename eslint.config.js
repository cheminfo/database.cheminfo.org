import { defineConfig, globalIgnores } from 'eslint/config';
import { globals } from 'eslint-config-zakodium';
import react from 'eslint-config-zakodium/react';
import ts from 'eslint-config-zakodium/ts';
import unicorn from 'eslint-config-zakodium/unicorn';

export default defineConfig(
  globalIgnores([
    '.claude',
    'coverage',
    'dist',
    // The harvest pipeline that fills data/ and builds public/chem.sqlite. It
    // is plain Node, has its own node_modules, and is not part of the site.
    'scripts',
    // Outside every tsconfig, so the type-aware rules cannot parse them.
    'e2e',
    'playwright.config.ts',
    'playwright-report',
    'test-results',
  ]),
  ts,
  unicorn,
  react,
  {
    files: ['vite.config.ts', 'vitest.config.ts'],
    languageOptions: { globals: { ...globals.nodeBuiltin } },
  },
  {
    files: ['src/**/*.tsx'],
    extends: [react],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@blueprintjs/core',
              importNames: ['Popover'],
              message:
                'Blueprint’s legacy Popover does not position itself under React 19: use PopoverNext.',
            },
          ],
        },
      ],
    },
  },
);
