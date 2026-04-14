import AppError from "./app.error";

class GoneError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 410, "GONE", details);
    this.name = "GoneError";
  }
}

export default GoneError;
export { GoneError };
