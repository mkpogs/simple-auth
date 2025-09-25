import { helmetConfig } from "./helmet.config.js";
import corsConfig from "./cors.config.js";
import { generalLimiter } from "./rateLimit.config.js";
import {
  mongoSanitizeConfig,
  xssProtection,
  hppConfig,
} from "./security.config.js";
import basicExpressConfig from "./express.config.js";

const expressSetupMiddleware = (app) => {
  // Security Middlewares (order matters!)
  app.use(helmetConfig);
  app.use(corsConfig);
  app.use(mongoSanitizeConfig);
  app.use(xssProtection);
  app.use(hppConfig);

  //   Basic Express Configurations
  basicExpressConfig(app);

  //   Rate Limiting (Apply to API routes)
  app.use("/api/", generalLimiter);
};

export default expressSetupMiddleware;
