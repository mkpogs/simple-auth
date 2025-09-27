import crypto from "crypto";
import bcrypt from "bcryptjs";
import AppError from "../utils/AppError.js";

class OTPService {
  // *** Generate a 6-digit OTP code ***
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // *** Generate secure random token for password reset ***
  generateResetToken() {
    return crypto.randomBytes(32).toString("hex");
  }

  // *** Hash OTP for storage (optional security layer) ***
  async hashOTP(otp) {
    try {
      return await bcrypt.hash(otp, 12);
    } catch (error) {
      throw new AppError("Failed to hash OTP", 500);
    }
  }

  // *** Verify hashed OTP (if using hashed storage) ***
  async verifyHashedOTP(plainOTP, hashedOTP) {
    try {
      return await bcrypt.compare(plainOTP, hashedOTP);
    } catch (error) {
      throw new AppError("Failed to verify OTP", 500);
    }
  }

  // *** Generate OTP with expiry ***
  generateOTPWithExpiry(expiryMinutes = 10) {
    const otp = this.generateOTP();
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    return {
      otp,
      expiresAt,
    };
  }

  // *** Validate OTP Format ***
  isValidOTPFormat(otp) {
    // Check if OTP is a 6-digit number
    const otpRegex = /^\d{6}$/;
    return otpRegex.test(otp);
  }

  // *** Validate if OTP is expired ***
  isOTPExpired(expiryDate) {
    return new Date() > expiryDate;
  }

  // *** Generate verification code for different purposes ***
  generateVerificationCode(type = "email", length = 6) {
    switch (type) {
      case "email":
        // 6-digit numeric OTP for email verification
        return Math.floor(100000 + Math.random() * 900000).toString();

      case "sms":
        // 4-digit numeric OTP for SMS (shorter for mobile)
        return Math.floor(1000 + Math.random() * 9000).toString();

      case "reset":
        // 32-character hex token for password reset
        return crypto.randomBytes(32).toString("hex");

      case "alphanumeric":
        // Alphanumeric code
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let result = "";
        for (let i = 0; i < length; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;

      default:
        return this.generateOTP();
    }
  }

  // *** Rate limiting helper - check if too many OTP requests ***
  checkOTPRateLimit(lastOTPSent, cooldownMinutes = 1) {
    if (!lastOTPSent) return true; // First request

    const cooldownPeriod = cooldownMinutes * 60 * 1000; // Convert to milliseconds
    const timeSinceLastOTP = Date.now() - lastOTPSent.getTime();

    return timeSinceLastOTP >= cooldownPeriod;
  }

  // *** Generate OTP attempt tracking ***
  createOTPAttempt(ip, email) {
    return {
      ip,
      email: email.toLowerCase(),
      timestamp: new Date(),
      attempts: 1,
    };
  }

  // *** Security: Generate cryptographically secure random bytes ***
  generateSecureToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString("hex");
  }

  // *** Validate password reset token format ***
  isValidResetToken(token) {
    // Check if token is 64-character hex string
    const tokenRegex = /^[a-f0-9]{64}$/i;
    return tokenRegex.test(token);
  }

  // *** Generate time-based hash for additional security ***
  generateTimeBasedHash(data, timeWindow = 300000) {
    // 5 minutes default
    const currentTime = Math.floor(Date.now() / timeWindow);
    const hashData = `${data}_${currentTime}`;
    return crypto.createHash("sha256").update(hashData).digest("hex");
  }

  // *** Verify time-based hash ***
  verifyTimeBasedHash(data, hash, timeWindow = 300000) {
    // Check current time window
    const currentHash = this.generateTimeBasedHash(data, timeWindow);
    if (currentHash === hash) return true;

    // Check previous time window (for edge cases)
    const previousTime = Math.floor(Date.now() / timeWindow) - 1;
    const previousHashData = `${data}_${previousTime}`;
    const previousHash = crypto
      .createHash("sha256")
      .update(previousHashData)
      .digest("hex");

    return previousHash === hash;
  }

  // *** Clean up expired OTP records (utility function) ***
  isExpiredOTP(createdAt, expiryMinutes = 10) {
    const expiryTime = new Date(
      createdAt.getTime() + expiryMinutes * 60 * 1000
    );
    return new Date() > expiryTime;
  }

  // *** Format OTP for display (with spaces) ***
  formatOTPForDisplay(otp) {
    // Format 123456 as "123 456" for better readability
    return otp.replace(/(\d{3})(\d{3})/, "$1 $2");
  }

  // *** Mask OTP for logging (security) ***
  maskOTPForLogging(otp) {
    if (!otp || otp.length < 4) return "***";
    return otp.substring(0, 2) + "****";
  }

  // *** Generate backup codes (for 2FA recovery) ***
  generateBackupCodes(count = 8) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = this.generateVerificationCode("alphanumeric", 8);
      codes.push(code);
    }
    return codes;
  }

  // *** Validate email format (helper) ***
  isValidEmail(email) {
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    return emailRegex.test(email);
  }
}

export default new OTPService();
