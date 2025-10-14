import express from "express";
import authRoutes from "./auth.routes.js";
import userRoutes from "./user.routes.js";
import adminRoutes from "./admin.routes.js";

const router = express.Router();

// Health check route
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running perfectly! 🚀",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// ===== API ROUTES =====
/**
 * Mount all routes modules
 *
 * API Structure:
 *  - /api/auth/*       ->  Authentication routes (register, login, OTP, etc.)
 *  - /api/users/*      ->  User profile routes (protected)
 *  - /api/admin/*      ->  Admin management routes (admin/moderator only)
 */

// Route Mounting
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/admin", adminRoutes);

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
      users: {
        getProfile: "GET /api/users/profile",
        updateProfile: "PUT /api/users/profile",
        changePassword: "PUT /api/users/change-password",
        deleteAccount: "DELETE /api/users/account",
      },
      admin: {
        getDashboardStats: "GET /api/admin/stats",
        getAllUsers: "GET /api/admin/users",
        getUserById: "GET /api/admin/users/:id",
        updateUserRole: "PUT /api/admin/users/:id/role",
        updateUserStatus: "PUT /api/admin/users/:id/status",
        deleteUser: "DELETE /api/admin/users/:id",
      },
    },
  });
});

export default router;
