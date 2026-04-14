import AppError from "./app.error";

class MethodNotAllowedError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 405, "METHOD_NOT_ALLOWED", details);
    this.name = "MethodNotAllowedError";
  }
}

export default MethodNotAllowedError;
export { MethodNotAllowedError };
