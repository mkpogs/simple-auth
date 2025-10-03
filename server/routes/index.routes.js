import express from "express";
import authRoutes from "./auth.routes.js";

const router = express.Router();

// ===== CENTRALIZED ROUTES =====

// Health check route
router.get("health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running perfectly! 🚀",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Routes
router.use("/auth", authRoutes);

// API info route
router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Simple Auth API v1.0",
    documentation: "https://your-docs-url.com",
    endpoints: {
      health: "GET /api/health",
      auth: {
        register: "POST /api/auth/register",
        verifyOTP: "POST /api/auth/verify-otp",
        resendOTP: "POST /api/auth/resend-otp",
      },
    },
  });
});

export default router;
