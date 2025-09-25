import rateLimit from "express-rate-limit";

// ***** Generate API rate limiting
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  message: {
    error: "Too many requests from this IP, please try again after 15 minutes.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// ***** Authentication endpoints (login, register)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per `window` (here, per 15 minutes)
  message: {
    error:
      "Too many authentication attempts from this IP, please try again after 15 minutes.",
  },
});

// ***** OTP endpoints
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP to 3 requests per `window` (here, per 15 minutes)
  message: {
    error:
      "Too many OTP requests from this IP, please try again after 15 minutes.",
  },
});

// ***** Password reset
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 60 minutes
  max: 3, // Limit each IP to 3 requests per `window` (here, per 60 minutes)
  message: {
    error:
      "Too many password reset attempts from this IP, please try again after 60 minutes.",
  },
});
