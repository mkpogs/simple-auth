import User from "../models/User.model.js";
import AppError from "../utils/AppError.js";
import {
  generateTwoFactorSecret,
  verifyTotpToken,
  encryptSecret,
  isTwoFactorSetupExpired,
} from "../services/twoFactor.service.js";

/**
 * Two-Factor Authentication Controller
 *
 * SIMPLE EXPLANATION:
 * This handles all 2FA requests from users:
 * - "I want to enable 2FA" → Generate QR code
 * - "Here's my verification code" → Verify and activate 2FA
 * - "I want to disable 2FA" → Turn off 2FA
 * - "Check my 2FA status" → Return current settings
 */

// ========== ENABLE 2FA (Step 1: Generate QR Code) ==========
/**
 * POST /api/users/2fa/enable
 *
 * PURPOSE: Start 2FA setup process
 * WHAT IT DOES:
 * 1. Generate secret key for user
 * 2. Create QR code for phone app
 * 3. Generate backup codes
 * 4. Save temporary secret (not activated yet)
 * 5. Return QR code to show user
 */
export const enable2FA = async (req, res, next) => {
  try {
    console.log("🔐 2FA enable request from user:", req.user.email);

    // STEP 1: Check if 2FA is already enabled
    if (req.user.twoFactorAuth?.isEnabled) {
      return next(
        new AppError("Two-factor authentication is already enabled", 400)
      );
    }

    // ADD THIS: Clear any existing incomplete setup
    if (req.user.twoFactorAuth?.tempSecret) {
      console.log("🔄 Clearing previous incomplete setup");
      req.user.twoFactorAuth.tempSecret = undefined;
    }

    // STEP 2: Generate 2FA secret and QR code
    console.log("🔐 Generating 2FA setup for user:", req.user.email);
    const twoFactorData = await generateTwoFactorSecret(req.user);
    console.log("✅ Secret generated successfully");

    // STEP 3: Save temporary secret to database (not activated yet)
    const encryptedSecret = encryptSecret(twoFactorData.secret);
    console.log("🔍 Encrypted secret length:", encryptedSecret?.length);

    req.user.twoFactorAuth.tempSecret = encryptedSecret;
    req.user.twoFactorAuth.backupCodes = twoFactorData.hashedBackupCodes;
    req.user.updatedAt = new Date();

    const savedUser = await req.user.save();

    // ADD THIS VERIFICATION - CRUCIAL!
    console.log("🔍 Verify tempSecret was saved:", {
      hasTempSecret: !!savedUser.twoFactorAuth?.tempSecret,
      tempSecretLength: savedUser.twoFactorAuth?.tempSecret?.length,
      userId: savedUser._id,
      updatedAt: savedUser.updatedAt,
    });

    console.log("✅ Temporary 2FA data saved to database");

    // STEP 4: Return QR code and setup info to user
    return res.status(200).json({
      success: true,
      message:
        "Scan the QR code with your authenticator app, then verify with a code",
      data: {
        qrCodeUrl: twoFactorData.qrCodeUrl,
        manualEntryKey: twoFactorData.manualEntryKey,
        backupCodes: twoFactorData.backupCodes, // Show once!
        appName: twoFactorData.issuer,
        instructions: {
          step1:
            "Open your authenticator app (Google Authenticator, Authy, etc.)",
          step2: "Scan the QR code or enter the manual key",
          step3: "Enter the 6-digit code to complete setup",
          step4: "Save your backup codes in a secure place",
        },
      },
    });
  } catch (error) {
    console.error("❌ Enable 2FA Error:", error);
    next(new AppError("Failed to enable two-factor authentication", 500));
  }
};

// ========== VERIFY 2FA SETUP (Step 2: Confirm Setup) ==========
/**
 * POST /api/users/2fa/verify
 *
 * PURPOSE: Complete 2FA setup after user scans QR code
 * WHAT IT DOES:
 * 1. Get verification code from user
 * 2. Verify code against temporary secret
 * 3. If valid, activate 2FA permanently
 * 4. Move secret from temp to permanent storage
 */
