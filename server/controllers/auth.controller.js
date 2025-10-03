import { Auth } from "googleapis";
import User from "../models/User.model.js";
import {
  jwtService,
  emailService,
  otpService,
} from "../services/index.service.js";
import AppError from "../utils/AppError.js";

// ========== USER REGISTRATION ==========
/**
 * Register a new user account
 * POST /api/auth/register
 * Body: { name, email, password }
 **/

export const register = async (req, res, next) => {
  try {
    // Step 1: Extract data from request body
    const { name, email, password } = req.body;

    // Step 2: Validate required Fields
    if (!name || !email || !password) {
      return next(new AppError("Name, Email, and Password are required.", 400));
    }

    // Step 3: Validate email format
    if (!otpService.isValidEmail(email)) {
      return next(new AppError("Please provide a valid email address.", 400));
    }

    // Step 4: Validate password strength
    if (password.length < 8) {
      return next(
        new AppError("Password must be at least 8 characters long.", 400)
      );
    }

    // Step 5: Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      // If user exists but not verified, allow re-registration
      if (!existingUser.isVerified) {
        // Generate new OTP for existing unverified user
        const otp = existingUser.generateOTP();
        await existingUser.save();

        // Send new OTP email
        await emailService.sendOTPEmail(email, otp, existingUser.name);

        return res.status(200).json({
          success: true,
          message:
            "Account exists but not verified. New OTP sent to your email.",
          data: {
            email: existingUser.email,
            isVerified: false,
          },
        });
      }
      // User exists and is verified
      return next(
        new AppError("An Account with this email already exists.", 400)
      );
    }

    // Step 6: Create new user
    const newUser = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
    });

    // Step 7: Generate OTP
    const otp = newUser.generateOTP();

    // Step 8: Save user to database
    await newUser.save();

    // Step 9: Send OTP verification email
    await emailService.sendOTPEmail(newUser.email, otp, newUser.name);

    // Step 10: Return success response (don't send sensitive data)
    res.status(201).json({
      success: true,
      message:
        "Registration successful! Please check your email for verification code,",
      data: {
        userId: newUser._id,
        email: newUser.email,
        name: newUser.name,
        isVerified: newUser.isVerified,
      },
    });
  } catch (error) {
    console.error("Registration Error:", error);

    // Handle Specific MongoDB errors
    if (error.code === 11000) {
      return next(
        new AppError("An Account with this email already exists.", 409)
      );
    }

    // Handle Validation Errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return next(new AppError(messages.join(". "), 400));
    }
  }

  // Handle Generic Error
  next(new AppError("Registration failed. Please try again.", 500));
};
