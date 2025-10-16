import speakeasy from "speakeasy";
import QRCode from "qrcode";
import crypto from "crypto";
import AppError from "../utils/AppError";

/**
 * Two-Factor Authentication Service
 *
 * SIMPLE EXPLANATION:
 * This is the "2FA brain" that handles all TOTP operations:
 *  1. Create secret keys for users
 *  2. Generate QR codes for phone apps to scan
 *  3. Validates 6 digit codes from phone apps
 *  4. Manages backup recovery codes
 *  5. Encrypts everything for security
 */

// ===== SECRET ENCRYPTION (Security Layer) =====
/**
 * Encrypt the 2FA secret before storing in DB
 * Uses your TWO_FACTOR_ENCRYPTION_KEY from .env
 */
const encrypt2FASecret = (secret) => {
  const encryptionKey = process.env.TWO_FACTOR_ENCRYPTION_KEY;

  // Security check
  if (!encryptionKey) {
    throw new AppError(
      "TWO_FACTOR_ENCRYPTION_KEY not configured in environment variables",
      500
    );
  }

  if (encryptionKey.length < 32) {
    throw new AppError(
      "TWO_FACTOR_ENCRYPTION_KEY must be at least 32 characters",
      500
    );
  }

  try {
    const algorithm = "aes-256-cbc";
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, encryptionKey);

    let encrypted = cipher.update(secret, "utf8", "hex");
    encrypted += cipher.final("hex");

    return iv.toString("hex") + ":" + encrypted;
  } catch (error) {
    console.error("❌ Encryption error:", error);
    throw new AppError("Failed to encrypt 2FA secret", 500);
  }
};

/**
 * Decrypt 2FA secret when validating codes
 */
const decrypt2FASecret = (encryptedSecret) => {
  const encryptionKey = process.env.TWO_FACTOR_ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new AppError("TWO_FACTOR_ENCRYPTION_KEY not configured", 500);
  }

  try {
    const algorithm = "aes-256-cbc";
    const textParts = encryptedSecret.split(":");
    const iv = Buffer.from(textParts.shift(), "hex");
    const encryptedText = textParts.join(":");

    const decipher = crypto.createDecipher(algorithm, encryptionKey);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("❌ Decryption error:", error);
    throw new AppError("Failed to decrypt 2FA secret", 500);
  }
};

// ===== GENERATE SECRET & QR CODE =====
/**
 * Generate TOTP secret and QR code for user
 *
 * WHAT IT RETURNS:
 *  - secret            : Secret key to save in database (encrypted)
 *  - qrCodeUrl         : QR code image as base64 (show to user)
 *  - manualEntryKey    : Secret key as text (if user can't scan QR)
 *  - backupCodes       : Recovery codes (show once, then hide)
 */
export const generateTwoFactorSecret = async (user) => {
  try {
    console.log("🔐 Generating 2FA setup for user:", user.email);

    // Step 1: Generate unique secret for this user
    const secret = speakeasy.generateSecret({
      name: `${user.name} (${user.email})`,
      issuer: process.env.APP_NAME || "simpleAuth",
      length: 32, // 32 characters = very secure
    });

    console.log("✅ Secret generated successfully");

    // Step 2: Create QR code image
    const qrCodeDataURL = await QRCode.toDataURL(secret.otpauth_url, {
      errorCorrectionLevel: "H", // High error correction
      type: "image/png",
      quality: 0.92,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
      width: 300,
    });

    console.log("✅ QR code generated successfully");

    // Step 3: Generate backup recovery codes
    const backupCodes = generateBackupCodes();

    // Step 4: Return everything needed for 2FA setup
    return {
      secret: secret.base32,
      qrCodeUrl: qrCodeDataURL,
      manualEntryKey: secret.base32,
      otpauthUrl: secret.otpauth_url,
      backupCodes: backupCodes.plainCodes,
      hashedBackupCodes: backupCodes.hashedCodes,
      issuer: process.env.APP_NAME || "simpleAuth",
    };
  } catch (error) {
    console.error("❌ Generate 2FA Secret Error:", error);
    throw new AppError("Failed to generate 2FA setup. Please try again.", 500);
  }
};

// ===== VERIFY TOTP TOKEN =====
/**
 * Verify 6-digit code from user's authenticator app
 *
 * PARAMETERS:
 *  - token: 6-digit code user entered
 *  - encryptedSecret: User's encrypted 2FA secret from DB
 *  - window: Time tolerance (default: 2 = ±1 minute)
 */
export const verifyTotpToken = (token, encryptedSecret, window = 2) => {
  try {
    console.log("🔍 Verifying TOTP token...");

    // Input validation
    if (!token || !encryptedSecret) {
      console.log("❌ Missing token or secret");
      return false;
    }

    // Clean token (remove spaces, ensure 6 digits)
    const cleanToken = token.toString().replace(/\s/g, "");
    if (cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) {
      console.log("❌ Invalid token format");
      return false;
    }

    // Decrypt secret
    const secret = decrypt2FASecret(encryptedSecret);

    // Verify token using speakeasy
    const isValid = speakeasy.totp.verify({
      secret: secret,
      encoding: "base32",
      token: cleanToken,
      window: window, // Accept codes from ±window time periods
    });

    console.log("🔍 TOTP verification result:", {
      token: cleanToken,
      isValid,
      window,
    });

    return isValid;
  } catch (error) {
    console.error("❌ TOTP Verification Error:", error);
    return false;
  }
};

