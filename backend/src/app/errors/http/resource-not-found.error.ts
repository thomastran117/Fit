import AppError from "./app.error";

class ResourceNotFoundError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 404, "RESOURCE_NOT_FOUND", details);
    this.name = "ResourceNotFoundError";
  }
}

export default ResourceNotFoundError;
export { ResourceNotFoundError };
