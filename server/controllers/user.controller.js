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

// ===== UPDATE USER PROFILE =====
/**
 * PUT /api/users/profile
 *
 * PURPOSE: Update user's profile information
 * REAL-WORLD USE: Like updating your profile on social media or e-commerce sites
 *
 * WHAT IT DOES:
 *  1. Validates input data (name, bio, phone, location, avatar)
 *  2. Updates allowed fields only
 *  3. Returns updated profile
 *
 * SECURITY:
 *  - User can ONLY update their own profile
 *  - Sensitive fields (email, password, role) require separate endpoints
 *
 */
export const updateProfile = async (req, res, next) => {
  try {
    console.log("🔄 Updating profile for user:", req.user.id);
    console.log("📝 Update data received:", req.body);

    // Step 1: Extract allowed fields from request
    const { name, bio, phone, location } = req.body;

    // Step 2: Validate input (basic validation)
    if (name && name.trim().length < 2) {
      return next(new AppError("Name must be at least 2 characters long", 400));
    }

    if (bio && bio.length > 500) {
      return next(new AppError("Bio cannot exceed 500 characters", 400));
    }

    if (phone && !/^[\+]?[1-9][\d]{0,15}$/.test(phone)) {
      return next(new AppError("Please provide a valid phone number", 400));
    }

    // Step 3: Prepare update data (only include provided fields)
    const updateData = { updatedAt: new Date() };

    if (name !== undefined) updateDate.name = name.trim();
    if (bio !== undefined) updateDate.bio = bio.trim();
    if (phone !== undefined) updateDate.phone = phone.trim();
    if (location !== undefined) updateDate.location = location.trim();

    console.log("📊 Prepared update data:", updateData);

    // Step 4: Update user in database
    const user = await User.findByIdAndUpdate(req.user.id, updateData, {
      new: true, // Return the updated document
      runValidators: true, // Run schema validators
    }).select("-password -refreshTokens -twoFactorAuth.secret");

    // Step 5: Validate if user exists
    if (!user) {
      return next(new AppError("User not found", 404));
    }

    console.log("✅ Profile updated successfully for:", user.email);

    // STEP 6: Return success response
    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          bio: user.bio,
          phone: user.phone,
          avatar: user.avatar,
          location: user.location,
          role: user.role,
          accountStatus: user.accountStatus,
          isVerified: user.isVerified,
          updatedAt: user.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error("❌ Update Profile Error:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return next(new AppError(messages.join(". "), 400));
    }

    next(new AppError("Failed to update profile", 500));
  }
};
