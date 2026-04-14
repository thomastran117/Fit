import AppError from "./app.error";

class BadGatewayError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 502, "BAD_GATEWAY", details);
    this.name = "BadGatewayError";
  }
}

export default BadGatewayError;
export { BadGatewayError };
