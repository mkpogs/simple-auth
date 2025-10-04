import express from "express";
import {
  register,
  verifyOTP,
  resendOTP,
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.controller.js";

const router = express.Router();

// ===== AUTH ROUTES =====

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user account
 * @access  Public
 * @body    { name, email, password }
 */
router.post("/register", register);

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Verify user's email with OTP code
 * @access  Public
 * @body    { email, otp }
 */
router.post("/verify-otp", verifyOTP);

/**
 * @route   POST /api/auth/resend-otp
 * @desc    Resend OTP code to user's email
 * @access  Public
 * @body    { email }
 */
router.post("/resend-otp", resendOTP);

/**
 * @route   POST /api/auth/login
 * @desc    Users Login
 * @access  Public
 * @body    { email, password }
 */
router.post("/login", login);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and invalidate refresh token
 * @access  Public
 * @body    { refreshToken }
 */
router.post("/logout", logout);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh Access Token
 * @access  Public
 * @body    { refreshToken }
 */
router.post("/refresh-token", refreshToken);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 * @body    { email }
 */
router.post("/forgot-password", forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 * @body    { token, password, confirmPassword }
 */
router.post("/reset-password", resetPassword);

export default router;
