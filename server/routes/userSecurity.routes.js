import express from "express";
import {
  getSecurityDashboard,
  getLoginHistory,
  getTrustedDevices,
  removeTrustedDevice,
  getSecuritySettings,
} from "../controllers/userSecurity.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { checkAccountStatus } from "../middlewares/rbac.middleware.js";

const router = express.Router();

router.use(protect, checkAccountStatus);

// ========== USER SECURITY DASHBOARD ROUTES ==========
/**
 * All security dashboard routes require authentication
 * Users can only access their OWN security data
 */

// ========== SECURITY OVERVIEW ==========
/**
 * @route   GET /api/users/security/dashboard
 * @desc    Get comprehensive security dashboard
 * @access  Private (user can see their own security overview)
 * @returns Security score, 2FA status, devices, recent activity, recommendations
 */
router.get("/dashboard", getSecurityDashboard);

/**
 * @route   GET /api/users/security/settings
 * @desc    Get current security settings summary
 * @access  Private (user can see their own settings)
 * @returns 2FA status, account settings, security configuration
 */
router.get("/settings", getSecuritySettings);

// ========== LOGIN HISTORY & ACTIVITY ==========
/**
 * @route   GET /api/users/security/login-history
 * @desc    Get detailed login history with pagination
 * @access  Private (user can see their own login history)
 * @query   page, limit, success, days
 * @returns Paginated login history with device and location info
 */
router.get("/login-history", getLoginHistory);

// ========== TRUSTED DEVICES MANAGEMENT ==========
/**
 * @route   GET /api/users/security/trusted-devices
 * @desc    Get all trusted devices for current user
 * @access  Private (user can see their own trusted devices)
 * @returns List of trusted devices with details
 */
router.get("/trusted-devices", getTrustedDevices);

/**
 * @route   DELETE /api/users/security/trusted-devices/:deviceId
 * @desc    Remove a trusted device
 * @access  Private (user can remove their own trusted devices)
 * @params  deviceId - ID of device to remove
 * @body    password - User's password for security confirmation
 */
router.delete("/trusted-devices/:deviceId", removeTrustedDevice);

export default router;
