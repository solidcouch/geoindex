import { ErrorObject } from 'ajv/dist/2020.js'

export class HttpError extends Error {
  public status: number
  public response: Response

  constructor(message: string, response: Response) {
    super(message)
    this.name = 'HttpError'
    this.status = response.status
    this.response = response

    // Set the prototype explicitly to maintain correct instance type
    Object.setPrototypeOf(this, HttpError.prototype)
  }
}

export class ValidationError extends Error {
  public errors: ErrorObject | unknown[]

  constructor(message: string, errors: ErrorObject | unknown[]) {
    super(message)
    this.name = 'ValidationError'
    this.errors = errors

    // Set the prototype explicitly to maintain correct instance type
    Object.setPrototypeOf(this, ValidationError.prototype)
  }
}
