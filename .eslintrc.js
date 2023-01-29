module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.json'],
  },
  plugins: ['@typescript-eslint'],
  extends: ['airbnb-typescript/base', 'prettier'],
  rules: {
    'import/named': 0,
    'no-underscore-dangle': 0,
    'import/extensions': 0,
    'import/no-extraneous-dependencies': 0,
  },
};
