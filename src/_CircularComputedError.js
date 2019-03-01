import { BaseError } from 'make-error'

export default class CircularComputedError extends BaseError {
  constructor (name) {
    super(`computed "${name}" cannot depend on itself`)
  }
}
