import moment from "moment";
import { UAParser } from "ua-parser-js";
import geoip from "geoip-lite";
import User from "../models/User.model.js";
import AppError from "../utils/AppError.js";

/**
 * User Security Dashboard Service
 *
 * Simple Explanation:
 * This service helps users manage their own security settings:
 *  - View their 2FA status and trusted devices
 *  - See their recent login activity with locations
 *  - Manage their security preferences
 *  - Get security recommendations
 *
 * WHY WE NEED THIS:
 *  - Users want control over their own security
 *  - Transparency builds trust ("show me what you know about me")
 *  - Helps users spot suspicious activity
 *  - Industry standard (Github, Google, Facebook all have similar features)
 */

// ===== GET USER'S SECURITY OVERVIEW =====
/**
 * Main function to generate comprehensive security dashboard
 *
 * WHAT IT DOES:
 *  1. Fetches user data with all security fields
 *  2. Analyzes different security aspects separately
 *  3. Calculates overall security score
 *  4. Generates personalized recommendations
 *  5. Returns structured dashboard data
 *
 * WHY WE ANALYZE SEPARATELY:
 *  - Each aspect has different scoring criteria
 *  - Makes it easier to add new security features
 *  - Users can see exactly what affects their score
 */
export const getUserSecurityDashboard = async (userId) => {
  try {
    console.log("🛡️ Generating security dashboard for user:", userId);

    // Get user with all security-related data
    // We use .select("+field") to include fields that are normally excluded
    const user = await User.findById(userId).select(
      "+twoFactorAuth +loginHistory +passwordChangedAt +failedLoginAttempts +lockUntil"
    );

    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Analyze different security aspects
    // Each function focuses on one security area for better organization
    const twoFactorAnalysis = analyzeTwoFactorStatus(user);
    const trustedDevicesAnalysis = analyzeTrustedDevices(user);
    const loginActivityAnalysis = analyzeLoginActivity(user);
    const securityScore = calculateSecurityScore(user);
    const recommendations = generateSecurityRecommendations(user);

    console.log("✅ Security dashboard generated successfully");

    // Return structured dashboard with all security insights
    return {
      overview: {
        securityScore,
        recommendations,
        lastLoginAt: user.lastLoginAt,
        accountCreatedAt: user.createdAt,
      },
      twoFactor: twoFactorAnalysis,
      trustedDevices: trustedDevicesAnalysis,
      loginActivity: loginActivityAnalysis,
      account: {
        isVerified: user.isVerified,
        accountStatus: user.accountStatus,
        lastPasswordChange: user.passwordChangedAt || user.createdAt,
        failedLoginAttempts: user.failedLoginAttempts || 0,
        isLocked: !!(user.lockUntil && user.lockUntil > new Date()),
      },
    };
  } catch (error) {
    console.error("❌ Error generating security dashboard:", error);
    throw new AppError("Failed to generate security dashboard", 500);
  }
};

// ===== ANALYZE 2FA STATUS =====
/**
 * Analyze user's Two-Factor Authentication setup and usage
 *
 * WHAT IT CHECKS:
 *  - Is 2FA enabled and when was it set up?
 *  - How many backup codes are left?
 *  - Any failed 2FA attempts or lockouts?
 *  - Does the setup need attention?
 *
 * WHY THIS MATTERS:
 *  - 2FA is the most important security feature
 *  - Users need to know if backup codes are running low
 *  - Failed attempts might indicate attacks
 */
