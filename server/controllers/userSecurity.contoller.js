import { getUserSecurityDashboard } from "../services/userSecurity.service";
import User from "../models/User.model.js";
import AppError from "../utils/AppError.js";

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
