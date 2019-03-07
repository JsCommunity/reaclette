import { BaseError } from "make-error";

export default class InvalidEntryError extends BaseError {
  constructor(name) {
    super(
      `"${name}" is not a valid state entry. If you want to use it, initialize it in "intialState"`
    );
  }
}
