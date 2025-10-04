import User from "../models/User.model.js";
import crypto from "crypto";
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
    return res.status(201).json({
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

// ========== OTP VERIFICATION ==========
/**
 * Verify user's email with OTP code
 * POST /api/auth/verify-otp
 * Body: { email, otp }
 **/
export const verifyOTP = async (req, res, next) => {
  try {
    // Step 1: Extract data from request body
    const { email, otp } = req.body;

    // Step 2: Validate required fields
    if (!email || !otp) {
      return next(new AppError("Email and OTP are required.", 400));
    }

    // Step 3: Validate OTP format
    if (!otpService.isValidOTPFormat(otp)) {
      return next(
        new AppError("Invalid OTP format. OTP must be 6 digits", 400)
      );
    }

    // Step 4: Find user by email
    const user = await User.findByEmail(email).select("+otpCode +otpExpiresAt");
    if (!user) {
      return next(new AppError("User not found.", 404));
    }

    // Step 5: Validate if User is already verified
    if (user.isVerified) {
      return next(new AppError("Account is already verified.", 400));
    }

    // Step 6: Verify OTP (convert to string to handle both number and string inputs)
    if (!user.verifyOTP(String(otp))) {
      return next(new AppError("Invalid or Expired OTP.", 400));
    }

    // Step 7: Update user as verified
    user.isVerified = true;
    user.clearOTP(); // Remove OTP data
    user.lastLogin = new Date(); // Update last login
    await user.save();

    // Step 8: Generate JWT tokens
    const tokens = jwtService.generateTokenPair(user);

    // Step 9: Add refresh token to user
    user.addRefreshToken(tokens.refreshToken);
    await user.save();

    // Step 10: Send Welcome Email (non-blocking)
    emailService
      .sendWelcomeEmail(user.email, user.name)
      .catch((err) => console.error("Welcome email failed:", err));

    // Step 11: Return success response with tokens
    res.status(200).json({
      success: true,
      message: "Email verified successfully! Welcome aboard.",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          isVerified: user.isVerified,
          avatar: user.avatar,
        },
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
      },
    });
  } catch (error) {
    console.error("OTP Verification Error:", error);
    next(new AppError("OTP verification failed. Please try again.", 500));
  }
};

// ========== RESEND OTP ==========
/**
 * Resend OTP code to user's email
 * POST /api/auth/resend-otp
 * Body: { email }
 **/
export const resendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Validate required fields
    if (!email) {
      return next(new AppError("Email is required", 400));
    }

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Check if user is already verified
    if (user.isVerified) {
      return next(new AppError("Account is already verified", 400));
    }

    // Generate new OTP
    const otp = user.generateOTP();
    await user.save();

    // Send OTP email
    await emailService.sendOTPEmail(email, otp, user.name);

    res.status(200).json({
      success: true,
      message: "New OTP sent to your email successfully.",
      data: {
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    next(new AppError("Failed to resend OTP. Please try again.", 500));
  }
};

// ========== USER LOGIN ==========
/**
 * User Login with Email and Password
 * POST /api/auth/login
 * Body: { email, password }
 **/
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return next(new AppError("Email and Password are required", 400));
    }

    // Find user and include password field
    const user = await User.findByEmail(email).select("+password");
    if (!user) {
      return next(new AppError("Invalid email or password", 401));
    }

    // Validate if user is verified
    if (!user.isVerified) {
      return next(
        new AppError("Account not verified. Please verify your email.", 401)
      );
    }

    // Check password
    if (!(await user.comparePassword(password))) {
      return next(new AppError("Invalid email or password", 401));
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate Tokens
    const tokens = jwtService.generateTokenPair(user);

    // Add refresh token to user
    user.addRefreshToken(tokens.refreshToken);
    await user.save();

    // Return response with tokens
    return res.status(200).json({
      success: true,
      message: "Login successful!",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          isVerified: user.isVerified,
          avatar: user.avatar,
          lastLogin: user.lastLogin,
        },
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    next(new AppError("Login failed. Please try again.", 500));
  }
};

// ========== USER LOGOUT ==========
/**
 * User Logout (Invalidate refresh token)
 * POST /api/auth/logout
 * Body: { refreshToken }
 **/