// ===== BACKUP CODES =====
/**
 * Generate backup recovery codes
 * Creates 10 single-use recovery codes
 */
export const generateBackupCodes = () => {
  try {
    console.log("🔑 Generating backup codes...");

    const codes = [];
    const hashedCodes = [];

    // Generate 10 backup codes
    for (let i = 0; i < 10; i++) {
      // Generate 8-character alphanumeric code
      const code = crypto.randomBytes(4).toString("hex").toUpperCase();

      // Hash the code for secure storage
      const hashedCode = crypto.createHash("sha256").update(code).digest("hex");

      codes.push(code);
      hashedCodes.push({
        code: hashedCode,
        used: false,
        usedAt: null,
      });
    }

    console.log("✅ Generated 10 backup codes");

    return {
      plainCodes: codes,
      hashedCodes: hashedCodes,
    };
  } catch (error) {
    console.error("❌ Generate Backup Codes Error:", error);
    throw new AppError("Failed to generate backup codes", 500);
  }
};

/**
 * Verify backup recovery code
 */
export const verifyBackupCode = (inputCode, storedCodes) => {
  try {
    console.log("🔑 Verifying backup code...");

    if (!inputCode || !storedCodes || storedCodes.length === 0) {
      return { valid: false, codeIndex: -1 };
    }

    // Clean and hash input code
    const cleanCode = inputCode.toString().trim().toUpperCase();
    const hashedInput = crypto
      .createHash("sha256")
      .update(cleanCode)
      .digest("hex");

    // Find matching unused code
    const codeIndex = storedCodes.findIndex(
      (codeObj) => codeObj.code === hashedInput && !codeObj.used
    );

    const isValid = codeIndex !== -1;

    console.log("🔑 Backup code verification:", {
      isValid,
      codeIndex,
      totalCodes: storedCodes.length,
      usedCodes: storedCodes.filter((c) => c.used).length,
    });

    return { valid: isValid, codeIndex };
  } catch (error) {
    console.error("❌ Backup Code Verification Error:", error);
    return { valid: false, codeIndex: -1 };
  }
};

// ===== DEVICE MANAGEMENT =====
/**
 * Generate unique device ID from user agent and IP
 */
export const generateDeviceId = (userAgent, ipAddress) => {
  const deviceString = `${userAgent}-${ipAddress}-${Date.now()}`;
  return crypto
    .createHash("sha256")
    .update(deviceString)
    .digest("hex")
    .substring(0, 16);
};

/**
 * Parse user agent to get device info
 */
export const parseDeviceInfo = (userAgent) => {
  // Simple user agent parsing (you can use a library like 'ua-parser-js' for better parsing)
  const deviceInfo = {
    browser: "Unknown",
    os: "Unknown",
    deviceType: "desktop",
  };

  if (userAgent) {
    // Browser detection
    if (userAgent.includes("Chrome")) deviceInfo.browser = "Chrome";
    else if (userAgent.includes("Firefox")) deviceInfo.browser = "Firefox";
    else if (userAgent.includes("Safari")) deviceInfo.browser = "Safari";
    else if (userAgent.includes("Edge")) deviceInfo.browser = "Edge";

    // OS detection
    if (userAgent.includes("Windows")) deviceInfo.os = "Windows";
    else if (userAgent.includes("macOS") || userAgent.includes("Mac OS"))
      deviceInfo.os = "macOS";
    else if (userAgent.includes("Linux")) deviceInfo.os = "Linux";
    else if (userAgent.includes("Android")) deviceInfo.os = "Android";
    else if (
      userAgent.includes("iOS") ||
      userAgent.includes("iPhone") ||
      userAgent.includes("iPad")
    )
      deviceInfo.os = "iOS";

    // Device type detection
    if (userAgent.includes("Mobile") || userAgent.includes("Android"))
      deviceInfo.deviceType = "mobile";
    else if (userAgent.includes("Tablet") || userAgent.includes("iPad"))
      deviceInfo.deviceType = "tablet";
  }

  return deviceInfo;
};

// ===== UTILITY FUNCTIONS =====
/**
 * Encrypt secret for database storage
 */
export const encryptSecret = encrypt2FASecret;

/**
 * Check if 2FA setup has expired (temp secret older than 10 minutes)
 */
export const isTwoFactorSetupExpired = (user) => {
  if (!user.twoFactorAuth?.tempSecret) return true;

  const setupTime = user.updatedAt;
  const expirationTime = 10 * 60 * 1000; // 10 minutes

  return Date.now() - setupTime.getTime() > expirationTime;
};

/**
 * Generate current TOTP code (for testing purposes)
 */
export const getCurrentCode = (secret) => {
  try {
    return speakeasy.totp({
      secret: secret,
      encoding: "base32",
    });
  } catch (error) {
    console.error("❌ Get Current Code Error:", error);
    return null;
  }
};

/**
 * Validate encryption key on service startup
 */
export const validateEncryptionKey = () => {
  const key = process.env.TWO_FACTOR_ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      "TWO_FACTOR_ENCRYPTION_KEY not found in environment variables"
    );
  }

  if (key.length < 32) {
    throw new Error(
      "TWO_FACTOR_ENCRYPTION_KEY must be at least 32 characters long"
    );
  }

  console.log("✅ 2FA encryption key validated");
  return true;
};
