import User from "../models/User.model.js";
import AppError from "../utils/AppError.js";
import {
  generateTwoFactorSecret,
  verifyTotpToken,
  verifyBackupCode,
  encryptSecret,
  generateDeviceId,
  parseDeviceInfo,
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

    // STEP 2: Generate 2FA secret and QR code
    const twoFactorData = await generateTwoFactorSecret(req.user);

    console.log("✅ 2FA secret and QR code generated");

    // STEP 3: Save temporary secret to database (not activated yet)
    const encryptedSecret = encryptSecret(twoFactorData.secret);

    req.user.twoFactorAuth.tempSecret = encryptedSecret;
    req.user.twoFactorAuth.backupCodes = twoFactorData.hashedBackupCodes;
    req.user.updatedAt = new Date();

    await req.user.save();

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
    const { token } = req.body;

    console.log("🔍 2FA setup verification from user:", req.user.email);

    // STEP 1: Validate input
    if (!token) {
      return next(new AppError("Please provide a verification token", 400));
    }

    // STEP 2: Check if user has temporary secret (setup in progress)
    if (!req.user.twoFactorAuth?.tempSecret) {
      return next(
        new AppError("No 2FA setup in progress. Please start setup first.", 400)
      );
    }

    // STEP 3: Check if setup has expired (10 minutes)
    if (isTwoFactorSetupExpired(req.user)) {
      // Clean up expired setup
      req.user.twoFactorAuth.tempSecret = undefined;
      req.user.twoFactorAuth.backupCodes = [];
      await req.user.save();

      return next(
        new AppError("2FA setup has expired. Please start setup again.", 400)
      );
    }

    // STEP 4: Verify the token
    const isValidToken = verifyTotpToken(
      token,
      req.user.twoFactorAuth.tempSecret
    );

    if (!isValidToken) {
      console.log("❌ Invalid verification token");
      return next(
        new AppError("Invalid verification code. Please try again.", 400)
      );
    }

    console.log("✅ 2FA verification successful");

    // STEP 5: Activate 2FA permanently
    req.user.twoFactorAuth.isEnabled = true;
    req.user.twoFactorAuth.secret = req.user.twoFactorAuth.tempSecret; // Move to permanent
    req.user.twoFactorAuth.tempSecret = undefined; // Clear temporary
    req.user.twoFactorAuth.setupAt = new Date();
    req.user.twoFactorAuth.lastUsed = new Date();
    req.user.twoFactorAuth.totalUsage = 1;
    req.user.twoFactorAuth.failedAttempts = 0;
    req.user.updatedAt = new Date();

    await req.user.save();

    console.log("✅ 2FA activated for user:", req.user.email);

    // STEP 6: Return success response
    return res.status(200).json({
      success: true,
      message: "Two-factor authentication has been successfully enabled",
      data: {
        isEnabled: true,
        setupAt: req.user.twoFactorAuth.setupAt,
        backupCodesCount: req.user.twoFactorAuth.backupCodes.filter(
          (c) => !c.used
        ).length,
        message: "Your account is now more secure with 2FA enabled!",
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
    const { password, confirmationCode } = req.body;

    console.log("🚫 2FA disable request from user:", req.user.email);

    // STEP 1: Security checks
    if (!password) {
      return next(
        new AppError("Please provide your password to disable 2FA", 400)
      );
    }

    // STEP 2: Verify password
    const isPasswordValid = await req.user.comparePassword(password);
    if (!isPasswordValid) {
      console.log("❌ Invalid password for 2FA disable");
      return next(new AppError("Invalid password. Cannot disable 2FA.", 401));
    }

    // STEP 3: Check if 2FA is enabled
    if (!req.user.twoFactorAuth?.isEnabled) {
      return next(
        new AppError("Two-factor authentication is not enabled", 400)
      );
    }

    // STEP 4: Verify current 2FA code (additional security)
    if (confirmationCode) {
      const isValidCode = verifyTotpToken(
        confirmationCode,
        req.user.twoFactorAuth.secret
      );
      if (!isValidCode) {
        return next(new AppError("Invalid 2FA code. Cannot disable 2FA.", 400));
      }
    }

    console.log("✅ Security checks passed for 2FA disable");

    // STEP 5: Disable 2FA completely
    req.user.twoFactorAuth.isEnabled = false;
    req.user.twoFactorAuth.secret = undefined;
    req.user.twoFactorAuth.tempSecret = undefined;
    req.user.twoFactorAuth.backupCodes = [];
    req.user.twoFactorAuth.trustedDevices = [];
    req.user.twoFactorAuth.failedAttempts = 0;
    req.user.twoFactorAuth.lockUntil = undefined;
    req.user.updatedAt = new Date();

    await req.user.save();

    console.log("✅ 2FA disabled for user:", req.user.email);

    // STEP 6: Return success response
    return res.status(200).json({
      success: true,
      message: "Two-factor authentication has been disabled",
      data: {
        isEnabled: false,
        disabledAt: new Date(),
        warning:
          "Your account security has been reduced. Consider re-enabling 2FA.",
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
    const { password } = req.body;

    console.log(
      "🔄 Regenerate backup codes request from user:",
      req.user.email
    );

    // Security checks
    if (!req.user.twoFactorAuth?.isEnabled) {
      return next(
        new AppError("2FA must be enabled to regenerate backup codes", 400)
      );
    }

    if (!password) {
      return next(new AppError("Please provide your password", 400));
    }

    const isPasswordValid = await req.user.comparePassword(password);
    if (!isPasswordValid) {
      return next(new AppError("Invalid password", 401));
    }

    // Generate new backup codes
    const { generateBackupCodes } = await import(
      "../services/twoFactor.service.js"
    );
    const newBackupCodes = generateBackupCodes();

    // Update user with new backup codes
    req.user.twoFactorAuth.backupCodes = newBackupCodes.hashedCodes;
    req.user.updatedAt = new Date();

    await req.user.save();

    console.log("✅ Backup codes regenerated for user:", req.user.email);

    return res.status(200).json({
      success: true,
      message: "New backup codes generated successfully",
      data: {
        backupCodes: newBackupCodes.plainCodes,
        warning:
          "Save these codes securely. Old backup codes are no longer valid.",
        generated: new Date(),
      },
    });
  } catch (error) {
    console.error("❌ Regenerate Backup Codes Error:", error);
    next(new AppError("Failed to regenerate backup codes", 500));
  }
};

// ========== VERIFY 2FA DURING LOGIN ==========
/**
 * POST /api/auth/verify-2fa
 *
 * PURPOSE: Verify 2FA code during login process
 * USED BY: Authentication middleware
 */
export const verify2FALogin = async (req, res, next) => {
  try {
    const { token, backupCode, trustDevice } = req.body;
    const { tempUserId } = req; // Set by auth middleware

    console.log("🔐 2FA login verification for user ID:", tempUserId);

    // Find user
    const user = await User.findById(tempUserId).select(
      "+twoFactorAuth.secret +twoFactorAuth.backupCodes"
    );
    if (!user || !user.twoFactorAuth?.isEnabled) {
      return next(new AppError("2FA verification not required", 400));
    }

    // Check if 2FA is locked
    if (user.isTwoFactorLocked()) {
      const lockTime = Math.ceil(
        (user.twoFactorAuth.lockUntil - new Date()) / 60000
      );
      return next(
        new AppError(`2FA is locked. Try again in ${lockTime} minutes.`, 423)
      );
    }

    let isValid = false;
    let usedBackupCode = false;

    // Verify TOTP token
    if (token) {
      isValid = verifyTotpToken(token, user.twoFactorAuth.secret);
    }
    // Or verify backup code
    else if (backupCode) {
      const backupResult = verifyBackupCode(
        backupCode,
        user.twoFactorAuth.backupCodes
      );
      if (backupResult.valid) {
        isValid = true;
        usedBackupCode = true;

        // Mark backup code as used
        user.twoFactorAuth.backupCodes[backupResult.codeIndex].used = true;
        user.twoFactorAuth.backupCodes[backupResult.codeIndex].usedAt =
          new Date();
      }
    } else {
      return next(
        new AppError("Please provide either a 2FA token or backup code", 400)
      );
    }

    if (!isValid) {
      // Handle failed attempt
      user.handleTwoFactorFailedAttempt();
      await user.save();

      return next(new AppError("Invalid 2FA code or backup code", 401));
    }

    // Successful verification
    user.resetTwoFactorFailedAttempts();
    user.updateTwoFactorUsage();

    // Handle device trust
    if (trustDevice && req.headers["user-agent"]) {
      const deviceId = generateDeviceId(req.headers["user-agent"], req.ip);
      const deviceInfo = parseDeviceInfo(req.headers["user-agent"]);

      user.addTrustedDevice({
        deviceId,
        deviceName: `${deviceInfo.browser} on ${deviceInfo.os}`,
        userAgent: req.headers["user-agent"],
        ipAddress: req.ip,
      });
    }

    await user.save();

    console.log("✅ 2FA verification successful for user:", user.email);

    // Continue to complete login (handled by auth controller)
    req.user = user;
    req.verified2FA = true;
    req.usedBackupCode = usedBackupCode;

    next(); // Continue to complete login
  } catch (error) {
    console.error("❌ 2FA Login Verification Error:", error);
    next(new AppError("2FA verification failed", 500));
  }
};
