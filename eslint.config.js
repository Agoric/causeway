import globals from 'globals';
import pluginJs from '@eslint/js';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  pluginJs.configs.recommended,
  {
    ignores: [
      'node_modules/',
      '.git/',
      'uploads/',
      'public/scripts/lockdown.js',
      'public/scripts/ses.umd.min.js',
      'lockdown.js',
    ],
  },
];
