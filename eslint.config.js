const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  {
    ignores: [
      'node_modules/',
      '.expo/',
      'expo-env.d.ts',
      'dist/',
      'ios/',
      'android/',
      'babel.config.js',
      'eslint.config.js',
      'jest.config.js',
      'jest.setup.js',
      'scripts/',
    ],
  },
  ...compat.config({
    parser: '@typescript-eslint/parser',
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      ecmaFeatures: { jsx: true },
    },
    env: {
      'react-native/react-native': true,
      es2022: true,
      node: true,
    },
    plugins: ['@typescript-eslint', 'react', 'react-hooks', 'react-native', 'prettier'],
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:react/recommended',
      'plugin:react-hooks/recommended',
      'plugin:react-native/all',
      'prettier',
    ],
    settings: { react: { version: 'detect' } },
    rules: {
      'prettier/prettier': 'warn',
      'react/react-in-jsx-scope': 'off',
      'react-native/no-raw-text': 'off',
      'react-native/sort-styles': 'off',
      // Dynamic, theme-driven values (threshold colours, per-sign tints) are
      // applied via inline style objects that reference palette tokens. We keep
      // `no-color-literals` ON so raw hex is still forbidden outside the theme.
      'react-native/no-inline-styles': 'off',
      // False positives on the `makeStyles(Palette) => StyleSheet.create(...)`
      // factory pattern: the plugin cannot link such styles to usages
      // (jsx-eslint/eslint-plugin-react-native#276).
      'react-native/no-unused-styles': 'off',
      // require() is legitimate in RN for assets (Metro). Whitelist is explicit —
      // any new arbitrary require() is still an error.
      '@typescript-eslint/no-require-imports': [
        'error',
        {
          allow: ['\\.(png|jpe?g|gif|webp)$', '\\./package\\.json$', '^react$', '^react-native$'],
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          // `const { [key]: _removed, ...rest } = obj` — key-removal idiom.
          ignoreRestSiblings: true,
        },
      ],
      // disallowTypeAnnotations: false — allows `as typeof import('...')`.
      '@typescript-eslint/consistent-type-imports': ['warn', { disallowTypeAnnotations: false }],
    },
  }),
  {
    // Expo config plugins and target configs are CommonJS Node scripts.
    files: ['plugins/**/*.js', 'targets/**/*.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
