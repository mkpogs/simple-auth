import { getUserSecurityDashboard } from "../services/userSecurity.service.js";
import User from "../models/User.model.js";
import AppError from "../utils/AppError.js";
import bcrypt from "bcryptjs";

/**
 * User Security Dashboard Controller
 *
 * Simple Explanation:
 * This controller handles all security dashboard requests from regular users:
 *   - Show me my security dashboard --> Get overview, devices, activity
 *   - Remove my trusted device --> Delete specific device
 *   - Show my login history --> Get detailed login timeline
 *   - Get my security settings --> Current security configuration
 *
 * WHY SEPARATE FROM ADMIN?
 *  - Users can only see THEIR OWN DATA
 *  - Different permissions than admin
 *  - Focused on personal security management
 *
 */

// ===== GET SECURITY DASHBOARD =====
/**
 * GET /api/users/security/dashboard
 *
 * PURPOSE: Get comprehensive security overview for current user
 *
 * WHAT IT RETURNS:
 *  - Security score and recommendations
 *  - 2FA status and backup codes info
 *  - Trusted devices with locations
 *  - Recent login activity with geographic data
 */
export const getSecurityDashboard = async (req, res, next) => {
  try {
    console.log("🛡️ Security dashboard request from user:", req.user.email);

    // Get comprehensive security dashboard
    const securityData = await getUserSecurityDashboard(req.user._id);

    console.log("✅ Security dashboard generated successfully");

    res.status(200).json({
      success: true,
      message: "Security dashboard retrieved successfully",
      data: securityData,
    });
  } catch (error) {
    next(error);
  }
};

// ===== GET DETAILED LOGIN HISTORY =====
/**
 * GET /api/users/security/login-history
 *
 * PURPOSE: Get detailed login history with pagination
 *
 * QUERY PARAMS:
 *  - page: Page number (default: 1)
 *  - limit: Items per page (default: 20, max: 100)
 *  - success: Filter by success status (true/false)
 *  - days: Filter by days ago (7, 30, 90)
 */
