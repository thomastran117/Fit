import AppError from "./app.error";

class UnprocessableEntityError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 422, "UNPROCESSABLE_ENTITY", details);
    this.name = "UnprocessableEntityError";
  }
}

export default UnprocessableEntityError;
export { UnprocessableEntityError };
