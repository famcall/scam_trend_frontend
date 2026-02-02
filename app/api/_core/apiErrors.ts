export type ApiErrorCode =
  | "INVALID_API_KEY"
  | "API_KEY_NOT_USABLE"
  | "INSUFFICIENT_SCOPE"
  | "RATE_LIMIT_EXCEEDED"
  | "DAILY_QUOTA_EXCEEDED"
  | "BAD_REQUEST"
  | "INTERNAL_ERROR";

export const ApiErrorMap: Record<
  ApiErrorCode,
  { status: number; message: string }
> = {
  INVALID_API_KEY: {
    status: 401,
    message: "Invalid API key",
  },
  API_KEY_NOT_USABLE: {
    status: 403,
    message: "API key is disabled or expired",
  },
  INSUFFICIENT_SCOPE: {
    status: 403,
    message: "Insufficient API scope",
  },
  RATE_LIMIT_EXCEEDED: {
    status: 429,
    message: "Rate limit exceeded",
  },
  DAILY_QUOTA_EXCEEDED: {
    status: 429,
    message: "Daily quota exceeded",
  },
  BAD_REQUEST: {
    status: 400,
    message: "Bad request",
  },
  INTERNAL_ERROR: {
    status: 500,
    message: "Internal server error",
  },
};