export class AuthError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'AuthError';
  }
}

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends Error {
  constructor(retryAfter = 60) {
    super('Too many requests');
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}
