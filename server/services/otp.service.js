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

  // ***  ***
}