const analyzeTwoFactorStatus = (user) => {
  console.log("🔐 Analyzing 2FA status...");

  const twoFA = user.twoFactorAuth || {};
  const backupCodes = twoFA.backupCodes || [];

  // Count unused vs used backup codes
  const unusedBackupCodes = backupCodes.filter((code) => !code.used).length;
  const usedBackupCodes = backupCodes.filter((code) => code.used).length;

  // Determine if 2FA setup needs attention
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
 * Analyze user's trusted devices for 2FA bypass
 *
 * WHAT IT DOES:
 *  - Parses device information (browser, OS, type)
 *  - Gets geographic location from IP addresses
 *  - Identifies old devices that haven't been used recently
 *  - Provides recommendations for device cleanup
 *
 * WHY DEVICE ANALYSIS MATTERS:
 *  - Old devices might be security risks
 *  - Users should know what devices have access
 *  - Geographic info helps spot suspicious access
 */
const analyzeTrustedDevices = (user) => {
  console.log("📱 Analyzing trusted devices...");

  const trustedDevices = user.twoFactorAuth?.trustedDevices || [];
  const activeDevices = trustedDevices.filter((device) => device.isActive);

  // Process each device to extract detailed information
  const devicesWithDetails = activeDevices.map((device) => {
    // Parse user agent string to get browser and OS info
    const parser = new UAParser(device.userAgent);
    const uaResult = parser.getResult();

    // Try to get geographic location from IP address
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
        device.deviceName || `${uaResult.browser.name} on ${uaResult.os.name}`,
      browser: uaResult.browser.name || "Unknown",
      os: uaResult.os.name || "Unknown",
      deviceType: uaResult.device.type || "desktop",
      location,
      ipAddress: device.ipAddress,
      trustedAt: device.trustedAt,
      lastUsed: device.lastUsed,
      lastUsedAgo: moment(device.lastUsed).fromNow(),
      isRecent: moment(device.lastUsed).isAfter(moment().subtract(7, "days")),
      isActive: device.isActive,
    };
  });

  // Find devices that haven't been used in 30+ days (potential security risk)
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
 * Analyze user's recent login history and patterns
 *
 * WHAT IT ANALYZES:
 *  - Recent login attempts (successful and failed)
 *  - Device and location information for each login
 *  - Success rate and suspicious activity patterns
 *  - Most used devices and common locations
 *
 * SECURITY INSIGHTS:
 *  - Failed logins might indicate attack attempts
 *  - Logins from new locations could be suspicious
 *  - Multiple IPs in short time span is a red flag
 */
const analyzeLoginActivity = (user) => {
  console.log("📊 Analyzing login activity...");

  const loginHistory = user.loginHistory || [];
  const recentLogins = loginHistory.slice(0, 10); // Get last 10 logins

  // Process each login to extract device and location information
  const processedLogins = recentLogins.map((login) => {
    // Parse user agent to identify device details
    const parser = new UAParser(login.userAgent);
    const uaResult = parser.getResult();

    // Get geographic location from IP address
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
      location,
      ipAddress: login.ipAddress,
      isSuspicious: checkSuspiciousActivity(login, user),
    };
  });

  // Calculate login statistics for insights
  const successfulLogins = processedLogins.filter(
    (login) => login.success
  ).length;
  const failedLogins = processedLogins.filter((login) => !login.success).length;
  const suspiciousLogins = processedLogins.filter(
    (login) => login.isSuspicious
  ).length;

  return {
    recentLogins: processedLogins,
    statistics: {
      total: loginHistory.length,
      successful: successfulLogins,
      failed: failedLogins,
      suspicious: suspiciousLogins,
      successRate:
        recentLogins.length > 0
          ? Math.round((successfulLogins / recentLogins.length) * 100)
          : 0,
    },
    insights: {
      mostUsedDevice: getMostUsedDevice(processedLogins),
      mostCommonLocation: getMostCommonLocation(processedLogins),
      unusualActivity: suspiciousLogins > 0,
    },
  };
};

// ========== CALCULATE SECURITY SCORE ==========
/**
 * Calculate overall security score based on multiple factors
 *
 * SCORING SYSTEM (out of 100):
 *  - Two-Factor Authentication: 40 points (most important)
 *  - Email Verification: 20 points
 *  - Recent Password Change: 15 points
 *  - Account Security (not locked): 10 points
 *  - Recent Activity: 10 points
 *  - Backup Codes Available: 5 points
 *
 * WHY WEIGHTED SCORING:
 *  - 2FA provides the biggest security boost
 *  - Email verification prevents account takeover
 *  - Regular password updates reduce breach impact
 */
