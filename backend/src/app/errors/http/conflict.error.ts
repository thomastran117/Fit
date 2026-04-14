import AppError from "./app.error";

class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 409, "CONFLICT", details);
    this.name = "ConflictError";
  }
}

export default ConflictError;
export { ConflictError };
