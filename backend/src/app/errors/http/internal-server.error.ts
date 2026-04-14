import AppError from "./app.error";

class InternalServerError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 500, "INTERNAL_SERVER_ERROR", details);
    this.name = "InternalServerError";
  }
}

export default InternalServerError;
export { InternalServerError };
