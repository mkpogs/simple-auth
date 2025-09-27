import crypto from "crypto";
import bcrypt from "bcryptjs";
import AppError from "../utils/AppError";

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
    return newDate() > expiryDate;
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

  // ***  ***
}