const calculateSecurityScore = (user) => {
  let score = 0;
  const factors = [];

  // 2FA enabled (40 points) - Most important security factor
  if (user.twoFactorAuth?.isEnabled) {
    score += 40;
    factors.push({
      factor: "Two-Factor Authentication",
      points: 40,
      status: "✅",
    });
  } else {
    factors.push({
      factor: "Two-Factor Authentication",
      points: 0,
      status: "❌",
    });
  }

  // Email verified (20 points) - Prevents account takeover
  if (user.isVerified) {
    score += 20;
    factors.push({ factor: "Email Verification", points: 20, status: "✅" });
  } else {
    factors.push({ factor: "Email Verification", points: 0, status: "❌" });
  }

  // Recent password change (15 points) - Reduces breach impact
  const passwordAge = user.passwordChangedAt
    ? moment().diff(moment(user.passwordChangedAt), "days")
    : moment().diff(moment(user.createdAt), "days");

  if (passwordAge < 90) {
    score += 15;
    factors.push({
      factor: "Recent Password Change",
      points: 15,
      status: "✅",
    });
  } else {
    factors.push({ factor: "Recent Password Change", points: 0, status: "❌" });
  }

  // Account not locked (10 points) - Shows good security practices
  if (!(user.lockUntil && user.lockUntil > new Date())) {
    score += 10;
    factors.push({ factor: "Account Security", points: 10, status: "✅" });
  } else {
    factors.push({ factor: "Account Security", points: 0, status: "❌" });
  }

  // Recent activity (10 points) - Active accounts are better monitored
  if (
    user.lastLoginAt &&
    moment().diff(moment(user.lastLoginAt), "days") < 30
  ) {
    score += 10;
    factors.push({ factor: "Recent Activity", points: 10, status: "✅" });
  } else {
    factors.push({ factor: "Recent Activity", points: 0, status: "❌" });
  }

  // Backup codes available (5 points) - Ensures 2FA recovery options
  const backupCodes = user.twoFactorAuth?.backupCodes || [];
  const unusedCodes = backupCodes.filter((code) => !code.used).length;
  if (unusedCodes >= 3) {
    score += 5;
    factors.push({ factor: "Backup Codes Available", points: 5, status: "✅" });
  } else {
    factors.push({ factor: "Backup Codes Available", points: 0, status: "❌" });
  }

  // Determine grade and message based on score
  let grade = "F";
  let color = "#ff4444";
  let message = "Critical security issues need attention";

  if (score >= 90) {
    grade = "A+";
    color = "#00aa00";
    message = "Excellent security setup!";
  } else if (score >= 80) {
    grade = "A";
    color = "#44aa00";
    message = "Very good security setup";
  } else if (score >= 70) {
    grade = "B";
    color = "#88aa00";
    message = "Good security, minor improvements possible";
  } else if (score >= 60) {
    grade = "C";
    color = "#aaaa00";
    message = "Moderate security, improvements recommended";
  } else if (score >= 50) {
    grade = "D";
    color = "#aa4400";
    message = "Poor security, immediate action needed";
  }

  return {
    score,
    grade,
    color,
    message,
    factors,
    maxScore: 100,
  };
};

// ========== GENERATE SECURITY RECOMMENDATIONS ==========
/**
 * Generate personalized security recommendations based on user's current setup
 *
 * RECOMMENDATION PRIORITIES:
 *  - High: Critical security features missing (2FA, email verification)
 *  - Medium: Important improvements (password age, backup codes)
 *  - Low: Good practices (device cleanup, regular reviews)
 *
 * WHY PERSONALIZED RECOMMENDATIONS:
 *  - Users get overwhelmed by generic advice
 *  - Specific actions are more likely to be taken
 *  - Priority system helps users focus on what matters most
 */
