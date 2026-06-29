export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(msg = 'Unauthorized') {
    super(msg, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(msg = 'Forbidden') {
    super(msg, 403, 'FORBIDDEN');
  }
}

export class ValidationError extends AppError {
  constructor(msg: string) {
    super(msg, 400, 'VALIDATION_ERROR');
  }
}

export class ConflictError extends AppError {
  constructor(msg: string) {
    super(msg, 409, 'CONFLICT');
  }
}
