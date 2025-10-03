// import mongoSanitize from "express-mongo-sanitize"; // Commented out due to compatibility issues
import hpp from "hpp";

// MongoDB Injection Prevention - Simple and Safe Implementation
export const mongoSanitizeConfig = (req, res, next) => {
  try {
    // Only sanitize request body to avoid read-only property issues
    if (req.body && typeof req.body === "object") {
      // Simple recursion to remove MongoDB operators
      const sanitizeBody = (obj) => {
        if (obj && typeof obj === "object" && !Array.isArray(obj)) {
          const sanitized = {};
          for (const key in obj) {
            if (!key.startsWith("$") && !key.includes(".")) {
              if (
                typeof obj[key] === "object" &&
                obj[key] !== null &&
                !Array.isArray(obj[key])
              ) {
                sanitized[key] = sanitizeBody(obj[key]);
              } else {
                sanitized[key] = obj[key];
              }
            }
          }
          return sanitized;
        }
        return obj;
      };

      req.body = sanitizeBody(req.body);
    }

    next();
  } catch (error) {
    console.error("MongoDB sanitization error:", error);
    next(); // Continue even if sanitization fails
  }
};

// XSS Protection - Custom Implementation
export const xssProtection = (req, res, next) => {
  const sanitizeString = (str) => {
    if (typeof str === "string") {
      // Basic XSS protection - remove dangerous characters and patterns
      return str
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;")
        .replace(/\//g, "&#x2F;")
        .replace(/javascript:/gi, "")
        .replace(/on\w+=/gi, "")
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
    }
    return str;
  };

  const sanitizeObject = (obj) => {
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      for (const key in obj) {
        if (typeof obj[key] === "object" && obj[key] !== null) {
          sanitizeObject(obj[key]);
        } else {
          obj[key] = sanitizeString(obj[key]);
        }
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        if (typeof item === "object") {
          sanitizeObject(item);
        } else {
          obj[index] = sanitizeString(item);
        }
      });
    }
  };

  // Sanitize request parts (only body to avoid read-only property issues)
  if (req.body) sanitizeObject(req.body);

  next();
};

// HTTP Parameter Pollution Prevention
export const hppConfig = hpp({
  whitelist: [
    // allow arrays for these parameters
    "sort",
    "fields",
    "page",
    "limit",
  ],
});
