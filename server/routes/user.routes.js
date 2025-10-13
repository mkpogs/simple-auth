import express from "express";
import {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
  uploadAvatar,
  deleteAvatar,
} from "../controllers/user.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { uploadSingleAvatar } from "../configs/index.config.js";

const router = express.Router();

// ===== USER PROFILE ROUTES =====
// All routes require authentication (protect middleware)

// ✅ Apply protection middleware to ALL routes below
router.use(protect);

/**
 * @route   GET /api/users/profile
 * @desc    Get current user's profile
 * @access  Private (requires login)
 */
router.get("/profile", getProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Update user's profile information
 * @access  Private (requires login)
 */
router.put("/profile", updateProfile);

/**
 * @route   POST /api/users/avatar
 * @desc    Upload user's profile picture
 * @access  Private (requires login)
 */
router.post("/avatar", uploadSingleAvatar, uploadAvatar);

/**
 * @route   DELETE /api/users/avatar
 * @desc    Delete user's profile picture
 * @access  Private (requires login)
 */
router.delete("/avatar", deleteAvatar);

/**
 * @route   PUT /api/users/change-password
 * @desc    Change user's password (when logged in)
 * @access  Private (requires login)
 */
router.put("/change-password", changePassword);

/**
 * @route   DELETE /api/users/account
 * @desc    Delete user's account permanently
 * @access  Private (requires login)
 */
router.delete("/account", deleteAccount);

export default router;
