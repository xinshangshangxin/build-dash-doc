module.exports = {
  extends: 'airbnb',
  installedESLint: true,
  plugins: [],
  globals: {
    _: false,
    Promise: false,
  },
  rules: {
    'brace-style': ['error', 'stroustrup'],
    'no-console': ['off'],
    'no-use-before-define': ['error', {
      functions: false,
    }],
    'no-param-reassign': ['error', {
      props: false,
    }],
    'prefer-const': ['off'],
  },
};