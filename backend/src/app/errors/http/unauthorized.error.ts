import AppError from "./app.error";

class UnauthorizedError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 401, "UNAUTHORIZED", details);
    this.name = "UnauthorizedError";
  }
}

export default UnauthorizedError;
export { UnauthorizedError };
