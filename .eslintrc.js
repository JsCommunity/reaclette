module.exports = {
  extends: [
    // standard configuration
    "standard",

    // https://github.com/mysticatea/eslint-plugin-node#-rules
    "plugin:node/recommended",

    // disable rules handled by prettier
    "prettier",
    "prettier/standard",
  ],

  parser: "babel-eslint",
  parserOptions: {
    sourceType: "module",
  },

  rules: {
    // uncomment if you are using a builder like Babel
    "node/no-unsupported-features/es-syntax": "off",
  },
};
