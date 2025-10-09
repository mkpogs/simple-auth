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
    console.log("🔍 Getting profile for user ID:", req.user._id);

    const userId = req.user._id;

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
    console.log("🔄 Updating profile for user:", req.user._id);
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

    if (name !== undefined) updateData.name = name.trim();
    if (bio !== undefined) updateData.bio = bio.trim();
    if (phone !== undefined) updateData.phone = phone.trim();
    if (location !== undefined) updateData.location = location.trim();

    console.log("📊 Prepared update data:", updateData);

    // Step 4: Update user in database
    const user = await User.findByIdAndUpdate(req.user._id, updateData, {
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

// ===== CHANGED PASSWORD (WHEN LOGGED IN) =====
/**
 * PUT /api/users/change-password
 *
 * PURPOSE: allow logged-in users to change their password
 * REAL-WORLD USE: "Change Password" in account settings
 *
 * WHAT IT DOES:
 *  1. Verifies current password
 *  2. Validates new password
 *  3. Updates password
 *  4. Invalidates all refresh tokens (logout other devices)
 *
 * SECURITY:
 *  - Requires current password verification
 *  - Logs out all devices after  password change
 */
export const changePassword = async (req, res, next) => {
  try {
    console.log(`🔐 Password change request for user: ${req.user._id}`);

    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Step 1: Validate Required Fields
    if (!currentPassword || !newPassword || !confirmPassword) {
      return next(
        new AppError(
          "Current password, new password, and confirm password are required",
          400
        )
      );
    }

    // Step 2: Validate New Passwords
    if (newPassword !== confirmPassword) {
      return next(
        new AppError("New password and confirm password do not match", 400)
      );
    }

    if (newPassword.length < 8) {
      return next(
        new AppError("New password must be at least 8 characters long", 400)
      );
    }

    if (currentPassword === newPassword) {
      return next(
        "New password cannot be the same as the current password",
        400
      );
    }

    // Step 3: Get user with password field
    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Step 4: Verify Current Password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      console.log("❌ Invalid current password provided");
      return next(new AppError("Current password is incorrect", 400));
    }

    // Step 5: Update Password
    user.password = newPassword;
    user.passwordChangedAt = new Date();
    user.refreshTokens = []; // Invalidate all refresh tokens (logout other devices for security)
    await user.save();
    console.log("✅ Password updated successfully for user:", user.email);

    // Step 6: Generate new JWT tokens for current session
    const tokens = jwtService.generateTokenPairs(user);
    user.addRefreshToken(tokens.refreshToken);
    await user.save();

    // Step 7: Return success response
    return res.status(200).json({
      success: true,
      message:
        "Password changed successfully. All devices have been logged out for security.",
      data: {
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
      },
    });
  } catch (error) {
    console.error("❌ Change Password Error:", error);
    next(new AppError("Failed to change password", 500));
  }
};

// ===== DELETE ACCOUNT =====
/**
 * DELETE /api/users/account
 *
 * PURPOSE: Allow users to delete their own account
 * REAL-WORLD USE: "Delete Account" option in settings
 *
 * WHAT IT DOES:
 *  1. Verifies user's password (security measure)
 *  2. Requires confirmation text
 *  3. Permanently deletes user account
 *
 * SECURITY:
 *  - Requires password confirmation
 *  - Requires exact confirmation text
 *  - Irreversible action
 */
export const deleteAccount = async (req, res, next) => {
  try {
    console.log("🗑️ Account deletion request for user:", req.user._id);

    const { password, confirmation } = req.body;

    // Step 1: Validate confirmation
    if (confirmation !== "DELETE MY ACCOUNT") {
      return next(
        new AppError(
          'Please type "DELETE MY ACCOUNT" to confirm account deletion',
          400
        )
      );
    }

    if (!password) {
      return next(new AppError("Password is required to delete account", 400));
    }

    // Step 2: Get user with password field
    const user = await User.findById(req.user._id).select("+password");
    if (!user) return next(new AppError("User not found", 404));

    // Step 3: Verify Password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      console.log("❌ Invalid password provided for account deletion");
      return next(new AppError("Password is incorrect", 400));
    }

    console.log("⚠️ Deleting account for user:", user.email);

    // Step 4: Delete user account (hard delete)
    await User.findByIdAndDelete(req.user._id);
    console.log("✅ Account deleted successfully");

    // Step 5: Return success response
    return res.status(200).json({
      success: true,
      message: "Account deleted successfully. We're sorry to see you go!",
    });
  } catch (error) {
    console.error("❌ Delete Account Error:", error);
    next(new AppError("Failed to delete account", 500));
  }
};
