import mongoSanitize from "express-mongo-sanitize";
import xss from "xss";
import hpp from "hpp";

// MongoDB Injection Prevention
export const mongoSanitizeConfig = mongoSanitize();

// XSS Protection
export const xssProtection = (req, res, next) => {
  if (req.body) {
    for (let key in req.body) {
      if (typeof req.body[key] === "string") {
        req.body[key] = xss(req.body[key]);
      }
    }
  }
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
