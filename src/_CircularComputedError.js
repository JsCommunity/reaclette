const { BaseError } = require("make-error");

module.exports = class CircularComputedError extends BaseError {
  constructor(name) {
    super(`computed "${name}" cannot depend on itself`);
  }
};