export const verify2FASetup = async (req, res, next) => {
  try {
    console.log("🔍 VERIFY 2FA - Step 1: Initial user object");
    console.log("🔍 User ID:", req.user._id);

    // ✅ Re-fetch user with tempSecret included
    const userWithTempSecret = await User.findById(req.user._id).select(
      "+twoFactorAuth.tempSecret"
    );

    if (!userWithTempSecret) {
      return next(new AppError("User not found", 404));
    }

    console.log("🔍 Fresh user with tempSecret:", {
      hasTempSecret: !!userWithTempSecret.twoFactorAuth?.tempSecret,
      tempSecretLength: userWithTempSecret.twoFactorAuth?.tempSecret?.length,
    });

    const { token } = req.body;

    if (!token) {
      return next(new AppError("Please provide a verification token", 400));
    }

    // Use the fresh user object with tempSecret
    if (!userWithTempSecret.twoFactorAuth?.tempSecret) {
      console.log("❌ NO TEMP SECRET FOUND!");
      return next(
        new AppError("No 2FA setup in progress. Please start setup first.", 400)
      );
    }

    // Check expiration
    const setupTime = userWithTempSecret.updatedAt;
    const now = new Date();
    const timeDiffMinutes = (now - setupTime) / (1000 * 60);
    console.log("🔍 Time since setup:", timeDiffMinutes, "minutes");

    if (isTwoFactorSetupExpired(userWithTempSecret)) {
      console.log("❌ Setup expired");
      userWithTempSecret.twoFactorAuth.tempSecret = undefined;
      userWithTempSecret.twoFactorAuth.backupCodes = [];
      await userWithTempSecret.save();
      return next(
        new AppError("2FA setup has expired. Please start setup again.", 400)
      );
    }

    // Verify the token using the fresh user object
    console.log("🔍 About to verify token:", token);

    const isValidToken = verifyTotpToken(
      token,
      userWithTempSecret.twoFactorAuth.tempSecret
    );

    console.log("🔍 Token verification result:", isValidToken);

    if (!isValidToken) {
      console.log("❌ Token verification failed");
      return next(
        new AppError("Invalid verification code. Please try again.", 400)
      );
    }

    console.log("✅ 2FA verification successful - Activating 2FA...");

    // ACTIVATE 2FA using the fresh user object
    userWithTempSecret.twoFactorAuth.isEnabled = true;
    userWithTempSecret.twoFactorAuth.secret =
      userWithTempSecret.twoFactorAuth.tempSecret;
    userWithTempSecret.twoFactorAuth.tempSecret = undefined; // Clear temp secret
    userWithTempSecret.twoFactorAuth.setupAt = new Date();
    userWithTempSecret.twoFactorAuth.lastUsed = null;
    userWithTempSecret.twoFactorAuth.totalUsage = 0;
    userWithTempSecret.twoFactorAuth.failedAttempts = 0;
    userWithTempSecret.twoFactorAuth.lockUntil = undefined;
    userWithTempSecret.updatedAt = new Date();

    await userWithTempSecret.save();
    console.log("✅ 2FA activated and saved to database");

    // Count backup codes
    const backupCodesCount =
      userWithTempSecret.twoFactorAuth.backupCodes?.length || 0;

    // Return success response
    return res.status(200).json({
      success: true,
      message: "Two-factor authentication has been successfully enabled",
      data: {
        isEnabled: true,
        setupAt: userWithTempSecret.twoFactorAuth.setupAt,
        backupCodesCount: backupCodesCount,
        message: "Your account is now more secure with 2FA enabled!",
        nextSteps: {
          step1: "Test your 2FA by logging out and logging back in",
          step2:
            "Keep your backup codes safe - you'll need them if you lose your phone",
          step3: "Consider adding trusted devices for convenience",
        },
      },
    });
  } catch (error) {
    console.error("❌ Verify 2FA Setup Error:", error);
    next(new AppError("Failed to verify two-factor authentication", 500));
  }
};

// ========== DISABLE 2FA ==========
/**
 * DELETE /api/users/2fa/disable
 *
 * PURPOSE: Turn off 2FA for user account
 * WHAT IT DOES:
 * 1. Verify user's password (security check)
 * 2. Clear all 2FA data
 * 3. Remove trusted devices
 * 4. Confirm 2FA is disabled
 */
