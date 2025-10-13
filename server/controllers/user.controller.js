import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import User from "../models/User.model.js";
import AppError from "../utils/AppError.js";
import { jwtService } from "../services/index.service.js";
import {
  getAvatarPath,
  handleMulterError,
  generateUniqueFilename,
} from "../configs/index.config.js";

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
        mobile: user.mobile,
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
 *  1. Validates input data (name, bio, mobile, location, avatar)
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
    const { name, bio, mobile, location } = req.body;

    // Step 2: Validate input (basic validation)
    if (name && name.trim().length < 2) {
      return next(new AppError("Name must be at least 2 characters long", 400));
    }

    if (bio && bio.length > 500) {
      return next(new AppError("Bio cannot exceed 500 characters", 400));
    }

    // Updated mobile validation for Philippine format
    if (mobile && !/^0\d{10}$/.test(mobile)) {
      return next(
        new AppError(
          "Please provide a valid Philippine mobile number (11 digits starting with 0)",
          400
        )
      );
    }

    // Validate location object
    if (location && typeof location === "object") {
      if (location.country && typeof location.country !== "string") {
        return next(new AppError("Country must be a string", 400));
      }
      if (location.city && typeof location.city !== "string") {
        return next(new AppError("City must be a string", 400));
      }
    } else if (location && typeof location !== "object") {
      return next(
        new AppError(
          "Location must be an object with country and city properties",
          400
        )
      );
    }

    // Step 3: Prepare update data (only include provided fields)
    const updateData = { updatedAt: new Date() };

    if (name !== undefined) updateData.name = name.trim();
    if (bio !== undefined) updateData.bio = bio.trim();
    if (mobile !== undefined) updateData.mobile = mobile.trim();

    // Handle location object properly
    if (location !== undefined) {
      updateData.location = {};
      if (location.country !== undefined)
        updateData.location.country = location.country.trim();
      if (location.city !== undefined)
        updateData.location.city = location.city.trim();
    }

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
          mobile: user.mobile,
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
        new AppError(
          "New password cannot be the same as the current password",
          400
        )
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
    console.log("💾 About to save user with new password...");
    await user.save();
    console.log("✅ Password updated successfully");
    console.log("✅ Password updated successfully for user:", user.email);

    // Step 6: Generate new JWT tokens for current session
    const tokens = jwtService.generateTokenPair(user);
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
    // console.error("❌ Change Password Error:", error);
    console.error("❌ Detailed Error:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
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

// ===== UPLOAD AVATAR =====
/**
 * POST /api/users/avatar
 *
 * PURPOSE: Upload and process user's profile picture
 * REAL-WORLD USE: Like updating profile photo on social media
 *
 * WHAT IT DOES:
 *  1. Receives uploaded  image file (handled by multer middleware)
 *  2. Processes image (resize, compress, convert to JPEG)
 *  3. Saves to organized folder structure
 *  4. Updates user's avatar field in database
 *  5. Deletes old avatar file (cleanup)
 *
 * SECURITY:
 *  - File validation handled by multer config
 *  - Image processing prevents malicious uploads
 *  - Organized file storage
 */
export const uploadAvatar = async (req, res, next) => {
  try {
    console.log("📸 Avatar upload request for user:", req.user._id);

    // Step 1: Check if file was uploaded (multer middleware handles validation)
    if (!req.file) {
      return next(new AppError("Please upload an image file", 400));
    }

    console.log("📁 Processing uploaded file:", {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });

    // Step 2: Generate unique filename using utility function
    const filename = generateUniqueFilename(
      req.user._id,
      "avatar",
      "image/jpeg"
    );

    console.log("💾 Saving to:", filepath);

    // Step 3: Process image with Sharp
    await sharp(req.file.buffer)
      .resize(300, 300, {
        fit: "cover", // Crop to fill the dimensions
        position: "center", // Center the crop
      })
      .jpeg({
        quality: 90,
        progressive: true,
      })
      .toFile(filepath);

    console.log("✅ Image processed and saved successfully");

    // Step 4: Get current user to check for old avatar
    const currentUser = await User.findById(req.user._id);
    const oldAvatar = currentUser?.avatar;

    // Step 5: Update user avatar in database
    const avatarUrl = `/uploads/avatars/${req.user._id}/${filename}`;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        avatar: avatarUrl,
        updatedAt: new Date(),
      },
      { new: true }
    ).select("-password -refreshTokens -twoFactorAuth.secret");

    if (!user) {
      // Clean up uploaded file if user update fails
      await fs.unlink(filepath).catch(console.error);
      return next(new AppError("User not found", 404));
    }

    console.log("✅ User avatar updated in database");

    // Step 6: Delete old avatar file (cleanup)
    if (oldAvatar && oldAvatar !== avatarUrl) {
      const oldFilePath = path.join(
        process.cwd(),
        oldAvatar.replace("/uploads/", "uploads/")
      );
      try {
        await fs.unlink(oldFilePath);
        console.log("🗑️ Old avatar file deleted:", oldAvatar);
      } catch (error) {
        console.log(
          "⚠️ Could not delete old avatar (file may not exist):",
          oldAvatar
        );
      }
    }

    // Step 7: Return success response
    return res.status(200).json({
      success: true,
      message: "Avatar uploaded and updated successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          updatedAt: user.updatedAt,
        },
        avatarUrl: `${req.protocol}://${req.get("host")}${avatarUrl}`, // Full URL for frontend
      },
    });
  } catch (error) {
    console.error("❌ Avatar Upload Error:", error);

    // Handle multer errors
    const multerError = handleMulterError(error);
    if (multerError !== error) {
      return next(multerError);
    }
    next(new AppError("Failed to upload avatar", 500));
  }
};

// ===== DELETE AVATAR =====
/**
 * DELETE /api/users/avatar
 *
 * PURPOSE:
 * REAL-WORLD USE:
 *
 * WHAT IT DOES:
 *
 * SECURITY:
 */
