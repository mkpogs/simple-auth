import express from "express";
import compression from "compression";
import cookieParser from "cookie-parser";

const basicExpressConfig = (app) => {
  // Body parsing middleware
  app.use(express.json({ limit: "10mb" })); // Limit body to 10mb
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Cookie parsing
  app.use(cookieParser());

  // Compression middleware to reduce response sizes
  app.use(compression());

  // NOTE: Health check route is now in index.routes.js, not here
  // This keeps middleware and routes separated properly
};

export default basicExpressConfig;
