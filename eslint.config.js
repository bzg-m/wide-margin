import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
    // vue-tsc already reports undefined names, and this rule doesn't know browser or TypeScript
    // globals. typescript-eslint turns it off for .ts files; this does the same for .vue files.
    rules: { 'no-undef': 'off' },
  },
  {
    rules: {
      // Allows `const { omitted, ...rest } = object`, the usual way to copy an object without a field.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  prettier,
);