export const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    // Validate if there is a refresh token
    if (!refreshToken) {
      return next(new AppError("Refresh token is required", 400));
    }

    // Find user by refresh token
    const user = await User.findOne({ "refreshTokens.token": refreshToken });

    if (user) {
      // Remove specific refresh token
      user.refreshTokens = user.refreshTokens.filter(
        (token) => token.token !== refreshToken
      );

      await user.save();
    }

    // Return response
    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout Error:", error);
    next(new AppError("Logout failed. Please try again.", 500));
  }
};

// ========== REFRESH ACCESS TOKEN ==========
/**
 * Refresh Access Token
 * POST /api/auth/refresh-token
 * Body: { refreshToken }
 **/
export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    // Validate if there is a refresh token
    if (!refreshToken) {
      return next(new AppError("Refresh token is required", 400));
    }

    // Verify refresh token
    const decoded = jwtService.verifyRefreshToken(refreshToken);

    // Find User
    const user = await User.findById(decoded.id).select("+refreshTokens");
    if (!user) {
      return next(new AppError("Invalid Refresh Token", 401));
    }

    // Check if refresh token exists in user's tokens
    const tokenExists = user.refreshTokens.some(
      (token) => token.token === refreshToken
    );

    if (!tokenExists) {
      return next(new AppError("Invalid Refresh Token", 401));
    }

    // Generate new access token
    const newAccessToken = jwtService.generateAccessToken(user);

    // Return a response
    return res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        accessToken: newAccessToken,
      },
    });
  } catch (error) {
    console.error("Refresh Token Error:", error);
    next(new AppError("Token refresh failed.", 401));
  }
};

// ========== FORGOT PASSWORD ==========
/**
 * Request password reset
 * POST /api/auth/forgot-password
 * Body: { email }
 **/
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Validate required fields
    if (!email) {
      return next(new AppError("Email is required", 400));
    }

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Generate reset token
    const resetToken = user.createPasswordResetToken();
    await user.save();

    // Send reset email
    await emailService.sendPasswordResetEmail(
      user.email,
      resetToken,
      user.name
    );

    // Return response
    return res.status(200).json({
      success: true,
      message: "Password reset link sent to your email.",
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    next(new AppError("Failed to sent reset email.", 500));
  }
};

// ========== RESET PASSWORD ==========
/**
 * Reset password with token
 * POST /api/auth/reset-password
 * Body: { token, password, confirmPassword }
 **/
export const resetPassword = async (req, res, next) => {
  try {
    const { token, password, confirmPassword } = req.body;

    // Validate required fields
    if (!token || !password || !confirmPassword) {
      return next(new AppError("All fields are required", 400));
    }

    // Validate password match
    if (password !== confirmPassword) {
      return next(new AppError("Passwords do not match", 400));
    }

    // Validate password strength
    if (password.length < 8) {
      return next(
        new AppError("Password must be at least 8 characters long", 400)
      );
    }

    // Hash the token (since we store hashed tokens)
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user by reset token and check if token is not expired
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    }).select("+password");

    if (!user) {
      return next(new AppError("Token is invalid or has expired", 400));
    }

    // Check if user is verified
    if (!user.isVerified) {
      return next(new AppError("Please verify your email first", 401));
    }

    // Update password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.passwordChangedAt = new Date();

    // Save user (password will be hashed by pre-save middleware)
    await user.save();

    // Invalidate all refresh tokens for security
    user.refreshTokens = [];
    await user.save();

    // Generate new tokens
    const tokens = jwtService.generateTokenPair(user);

    // Add new refresh token
    user.addRefreshToken(tokens.refreshToken);
    await user.save();

    // Send password changed notification email (non-blocking)
    emailService
      .sendPasswordChangedEmail(user.email, user.name)
      .catch((err) => console.error("Password changed email failed:", err));

    // Return success response
    return res.status(200).json({
      success: true,
      message: "Password reset successful! You are now logged in.",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          isVerified: user.isVerified,
          avatar: user.avatar,
          passwordChangedAt: user.passwordChangedAt,
        },
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
      },
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    next(new AppError("Password reset failed. Please try again.", 500));
  }
};
