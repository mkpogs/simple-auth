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
