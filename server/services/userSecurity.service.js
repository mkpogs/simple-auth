import moment from "moment";
import UAParser from "ua-parser-js";
import geoip from "geoip-lite";
import User from "../models/User.model.js";
import AppError from "../utils/AppError.js";

/**
 * User Security Dashboard Service
 *
 * Simple Explanation:
 * This service hepls users manage their own security settings:
 *  - View their 2FA status and trusted devices
 *  - See their recent login activity with locations
 *  - Manage their security preferences
 *  - Get security recommendations
 *
 * WHY WE NEED THIS:
 *  - Users want control over  their own security
 *  - Transparency builds trust ("show me  what you know  about me")
 *  - Helps users spot suspicious activity
 *  - Industry standard (Github, Google, facebook all have similar features)
 */

// ===== GET USER'S SECURITY OVERVIEW =====
/**
 * Get comprehensive security dashboard for user
 *
 * WHAT IT RETURNS:
 *  - 2FA status and backup codes count
 *  - Trusted devices list
 *  - Recent login activity with locations
 *  - Security score and recommendations
 */
export const getUserSecurityDashboard = async (userId) => {
  try {
    console.log("🛡️ Getting security dashboard for user:", userId);

    // Step 1: get userwith all security-related data
    const user = await User.findById(userId)
      .select("+twoFactorAuth +loginHistory")
      .populate("loginHistory", null, null, {
        sort: { loginAt: -1 },
        limit: 10, // Last 1 logins
      });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Step 2: Analyze 2FA status
    const twoFactorStatus = analyzeTwoFactorStatus(user);

    // Step 3: Analyze trusted devices
    const trustedDevicesInfo = analyzeTrustedDevices(user);

    // Step 4: Analyze recent login activity
    const loginActivity = analyzeLoginActivity(user);

    // Step 5: Calculate security score
    const securityScore = calculateSecurityScore(user);

    // Step 6: Generate security recommendations
    const recommendations = generateSecurityRecommendations(user);

    console.log("✅ Security dashboard generated successfully");

    return {
      overview: {
        securityScore: securityScore.score,
        lastLoginAt: user.loginHistory?.[0]?.loginAt || null,
        totalLogins: user.loginHistory?.length || 0,
        accountCreated: user.createdAt,
      },
      twoFactor: twoFactorStatus,
      trustedDevices: trustedDevicesInfo,
      recentActivity: loginActivity,
      securityAnalysis: {
        score: securityScore.score,
        level: securityScore.level,
        breakdown: securityScore.breakdown,
      },
      recommendations: recommendations,
    };
  } catch (error) {
    console.error("❌ Get Security Dashboard Error:", error);
    throw new AppError("Failed to load security dashboard", 500);
  }
};

// ===== ANALYZE 2FA STATUS =====
/**
 * Analyze user's two-factor authentication setup
 *
 * WHAT IT CHECKS:
 * - Is 2FA enabled?
 * - How many backup codes are left?
 * - When was 2FA last used?
 * - Any failed attempts recently?
 */
const analyzeTwoFactorStatus = (user) => {
  console.log("🔐 Analyzing 2FA status...");

  const twoFA = user.twoFactorAuth || {};

  // Count backup codes
  const backupCodes = twoFA.backupCodes || [];
  const unusedBackupCodes = backupCodes.filter((code) => !code.used).length;
  const usedBackupCodes = backupCodes.filter((code) => code.used).length;

  // Check if 2FA needs attention
  const needsAttention = !twoFA.isEnabled || unusedBackupCodes < 3;

  return {
    isEnabled: twoFA.isEnabled || false,
    setupAt: twoFA.setupAt || null,
    lastUsed: twoFA.lastUsed || null,
    totalUsage: twoFA.totalUsage || 0,
    backupCodes: {
      total: backupCodes.length,
      unused: unusedBackupCodes,
      used: usedBackupCodes,
      needsRegeneration: unusedBackupCodes < 3,
    },
    security: {
      failedAttempts: twoFA.failedAttempts || 0,
      isLocked: !!(twoFA.lockedUntil && twoFA.lockedUntil > new Date()),
      lockUntil: twoFA.lockedUntil || null,
    },
    status: {
      needsAttention,
      message: needsAttention
        ? twoFA.isEnabled
          ? "Consider regenerating backup codes"
          : "Enable 2FA for better security"
        : "Your 2FA setup looks good!",
    },
  };
};

