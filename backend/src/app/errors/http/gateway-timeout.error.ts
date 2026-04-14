import AppError from "./app.error";

class GatewayTimeoutError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "GATEWAY_TIMEOUT", details);
    this.name = "GatewayTimeoutError";
  }
}

export default GatewayTimeoutError;
export { GatewayTimeoutError };
