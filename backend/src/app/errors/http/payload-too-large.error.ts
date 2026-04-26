import AppError from "./app.error";

class PayloadTooLargeError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 413, "PAYLOAD_TOO_LARGE", details);
    this.name = "PayloadTooLargeError";
  }
}

export default PayloadTooLargeError;
export { PayloadTooLargeError };
