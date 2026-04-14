import AppError from "./app.error";

class UnsupportedMediaTypeError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 415, "UNSUPPORTED_MEDIA_TYPE", details);
    this.name = "UnsupportedMediaTypeError";
  }
}

export default UnsupportedMediaTypeError;
export { UnsupportedMediaTypeError };
