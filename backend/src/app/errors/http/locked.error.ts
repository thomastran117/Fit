import AppError from "./app.error";

class LockedError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 423, "ACCOUNT_LOCKED", details);
    this.name = "LockedError";
  }
}

export default LockedError;
export { LockedError };
