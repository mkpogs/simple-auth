import "./configs/dotenv.config.js";
import express from "express";
import expressSetupMiddleware from "./configs/index.config.js";
import {
  notFoundHandler,
  globalErrorHandler,
} from "./middlewares/errorHandler.middleware.js";

const app = express();

// Setup all middleware configurations
expressSetupMiddleware(app);

// Mounting all Routes
// app.use("/api", allRoutes); // We'll uncomment this when we have routes

// Handle 404 errors
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(globalErrorHandler);

export default app;
