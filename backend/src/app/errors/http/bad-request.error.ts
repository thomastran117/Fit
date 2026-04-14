import AppError from "./app.error";

class BadRequestError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "BAD_REQUEST", details);
    this.name = "BadRequestError";
  }
}

export default BadRequestError;
export { BadRequestError };
