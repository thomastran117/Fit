import AppError from "./app.error";

class TooManyRequestError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 429, "TOO_MANY_REQUESTS", details);
    this.name = "TooManyRequestError";
  }
}

export default TooManyRequestError;
export { TooManyRequestError };
