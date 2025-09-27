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

  // ***  ***
}