// ========== ANALYZE TRUSTED DEVICES ==========
/**
 * Analyze user's trusted devices
 *
 * WHAT IT RETURNS:
 * - List of all trusted devices with details
 * - Device usage statistics
 * - Devices that haven't been used recently (cleanup suggestions)
 */
const analyzeTrustedDevices = (user) => {
  console.log("📱 Analyzing trusted devices...");

  const trustedDevices = user.twoFactorAuth?.trustedDevices || [];
  const activeDevices = trustedDevices.filter((device) => device.isActive);

  // Parse device information for better display
  const devicesWithDetails = activeDevices.map((device) => {
    const parser = new UAParser();
    parser.setUA(device.userAgent);
    const uaResult = parser.getResult();

    // Get location from IP (if possible)
    let location = { country: "Unknown", city: "Unknown" };
    try {
      const geo = geoip.lookup(device.ipAddress);
      if (geo) {
        location = {
          country: geo.country || "Unknown",
          city: geo.city || "Unknown",
          region: geo.region || "Unknown",
        };
      }
    } catch (error) {
      console.log("Could not get location for IP:", device.ipAddress);
    }

    // Calculate how long ago device was last used
    const lastUsedAgo = moment(device.lastUsed).fromNow();
    const isRecent = moment(device.lastUsed).isAfter(
      moment().subtract(7, "days")
    );

    return {
      id: device._id || device.deviceId,
      name:
        device.deviceName || `${uaResult.browser.name} on ${uaResult.os.name}`,
      browser: uaResult.browser.name || "Unknown",
      os: uaResult.os.name || "Unknown",
      deviceType: uaResult.device.type || "desktop",
      location: location,
      ipAddress: device.ipAddress,
      trustedAt: device.trustedAt,
      lastUsed: device.lastUsed,
      lastUsedAgo: lastUsedAgo,
      isRecent: isRecent,
      isActive: device.isActive,
    };
  });

  // Find old devices (not used in 30+ days)
  const oldDevices = devicesWithDetails.filter((device) =>
    moment(device.lastUsed).isBefore(moment().subtract(30, "days"))
  );

  return {
    total: trustedDevices.length,
    active: activeDevices.length,
    inactive: trustedDevices.length - activeDevices.length,
    devices: devicesWithDetails,
    analytics: {
      oldDevices: oldDevices.length,
      recentDevices: devicesWithDetails.filter((d) => d.isRecent).length,
      needsCleanup: oldDevices.length > 0,
    },
    recommendations:
      oldDevices.length > 0
        ? [
            `Consider removing ${oldDevices.length} old device(s) that haven't been used recently`,
          ]
        : [],
  };
};

// ========== ANALYZE LOGIN ACTIVITY ==========
/**
 * Analyze user's recent login activity
 *
 * WHAT IT SHOWS:
 * - Recent logins with locations and device info
 * - Success vs failed login attempts
 * - Unusual activity patterns
 */
const analyzeLoginActivity = (user) => {
  console.log("📊 Analyzing login activity...");

  const loginHistory = user.loginHistory || [];
  const recentLogins = loginHistory.slice(0, 10); // Last 10 logins

  // Process each login for display
  const processedLogins = recentLogins.map((login) => {
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
          flag: getCountryFlag(geo.country), // Helper function for country flags
        };
      }
    } catch (error) {
      console.log("Could not get location for login IP:", login.ipAddress);
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
      isSuspicious: checkSuspiciousActivity(login, user),
    };
  });

  // Calculate statistics
  const successfulLogins = processedLogins.filter(
    (login) => login.success
  ).length;
  const failedLogins = processedLogins.filter((login) => !login.success).length;
  const suspiciousLogins = processedLogins.filter(
    (login) => login.isSuspicious
  ).length;

  return {
    recent: processedLogins,
    statistics: {
      total: processedLogins.length,
      successful: successfulLogins,
      failed: failedLogins,
      suspicious: suspiciousLogins,
      successRate:
        processedLogins.length > 0
          ? Math.round((successfulLogins / processedLogins.length) * 100)
          : 0,
    },
    alerts:
      suspiciousLogins > 0
        ? [`${suspiciousLogins} potentially suspicious login(s) detected`]
        : [],
  };
};

