module.exports = {
  env: {
    commonjs: true,
    es2021: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
    'plugin:import/typescript',
    'plugin:@typescript-eslint/recommended',
    'prettier'
  ],
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    "@typescript-eslint/no-explicit-any": ['off'],
    "@typescript-eslint/no-var-requires": ['off']
  }
};