export const disable2FA = async (req, res, next) => {
  try {
    console.log("🔐 Disable 2FA request from:", req.user.email);

    const { password, confirmationCode } = req.body;

    // Validate input
    if (!password) {
      return next(new AppError("Please provide your current password", 400));
    }

    // Check if 2FA is enabled
    if (!req.user.twoFactorAuth?.isEnabled) {
      return next(
        new AppError("Two-factor authentication is not enabled", 400)
      );
    }

    // ✅ FETCH USER WITH PASSWORD FIELD
    const userWithPassword = await User.findById(req.user._id).select(
      "+password +twoFactorAuth.secret"
    );

    if (!userWithPassword) {
      return next(new AppError("User not found", 404));
    }

    // Verify password using the fresh user object
    const isPasswordValid = await userWithPassword.comparePassword(password);

    if (!isPasswordValid) {
      console.log("❌ Invalid password for 2FA disable");
      return next(new AppError("Invalid password. Cannot disable 2FA.", 401));
    }

    console.log("✅ Password verified for 2FA disable");

    // If confirmation code provided, verify it (extra security)
    if (confirmationCode) {
      console.log("🔍 Verifying confirmation code...");

      const { verifyTotpToken } = await import(
        "../services/twoFactor.service.js"
      );
      const isValidToken = verifyTotpToken(
        confirmationCode,
        userWithPassword.twoFactorAuth.secret
      );

      if (!isValidToken) {
        console.log("❌ Invalid confirmation code");
        return next(
          new AppError("Invalid confirmation code. Cannot disable 2FA.", 401)
        );
      }

      console.log("✅ Confirmation code verified");
    }

    console.log("🔐 Disabling 2FA for user...");

    // Disable 2FA - clear all 2FA data
    userWithPassword.twoFactorAuth = {
      isEnabled: false,
      secret: null,
      setupAt: null,
      lastUsed: null,
      totalUsage: 0,
      failedAttempts: 0,
      lockUntil: null,
      backupCodes: [],
      trustedDevices: [],
    };

    userWithPassword.updatedAt = new Date();
    await userWithPassword.save();

    console.log("✅ 2FA disabled successfully");

    // Return success response
    return res.status(200).json({
      success: true,
      message: "Two-factor authentication has been disabled",
      data: {
        isEnabled: false,
        disabledAt: new Date(),
        warning:
          "Your account security has been reduced. Consider re-enabling 2FA.",
        nextSteps: {
          step1: "You can now login with just email and password",
          step2: "Consider enabling 2FA again for better security",
          step3: "Monitor your account for any suspicious activity",
        },
      },
    });
  } catch (error) {
    console.error("❌ Disable 2FA Error:", error);
    next(new AppError("Failed to disable two-factor authentication", 500));
  }
};

// ========== GET 2FA STATUS ==========
/**
 * GET /api/users/2fa/status
 *
 * PURPOSE: Check current 2FA settings
 * RETURNS: 2FA status, backup codes count, trusted devices
 */
export const get2FAStatus = async (req, res, next) => {
  try {
    console.log("📊 2FA status request from user:", req.user.email);

    const twoFactorAuth = req.user.twoFactorAuth || {};

    // Calculate backup codes info
    const backupCodes = twoFactorAuth.backupCodes || [];
    const unusedBackupCodes = backupCodes.filter((code) => !code.used).length;
    const usedBackupCodes = backupCodes.filter((code) => code.used).length;

    // Calculate trusted devices info
    const trustedDevices = twoFactorAuth.trustedDevices || [];
    const activeTrustedDevices = trustedDevices.filter(
      (device) => device.isActive
    ).length;

    // Return comprehensive status
    return res.status(200).json({
      success: true,
      message: "2FA status retrieved successfully",
      data: {
        isEnabled: twoFactorAuth.isEnabled || false,
        isSetupInProgress: !!twoFactorAuth.tempSecret,
        setupAt: twoFactorAuth.setupAt || null,
        lastUsed: twoFactorAuth.lastUsed || null,
        totalUsage: twoFactorAuth.totalUsage || 0,
        backupCodes: {
          total: backupCodes.length,
          unused: unusedBackupCodes,
          used: usedBackupCodes,
        },
        trustedDevices: {
          total: trustedDevices.length,
          active: activeTrustedDevices,
        },
        security: {
          failedAttempts: twoFactorAuth.failedAttempts || 0,
          isLocked: !!(
            twoFactorAuth.lockUntil && twoFactorAuth.lockUntil > new Date()
          ),
        },
      },
    });
  } catch (error) {
    console.error("❌ Get 2FA Status Error:", error);
    next(new AppError("Failed to retrieve 2FA status", 500));
  }
};

