import express from "express";
import compression from "compression";
import cookieParser from "cookie-parser";
import e from "express";

const basicExpressConfig = (app) => {
  // Body parsing middleware
  app.use(express.json({ limit: "10mb" })); // Limit body to 10mb
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Cookie parsing
  app.use(cookieParser());

  // Compression middleware to reduce response sizes
  app.use(compression());

  // Health check route
  app.get("api/health", (req, res) => {
    res.json({
      message: "Server is running",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
    });
  });
};

export default basicExpressConfig;
