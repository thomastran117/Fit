import AppError from "./app.error";

class ForbiddenError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 403, "FORBIDDEN", details);
    this.name = "ForbiddenError";
  }
}

export default ForbiddenError;
export { ForbiddenError };