// ========== REGENERATE BACKUP CODES ==========
/**
 * POST /api/users/2fa/backup-codes/regenerate
 *
 * PURPOSE: Generate new backup codes (invalidate old ones)
 */
export const regenerateBackupCodes = async (req, res, next) => {
  try {
    console.log("🔑 Regenerate backup codes request from:", req.user.email);

    const { password } = req.body;

    // Validate input
    if (!password) {
      return next(new AppError("Please provide your current password", 400));
    }

    // Check if 2FA is enabled
    if (!req.user.twoFactorAuth?.isEnabled) {
      return next(
        new AppError("Two-factor authentication is not enabled", 400)
      );
    }

    // ✅ FETCH USER WITH PASSWORD FIELD
    const userWithPassword = await User.findById(req.user._id).select(
      "+password"
    );

    if (!userWithPassword) {
      return next(new AppError("User not found", 404));
    }

    // Verify password using the fresh user object
    const isPasswordValid = await userWithPassword.comparePassword(password);

    if (!isPasswordValid) {
      console.log("❌ Invalid password provided for backup codes regeneration");
      return next(new AppError("Invalid password", 401));
    }

    console.log("✅ Password verified, generating new backup codes...");

    // Generate new backup codes
    const { generateBackupCodes } = await import(
      "../services/twoFactor.service.js"
    );
    const backupCodesResult = generateBackupCodes();

    console.log("🔍 Backup codes result:", {
      hasResult: !!backupCodesResult,
      hasPlainCodes: !!backupCodesResult?.plainCodes,
      hasHashedCodes: !!backupCodesResult?.hashedCodes,
      plainCodesLength: backupCodesResult?.plainCodes?.length,
      hashedCodesLength: backupCodesResult?.hashedCodes?.length,
    });

    // Validate the result
    if (
      !backupCodesResult ||
      !backupCodesResult.plainCodes ||
      !backupCodesResult.hashedCodes
    ) {
      console.error("❌ Invalid backup codes generation result");
      return next(new AppError("Failed to generate backup codes", 500));
    }

    // ✅ FIX: Use correct property names from service
    const { plainCodes: backupCodes, hashedCodes: hashedBackupCodes } =
      backupCodesResult;

    // Replace old backup codes with new ones
    userWithPassword.twoFactorAuth.backupCodes = hashedBackupCodes;
    userWithPassword.updatedAt = new Date();

    await userWithPassword.save();
    console.log("✅ New backup codes generated and saved");

    // Return new backup codes (only time they're shown in plain text)
    return res.status(200).json({
      success: true,
      message: "New backup codes generated successfully",
      data: {
        backupCodes: backupCodes, // Plain text codes (show once!)
        warning:
          "Save these codes securely. Old backup codes are no longer valid.",
        total: backupCodes.length,
        generated: new Date(),
        instructions: {
          step1: "Save these codes in a secure location",
          step2: "Each code can only be used once",
          step3: "Use these if you lose access to your authenticator app",
          step4: "Keep them separate from your device",
        },
      },
    });
  } catch (error) {
    console.error("❌ Regenerate Backup Codes Error:", error);
    next(new AppError("Failed to regenerate backup codes", 500));
  }
};

// ========== VERIFY 2FA LOGIN (Complete 2-Step Login) ==========
/**
 * POST /api/2fa/verify-login
 *
 * PURPOSE: Complete the 2-step login process
 * WHAT IT DOES:
 * 1. Validate temp user ID from login response
 * 2. Verify the 2FA token
 * 3. Generate JWT tokens
 * 4. Complete the login process
 */
