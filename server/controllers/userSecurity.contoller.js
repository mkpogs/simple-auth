import { getUserSecurityDashboard } from "../services/userSecurity.service";
import User from "../models/User.model.js";
import AppError from "../utils/AppError.js";
import { parse } from "dotenv";

/**
 * User Security Dashboard Controller
 *
 * Simple Explanation:
 * This controller handles all security dashboard  requests from regular users:
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
 *  - Trusted  devices with locations
 *  - Recent login activity with geographic data
 */
export const getSecurityDashboard = async (req, res, next) => {
  try {
    console.log("🛡️ Security dashboard request from user:", req.user.email);

    // Get comprehensive security dashboard
    const securityData = await getUserSecurityDashboard(req.user._id);

    console.log("✅ Security dashboard generated successfully");

    return res.status(200).json({
      success: true,
      message: "Security dashboard retrieved successfully",
      data: securityData,
    });
  } catch (error) {
    console.error("❌ Get Security Dashboard Error:", error);
    next(new AppError("Failed to load security dashboard", 500));
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
 *  - success: Filter by succcess status (true/false)
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
    const limitNum = Math.min(100, Math.max(1, parseint(limit)));
    const daysNum = Math.max(1, parseInt(days));

    // Build query for login history
    const query = { user: req.user._id };

    // Filter by success status if provided
    if (success !== undefined) {
      query.success = success === "true";
    }

    // Filter by date range
    const dateLimit = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);
    query.loginAt = { $gte: dateLimit };

    // Get Login History with pagination
    const loginHistory = (await import("../models/User.model.js")).loginHistory;

    const totalLogins = await loginHistory.countDocuments(query);
    const logins = await loginHistory
      .find(query)
      .sort({ loginAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    // Process logins for display (reuse logic from service)
    const { default: UAParser } = await import("ua-parser-js");
    const { default: geoip } = await import("geoip-lite");
    const { default: moment } = await import("moment");

    const processedLogins = logins.map((login) => {
      // Parse user agent
      const parser = new UAParser();
      parser.setUA(login.userAgent);
      const uaResult = parser.getResult();

      // Get location from IP
      let location = { country: "Unknown", city: "Unknown" };
      try {
        const geo = geoip.lookup(login.ipAddress);
        if (geo) {
          location = {
            country: geo.country || "Unknown",
            city: geo.city || "Unknown",
            region: geo.region || "Unknown",
            flag: getCountryFlag(geo.country),
          };
        }
      } catch (error) {
        console.log("Could not get location for IP:", login.ipAddress);
      }

      return {
        id: login._id,
        loginAt: login.loginAt,
        loginAgo: moment(login.loginAt).fromNow(),
        success: login.success,
        reason:
          login.reason || (login.success ? "Login successful" : "Login failed"),
        device: {
          browser: uaResult.browser.name || "Unknown",
          os: uaResult.os.name || "Unknown",
          type: uaResult.device.type || "desktop",
        },
        location: location,
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

    return res.status(200).json({
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
    console.error("❌ Get Login History Error:", error);
    next(new AppError("Failed to retrieve login history", 500));
  }
};

// ===== MANAGE TRUSTED DEVICES =====
/**
 * GET /api/users/security/trusted-devices
 *
 * PURPOSE: Get all trusted devices for current user
 */
export const getTrustedDevices = async (req, res, next) => {
  try {
    console.log("📱 Trusted devices request from user:", req.user.email);

    // Get user with trusted devices
    const user = await User.findById(req.user._id).select(
      "+twoFactorAuth.trustedDevices"
    );

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    const trustedDevices = user.twoFactorAuth?.trustedDevices || [];
    const activeDevices = trustedDevices.filter((device) => device.isActive);

    // Process devices for display
    const { default: UAParser } = await import("ua-parser-js");
    const { default: geoip } = await import("geoip-lite");
    const { default: moment } = await import("moment");

    const processedDevices = activeDevices.map((device) => {
      const parser = new UAParser();
      parser.setUA(device.userAgent);
      const uaResult = parser.getResult();

      // Get location from IP
      let location = { country: "Unknown", city: "Unknown" };
      try {
        const geo = geoip.lookup(device.ipAddress);
        if (geo) {
          location = {
            country: geo.country || "Unknown",
            city: geo.city || "Unknown",
            region: geo.region || "Unknown",
            flag: getCountryFlag(geo.country),
          };
        }
      } catch (error) {
        console.log("Could not get location for device IP:", device.ipAddress);
      }

      return {
        id: device._id || device.deviceId,
        name:
          device.deviceName ||
          `${uaResult.browser.name} on ${uaResult.os.name}`,
        browser: uaResult.browser.name || "Unknown",
        os: uaResult.os.name || "Unknown",
        deviceType: uaResult.device.type || "desktop",
        location: location,
        ipAddress: device.ipAddress,
        trustedAt: device.trustedAt,
        lastUsed: device.lastUsed,
        lastUsedAgo: moment(device.lastUsed).fromNow(),
        isRecent: moment(device.lastUsed).isAfter(moment().subtract(7, "days")),
        isActive: device.isActive,
      };
    });

    console.log("✅ Trusted devices retrieved:", processedDevices.length);

    return res.status(200).json({
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
    console.error("❌ Get Trusted Devices Error:", error);
    next(new AppError("Failed to retrieve trusted devices", 500));
  }
};

/**
 * DELETE /api/users/security/trusted-devices/:deviceId
 *
 * PURPOSE: Remove a trusted device by its ID
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
      return next(
        new AppError("Please provide your password to remove device", 400)
      );
    }

    const isPasswordValid = await req.user.comparePassword(password);
    if (!isPasswordValid) {
      return next(new AppError("Invalid password", 401));
    }

    // Find and remove the device
    const user = await User.findById(req.user._id).select(
      "+twoFactorAuth.trustedDevices"
    );

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Find device index
    const deviceIndex = user.twoFactorAuth?.trustedDevices?.findIndex(
      (device) =>
        device._id?.toString() === deviceId || device.deviceId === deviceId
    );

    if (deviceIndex === -1 || deviceIndex === undefined) {
      return next(new AppError("Trusted device not found", 404));
    }

    // Get device info before removal (for response)
    const removedDevice = user.twoFactorAuth.trustedDevices[deviceIndex];

    // Remove device
    user.twoFactorAuth.trustedDevices.splice(deviceIndex, 1);
    user.updatedAt = new Date();

    await user.save();

    console.log("✅ Trusted device removed successfully");

    return res.status(200).json({
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
    console.error("❌ Remove Trusted Device Error:", error);
    next(new AppError("Failed to remove trusted device", 500));
  }
};