// ========== CALCULATE SECURITY SCORE ==========
/**
 * Calculate user's security score (0-100)
 *
 * SCORING FACTORS:
 * - 2FA enabled: +40 points
 * - Strong password: +20 points
 * - Email verified: +20 points
 * - Recent activity: +10 points
 * - Backup codes available: +10 points
 */
const calculateSecurityScore = (user) => {
  console.log("📊 Calculating security score...");

  let score = 0;
  const breakdown = [];

  // 2FA enabled (40 points)
  if (user.twoFactorAuth?.isEnabled) {
    score += 40;
    breakdown.push({ factor: "2FA Enabled", points: 40, status: "good" });
  } else {
    breakdown.push({ factor: "2FA Disabled", points: 0, status: "warning" });
  }

  // Email verified (20 points)
  if (user.isVerified) {
    score += 20;
    breakdown.push({ factor: "Email Verified", points: 20, status: "good" });
  } else {
    breakdown.push({
      factor: "Email Not Verified",
      points: 0,
      status: "warning",
    });
  }

  // Account status (20 points)
  if (user.accountStatus === "active") {
    score += 20;
    breakdown.push({ factor: "Active Account", points: 20, status: "good" });
  } else {
    breakdown.push({ factor: "Account Issues", points: 0, status: "error" });
  }

  // Recent activity (10 points)
  const lastLogin = user.loginHistory?.[0]?.loginAt;
  if (lastLogin && moment(lastLogin).isAfter(moment().subtract(30, "days"))) {
    score += 10;
    breakdown.push({ factor: "Recent Activity", points: 10, status: "good" });
  } else {
    breakdown.push({ factor: "No Recent Activity", points: 0, status: "info" });
  }

  // Backup codes available (10 points)
  const unusedBackupCodes =
    user.twoFactorAuth?.backupCodes?.filter((code) => !code.used).length || 0;
  if (unusedBackupCodes >= 5) {
    score += 10;
    breakdown.push({
      factor: "Backup Codes Ready",
      points: 10,
      status: "good",
    });
  } else {
    breakdown.push({
      factor: "Few Backup Codes",
      points: 0,
      status: "warning",
    });
  }

  // Determine security level
  let level = "low";
  if (score >= 80) level = "excellent";
  else if (score >= 60) level = "good";
  else if (score >= 40) level = "moderate";
  else level = "low";

  return {
    score,
    level,
    breakdown,
  };
};

// ========== GENERATE SECURITY RECOMMENDATIONS ==========
/**
 * Generate personalized security recommendations
 */
const generateSecurityRecommendations = (user) => {
  console.log("💡 Generating security recommendations...");

  const recommendations = [];

  // 2FA recommendations
  if (!user.twoFactorAuth?.isEnabled) {
    recommendations.push({
      type: "critical",
      title: "Enable Two-Factor Authentication",
      description: "Add an extra layer of security to your account",
      action: "enable_2fa",
      priority: 1,
    });
  }

  // Backup codes recommendations
  const unusedBackupCodes =
    user.twoFactorAuth?.backupCodes?.filter((code) => !code.used).length || 0;
  if (user.twoFactorAuth?.isEnabled && unusedBackupCodes < 3) {
    recommendations.push({
      type: "warning",
      title: "Regenerate Backup Codes",
      description: "You have few backup codes left. Generate new ones.",
      action: "regenerate_backup_codes",
      priority: 2,
    });
  }

  // Email verification
  if (!user.isVerified) {
    recommendations.push({
      type: "warning",
      title: "Verify Your Email",
      description: "Verify your email address to secure your account",
      action: "verify_email",
      priority: 3,
    });
  }

  // Trusted devices cleanup
  const oldDevices =
    user.twoFactorAuth?.trustedDevices?.filter(
      (device) =>
        device.isActive &&
        moment(device.lastUsed).isBefore(moment().subtract(30, "days"))
    ).length || 0;

  if (oldDevices > 0) {
    recommendations.push({
      type: "info",
      title: "Clean Up Old Devices",
      description: `Remove ${oldDevices} device(s) you no longer use`,
      action: "manage_devices",
      priority: 4,
    });
  }

  return recommendations.sort((a, b) => a.priority - b.priority);
};