export const verify2FALogin = async (req, res, next) => {
  try {
    console.log("🔐 2FA Login Verification Started");

    const { tempUserId, twoFactorToken, trustDevice = false } = req.body;

    // Validate input
    if (!tempUserId || !twoFactorToken) {
      return next(
        new AppError("Please provide tempUserId and twoFactorToken", 400)
      );
    }

    console.log("🔍 Verifying 2FA login for user:", tempUserId);

    // Find user with 2FA data
    const user = await User.findById(tempUserId).select(
      "+twoFactorAuth.secret +twoFactorAuth.backupCodes +twoFactorAuth.trustedDevices"
    );

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    if (!user.twoFactorAuth?.isEnabled) {
      return next(new AppError("2FA is not enabled for this user", 400));
    }

    // Check if user account is active
    if (user.accountStatus !== "active") {
      return next(
        new AppError("Account is not active. Please contact support.", 401)
      );
    }

    console.log("🔍 Attempting to verify 2FA token...");

    // Try to verify as TOTP token first
    let isValidToken = false;
    let isBackupCode = false;

    try {
      isValidToken = verifyTotpToken(twoFactorToken, user.twoFactorAuth.secret);
      console.log("🔍 TOTP verification result:", isValidToken);
    } catch (error) {
      console.log("❌ TOTP verification failed:", error.message);
    }

    // If TOTP fails, try backup codes
    if (!isValidToken) {
      console.log("🔍 Trying backup codes...");

      const backupCodeIndex = user.twoFactorAuth.backupCodes.findIndex(
        (bc) => !bc.used && bc.code === hashBackupCode(twoFactorToken)
      );

      if (backupCodeIndex !== -1) {
        isValidToken = true;
        isBackupCode = true;

        // Mark backup code as used
        user.twoFactorAuth.backupCodes[backupCodeIndex].used = true;
        user.twoFactorAuth.backupCodes[backupCodeIndex].usedAt = new Date();

        console.log("✅ Valid backup code used");
      }
    }

    if (!isValidToken) {
      console.log("❌ Invalid 2FA token");

      // Record failed attempt
      user.twoFactorAuth.failedAttempts =
        (user.twoFactorAuth.failedAttempts || 0) + 1;

      // Lock account after 5 failed attempts for 15 minutes
      if (user.twoFactorAuth.failedAttempts >= 5) {
        user.twoFactorAuth.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();

        return next(
          new AppError(
            "Account locked due to too many failed 2FA attempts. Try again in 15 minutes.",
            423
          )
        );
      }

      await user.save();
      return next(new AppError("Invalid 2FA token", 401));
    }

    console.log("✅ 2FA verification successful");

    // Reset failed attempts on successful verification
    user.twoFactorAuth.failedAttempts = 0;
    user.twoFactorAuth.lockUntil = undefined;
    user.twoFactorAuth.lastUsed = new Date();
    user.twoFactorAuth.totalUsage = (user.twoFactorAuth.totalUsage || 0) + 1;

    // Handle trusted device
    let deviceInfo = null;
    if (trustDevice) {
      const userAgent = req.headers["user-agent"] || "Unknown";
      const ipAddress = req.ip || req.connection.remoteAddress || "Unknown";

      deviceInfo = {
        id: new mongoose.Types.ObjectId(),
        name: `Device from ${ipAddress}`,
        userAgent,
        ipAddress,
        addedAt: new Date(),
        lastUsed: new Date(),
      };

      user.twoFactorAuth.trustedDevices.push(deviceInfo);
      console.log("✅ Device added to trusted devices");
    }

    // Record successful login
    await user.recordLogin(
      req,
      true,
      isBackupCode ? "2FA backup code" : "2FA TOTP"
    );

    await user.save();

    // Generate tokens
    const { generateTokens } = await import("../services/auth.service.js");
    const tokens = generateTokens(user._id);

    console.log("✅ 2FA login completed successfully");

    // Return success response
    return res.status(200).json({
      success: true,
      message: "Login successful with 2FA verification",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          accountStatus: user.accountStatus,
          emailVerifiedAt: user.emailVerifiedAt,
          twoFactorEnabled: user.twoFactorAuth?.isEnabled || false,
        },
        tokens,
        twoFactorVerified: true,
        usedBackupCode: isBackupCode,
        trustedDevice: trustDevice
          ? {
              id: deviceInfo?.id,
              name: deviceInfo?.name,
            }
          : null,
        security: {
          loginAt: new Date(),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers["user-agent"],
        },
      },
    });
  } catch (error) {
    console.error("❌ 2FA Login Verification Error:", error);
    next(new AppError("2FA verification failed", 500));
  }
};