const generateSecurityRecommendations = (user) => {
  const recommendations = [];

  // 2FA recommendation (HIGH PRIORITY)
  // Most important security improvement for any account
  if (!user.twoFactorAuth?.isEnabled) {
    recommendations.push({
      priority: "high",
      category: "authentication",
      title: "Enable Two-Factor Authentication",
      description: "Add an extra layer of security to your account",
      action: "Enable 2FA",
      icon: "🔐",
    });
  }

  // Email verification (HIGH PRIORITY)
  // Prevents account takeover and enables password resets
  if (!user.isVerified) {
    recommendations.push({
      priority: "high",
      category: "verification",
      title: "Verify Your Email",
      description: "Confirm your email address to secure your account",
      action: "Verify Email",
      icon: "📧",
    });
  }

  // Password change (MEDIUM PRIORITY)
  // Regular password updates reduce breach impact
  const passwordAge = user.passwordChangedAt
    ? moment().diff(moment(user.passwordChangedAt), "days")
    : moment().diff(moment(user.createdAt), "days");

  if (passwordAge > 90) {
    recommendations.push({
      priority: "medium",
      category: "password",
      title: "Update Your Password",
      description: `Your password is ${passwordAge} days old`,
      action: "Change Password",
      icon: "🔑",
    });
  }

  // Backup codes (MEDIUM PRIORITY)
  // Ensures users can recover if they lose 2FA device
  const backupCodes = user.twoFactorAuth?.backupCodes || [];
  const unusedCodes = backupCodes.filter((code) => !code.used).length;
  if (user.twoFactorAuth?.isEnabled && unusedCodes < 3) {
    recommendations.push({
      priority: "medium",
      category: "backup",
      title: "Regenerate Backup Codes",
      description: `You have only ${unusedCodes} backup codes left`,
      action: "Generate New Codes",
      icon: "💾",
    });
  }

  // Trusted devices cleanup (LOW PRIORITY)
  // Removes potential security risks from old devices
  const trustedDevices = user.twoFactorAuth?.trustedDevices || [];
  const oldDevices = trustedDevices.filter((device) =>
    moment(device.lastUsed).isBefore(moment().subtract(30, "days"))
  );

  if (oldDevices.length > 0) {
    recommendations.push({
      priority: "low",
      category: "devices",
      title: "Review Trusted Devices",
      description: `${oldDevices.length} devices haven't been used recently`,
      action: "Manage Devices",
      icon: "📱",
    });
  }

  return recommendations;
};

// ========== HELPER FUNCTIONS ==========

/**
 * Get country flag emoji from country code
 * Used to make location information more visual and user-friendly
 */
const getCountryFlag = (countryCode) => {
  const flags = {
    US: "🇺🇸",
    CA: "🇨🇦",
    GB: "🇬🇧",
    DE: "🇩🇪",
    FR: "🇫🇷",
    AU: "🇦🇺",
    JP: "🇯🇵",
    CN: "🇨🇳",
    IN: "🇮🇳",
    BR: "🇧🇷",
    PH: "🇵🇭",
    MX: "🇲🇽",
    IT: "🇮🇹",
    ES: "🇪🇸",
    RU: "🇷🇺",
  };
  return flags[countryCode] || "🌍";
};

/**
 * Simple suspicious activity detection
 *
 * WHAT MAKES ACTIVITY SUSPICIOUS:
 *  - Multiple different IP addresses in recent logins
 *  - Failed login attempts
 *  - Could be enhanced with more sophisticated algorithms
 *
 * WHY SIMPLE DETECTION:
 *  - Complex algorithms can have false positives
 *  - Simple rules catch obvious attack patterns
 *  - Can be enhanced based on user feedback
 */
const checkSuspiciousActivity = (login, user) => {
  const recentLogins = user.loginHistory?.slice(0, 5) || [];
  const uniqueIPs = [...new Set(recentLogins.map((l) => l.ipAddress))];

  // Multiple IPs in short time span could indicate credential sharing or attacks
  if (uniqueIPs.length > 3) return true;

  // Failed login attempt is always suspicious
  if (!login.success) return true;

  return false;
};

/**
 * Find the most frequently used device from login history
 * Helps users identify their primary device for security decisions
 */
const getMostUsedDevice = (logins) => {
  const deviceCounts = {};
  logins.forEach((login) => {
    const deviceKey = `${login.device.browser} on ${login.device.os}`;
    deviceCounts[deviceKey] = (deviceCounts[deviceKey] || 0) + 1;
  });

  const mostUsed = Object.entries(deviceCounts).sort((a, b) => b[1] - a[1])[0];
  return mostUsed ? mostUsed[0] : "Unknown";
};

/**
 * Find the most common login location
 * Helps users identify their typical login patterns for security awareness
 */
const getMostCommonLocation = (logins) => {
  const locationCounts = {};
  logins.forEach((login) => {
    const locationKey = `${login.location.city}, ${login.location.country}`;
    locationCounts[locationKey] = (locationCounts[locationKey] || 0) + 1;
  });

  const mostCommon = Object.entries(locationCounts).sort(
    (a, b) => b[1] - a[1]
  )[0];
  return mostCommon ? mostCommon[0] : "Unknown";
};
