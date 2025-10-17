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
