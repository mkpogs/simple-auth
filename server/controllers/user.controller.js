import User from "../models/User.model.js";
import AppError from "../utils/AppError.js";
import { jwtService } from "../services/index.service.js";

// ===== GET USER PROFILE =====
/**
 * GET /api/users/profile
 *
 * PURPOSE: Get current user's profile information
 * REAL-WORLD USE: Like Clicking "My Account" on any website
 *
 * WHAT IT DOES:
 *  1. Takes the user ID from the authentication token
 *  2. Find the user in database
 *  3. Returns user profile info (WITHOUT sensitive data like password)
 *
 * SECURITY:
 *  - Requires authentication (login token)
 *  - User can only see their own profile
 */

export const getProfile = async (req, res, next) => {
  try {
    // Step 1: Get user ID from auth middleware (req.user comes from protect middleware)
    console.log("🔍 Getting profile for user ID:", req.user.id);

    const userId = req.user.id;

    // Step 2: Find user in database and exclude sensitive fields
    const user = await User.findById(userId).select(
      "-password -refreshTokens -twoFactorAuth.secret"
    );

    // Step 3: Validate if user exists
    if (!user) {
      console.log("❌ User not found in database");
      return next(new AppError("User not found", 404));
    }

    console.log("✅ User profile retrieved successfully for:", user.email);

    // Step 4: Return profile information
    return res.status(200).json({
      success: true,
      message: "Profile retrieved successfully",
      data: {
        // Basic Info
        id: user._id,
        name: user.name,
        email: user.email,
        bio: user.bio,
        phone: user.phone,
        avatar: user.avatar,
        location: user.location,

        // Account Info
        role: user.role,
        accountStatus: user.accountStatus,
        isVerified: user.isVerified,
        isActive: user.isActive,

        // Security Info
        twoFactorEnabled: user.twoFactorAuth?.isEnabled || false,
        isLocked: user.isLocked, // Virtual field

        // Timestamps
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,

        // Login History (last 5 only for security)
        recentLogins: user.loginHistory?.slice(-5) || [],
      },
    });
  } catch (error) {
    console.error("❌ Get Profile Error:", error);
    next(new AppError("Failed to get profile information", 500));
  }
};