export const getLoginHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, success, days = 30 } = req.query;

    console.log("📊 Login history request:", {
      user: req.user.email,
      page,
      limit,
      success,
      days,
    });

    // Validate pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const daysNum = Math.max(1, parseInt(days));

    // Get user with login history
    const user = await User.findById(req.user._id).select("+loginHistory");

    if (!user) {
      throw new AppError("User not found", 404);
    }

    let loginHistory = user.loginHistory || [];

    // Filter by success status if provided
    if (success !== undefined) {
      const isSuccess = success === "true";
      loginHistory = loginHistory.filter(
        (login) => login.success === isSuccess
      );
    }

    // Filter by date range
    const dateLimit = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);
    loginHistory = loginHistory.filter((login) => login.loginAt >= dateLimit);

    // Sort by most recent first
    loginHistory.sort((a, b) => new Date(b.loginAt) - new Date(a.loginAt));

    // Pagination
    const totalLogins = loginHistory.length;
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedLogins = loginHistory.slice(startIndex, endIndex);

    // Process logins for display with device and time information
    const processedLogins = paginatedLogins.map((login) => {
      // Simple time ago calculation
      const timeAgo = getTimeAgo(login.loginAt);

      // Basic user agent parsing
      const deviceInfo = parseUserAgent(login.userAgent);

      return {
        id: login._id,
        loginAt: login.loginAt,
        loginAgo: timeAgo,
        success: login.success,
        reason:
          login.reason || (login.success ? "Login successful" : "Login failed"),
        device: deviceInfo,
        ipAddress: login.ipAddress,
      };
    });

    // Calculate pagination info
    const totalPages = Math.ceil(totalLogins / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    console.log("✅ Login history retrieved:", {
      total: totalLogins,
      page: pageNum,
      pages: totalPages,
    });

    res.status(200).json({
      success: true,
      message: "Login history retrieved successfully",
      data: {
        logins: processedLogins,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems: totalLogins,
          itemsPerPage: limitNum,
          hasNextPage,
          hasPrevPage,
        },
        filters: {
          days: daysNum,
          success: success !== undefined ? success === "true" : null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ===== MANAGE TRUSTED DEVICES =====
/**
 * GET /api/users/security/trusted-devices
 *
 * PURPOSE: Get all trusted devices for current user
 *
 * WHAT IT RETURNS:
 *  - List of active trusted devices with device info
 *  - Device statistics (total, active, inactive)
 *  - Device details (browser, OS, location, last used)
 */
export const getTrustedDevices = async (req, res, next) => {
  try {
    console.log("📱 Trusted devices request from user:", req.user.email);

    // Get user with trusted devices
    const user = await User.findById(req.user._id).select(
      "+twoFactorAuth.trustedDevices"
    );

    if (!user) {
      throw new AppError("User not found", 404);
    }

    const trustedDevices = user.twoFactorAuth?.trustedDevices || [];
    const activeDevices = trustedDevices.filter((device) => device.isActive);

    // Process devices for display with device information
    const processedDevices = activeDevices.map((device) => {
      const deviceInfo = parseUserAgent(device.userAgent);
      const timeAgo = getTimeAgo(device.lastUsed);

      return {
        id: device._id || device.deviceId,
        name: device.deviceName || `${deviceInfo.browser} on ${deviceInfo.os}`,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        deviceType: deviceInfo.type,
        ipAddress: device.ipAddress,
        trustedAt: device.trustedAt,
        lastUsed: device.lastUsed,
        lastUsedAgo: timeAgo,
        isRecent: isRecentDate(device.lastUsed, 7), // Within 7 days
        isActive: device.isActive,
      };
    });

    console.log("✅ Trusted devices retrieved:", processedDevices.length);

    res.status(200).json({
      success: true,
      message: "Trusted devices retrieved successfully",
      data: {
        devices: processedDevices,
        statistics: {
          total: trustedDevices.length,
          active: activeDevices.length,
          inactive: trustedDevices.length - activeDevices.length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/users/security/trusted-devices/:deviceId
 *
 * PURPOSE: Remove a trusted device by its ID
 *
 * SECURITY MEASURES:
 *  - Requires password confirmation
 *  - Only user can remove their own devices
 *  - Validates device exists before removal
 */
export const removeTrustedDevice = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const { password } = req.body;

    console.log("🗑️ Remove trusted device request:", {
      user: req.user.email,
      deviceId,
    });

    // Security check - require password for device removal
    if (!password) {
      throw new AppError("Please provide your password to remove device", 400);
    }

    // Verify password for security
    const isPasswordValid = await req.user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AppError("Invalid password", 401);
    }

    // Find and remove the device
    const user = await User.findById(req.user._id).select(
      "+twoFactorAuth.trustedDevices"
    );

    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Find device index
    const deviceIndex = user.twoFactorAuth?.trustedDevices?.findIndex(
      (device) =>
        device._id?.toString() === deviceId || device.deviceId === deviceId
    );

    if (deviceIndex === -1 || deviceIndex === undefined) {
      throw new AppError("Trusted device not found", 404);
    }

    // Get device info before removal (for response)
    const removedDevice = user.twoFactorAuth.trustedDevices[deviceIndex];

    // Remove device from array
    user.twoFactorAuth.trustedDevices.splice(deviceIndex, 1);
    user.updatedAt = new Date();

    await user.save();

    console.log("✅ Trusted device removed successfully");

    res.status(200).json({
      success: true,
      message: "Trusted device removed successfully",
      data: {
        removedDevice: {
          id: removedDevice._id || removedDevice.deviceId,
          name: removedDevice.deviceName,
          removedAt: new Date(),
        },
        remainingDevices: user.twoFactorAuth.trustedDevices.filter(
          (d) => d.isActive
        ).length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ===== SECURITY SETTINGS =====
/**
 * GET /api/users/security/settings
 *
 * PURPOSE: Get current security settings summary
 *
 * WHAT IT RETURNS:
 *  - Account verification status
 *  - 2FA configuration and backup codes info
 *  - Security metrics (password age, failed attempts, etc.)
 *  - Trusted devices count
 */
export const getSecuritySettings = async (req, res, next) => {
  try {
    console.log("⚙️ Security settings request from user:", req.user.email);

    const user = await User.findById(req.user._id).select("+twoFactorAuth");

    if (!user) {
      throw new AppError("User not found", 404);
    }

    const twoFA = user.twoFactorAuth || {};
    const backupCodes = twoFA.backupCodes || [];
    const trustedDevices = twoFA.trustedDevices || [];

    // Build comprehensive security settings summary
    const settings = {
      account: {
        email: user.email,
        isVerified: user.isVerified,
        accountStatus: user.accountStatus,
        createdAt: user.createdAt,
      },
      twoFactor: {
        isEnabled: twoFA.isEnabled || false,
        setupAt: twoFA.setupAt || null,
        lastUsed: twoFA.lastUsed || null,
        backupCodesCount: backupCodes.filter((code) => !code.used).length,
        trustedDevicesCount: trustedDevices.filter((device) => device.isActive)
          .length,
      },
      security: {
        lastPasswordChange: user.passwordChangedAt || user.createdAt,
        failedLoginAttempts: user.failedLoginAttempts || 0,
        isLocked: !!(user.lockUntil && user.lockUntil > new Date()),
      },
    };

    console.log("✅ Security settings retrieved");

    res.status(200).json({
      success: true,
      message: "Security settings retrieved successfully",
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

// ===== HELPER FUNCTIONS =====

/**
 * Calculate human-readable time difference from a given date
 * Returns formats like "2 minutes ago", "1 day ago", etc.
 */
const getTimeAgo = (date) => {
  const now = new Date();
  const diffMs = now - new Date(date);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

  return new Date(date).toLocaleDateString();
};

/**
 * Parse user agent string to extract device information
 * Simple parsing without external libraries for basic browser/OS detection
 */
const parseUserAgent = (userAgent) => {
  if (!userAgent) {
    return { browser: "Unknown", os: "Unknown", type: "desktop" };
  }

  const ua = userAgent.toLowerCase();

  // Browser detection
  let browser = "Unknown";
  if (ua.includes("chrome")) browser = "Chrome";
  else if (ua.includes("firefox")) browser = "Firefox";
  else if (ua.includes("safari")) browser = "Safari";
  else if (ua.includes("edge")) browser = "Edge";
  else if (ua.includes("opera")) browser = "Opera";

  // OS detection
  let os = "Unknown";
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac")) os = "macOS";
  else if (ua.includes("linux")) os = "Linux";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("ios")) os = "iOS";

  // Device type detection
  let type = "desktop";
  if (ua.includes("mobile") || ua.includes("android")) type = "mobile";
  else if (ua.includes("tablet") || ua.includes("ipad")) type = "tablet";

  return { browser, os, type };
};

/**
 * Check if a date is within a specified number of days from now
 * Used to determine if device usage or login is "recent"
 */
const isRecentDate = (date, days) => {
  const now = new Date();
  const checkDate = new Date(date);
  const diffMs = now - checkDate;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= days;
};
