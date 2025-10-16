import express from "express";
import {
  enable2FA,
  verify2FASetup,
  disable2FA,
  get2FAStatus,
  regenerateBackupCodes,
  verify2FALogin,
} from "../controllers/twoFactor.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { checkAccountStatus } from "../middlewares/rbac.middleware.js";

const router = express.Router();

// ========== TWO-FACTOR AUTHENTICATION ROUTES ==========
/**
 * All 2FA routes require authentication
 * Apply protection middleware to ALL routes below
 */

// ========== 2FA STATUS & MANAGEMENT ==========
/**
 * @route   GET /api/2fa/status
 * @desc    Get current 2FA status and settings
 * @access  Private (requires login)
 */
router.get("/status", protect, checkAccountStatus, get2FAStatus);

/**
 * @route   POST /api/2fa/enable
 * @desc    Start 2FA setup (generate QR code)
 * @access  Private (requires login)
 */
router.post("/enable", protect, checkAccountStatus, enable2FA);

/**
 * @route   POST /api/2fa/verify
 * @desc    Complete 2FA setup (verify QR code scan)
 * @access  Private (requires login)
 */
router.post("/verify", protect, checkAccountStatus, verify2FASetup);

/**
 * @route   DELETE /api/2fa/disable
 * @desc    Disable 2FA completely
 * @access  Private (requires login + password confirmation)
 */
router.delete("/disable", protect, checkAccountStatus, disable2FA);

// ========== BACKUP CODES MANAGEMENT ==========
/**
 * @route   POST /api/2fa/backup-codes/regenerate
 * @desc    Generate new backup recovery codes
 * @access  Private (requires login + password confirmation)
 */
router.post(
  "/backup-codes/regenerate",
  protect,
  checkAccountStatus,
  regenerateBackupCodes
);

// ========== LOGIN 2FA VERIFICATION ==========
/**
 * @route   POST /api/2fa/verify-login
 * @desc    Verify 2FA code during login process
 * @access  Semi-private (used during login flow)
 * @note    This route has special middleware handling
 */
router.post("/verify-login", verify2FALogin);

export default router;
