import express from "express";
import {
  getAllUsers,
  getUserById,
  updateUserRole,
  updateUserStatus,
  deleteUser,
  getDashboardStats,
} from "../controllers/admin.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import {
  adminOnly,
  adminOrModerator,
  checkAccountStatus,
} from "../middlewares/rbac.middleware.js";

const router = express.Router();

// ===== ADMIN ROUTES =====
// All routes require authentication and admin/moderator privileges

/**
 * Apply protection middleware to all admin routes
 * Order matters: protect -> checkAccountStatus -> role-based auth
 */
router.use(protect); // Must be logged in
router.use(checkAccountStatus); // Account must be active

// ===== DASHBOARD AND STATISTICS =====
/**
 * @route   GET /api/admin/stats
 * @desc    Get admin dashboard statistics
 * @access  Admin only
 */
router.get("/stats", adminOnly, getDashboardStats);

// ===== USER MANAGEMENT =====
/**
 * @route   GET /api/admin/users
 * @desc    Get all users pagination and filtering
 * @access  Admin or Moderator
 * @query   page, limit, role, status, search, isVerified, sortBy, sortOrder
 */
router.get("/users", adminOrModerator, getAllUsers);

/**
 * @route   GET /api/admin/users/:id
 * @desc    Get specific user details
 * @access  Admin or Moderator
 */
router.get("/users/:id", adminOrModerator, getUserById);

/**
 * @route  PUT /api/admin/users/:id/role
 * @desc   Update user role (e.g., user, moderator, admin)
 * @access Admin only
 */
router.put("/users/:id/role", adminOnly, updateUserRole);

/**
 * @route   PUT /api/admin/users/:id/status
 * @desc    Update user's account status (active, suspended, banned, pending)
 * @access  Admin or Moderator
 */
router.put("/users/:id/status", adminOrModerator, updateUserStatus);

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Permanently delete user account
 * @access  Admin only
 */
router.delete("/users/:id", adminOnly, deleteUser);

export default router;
