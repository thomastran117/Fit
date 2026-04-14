import AppError from "./app.error";

class ServiceNotAvaliableError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 503, "SERVICE_NOT_AVALIABLE", details);
    this.name = "ServiceNotAvaliableError";
  }
}

export default ServiceNotAvaliableError;
export { ServiceNotAvaliableError };
