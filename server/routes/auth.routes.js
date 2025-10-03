import express from "express";
import {
  register,
  verifyOTP,
  resendOTP,
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

export default router;
