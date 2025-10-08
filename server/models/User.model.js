import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required."],
      trim: true,
      maxlength: [50, "Name must be less than 50 characters."],
    },
    email: {
      type: String,
      required: [true, "Email is required."],
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please fill a valid email address.",
      ],
    },
    password: {
      type: String,
      required: function () {
        // Password is required ONLY IF user doesn't have googleID not OAuth user
        return !this.googleId;
      },
      minlength: [8, "Password must be at least 8 characters."],
      select: false, // Do not return password field by default in queries
    },

    // *** Profile Information ***
    bio: {
      type: String,
      maxlength: [500, "Bio cannot exceed 500 characters."],
      trim: true,
      default: "",
    },

    phone: {
      type: String,
      trim: true,
      validate: {
        validator: function (phone) {
          if (!phone) return true; // Allow empty phone
          return /^[\+]?[1-9][\d]{0,15}$/.test(phone);
        },
        message: "Please provide a valid phone number.",
      },
    },

    location: {
      country: { type: String, trim: true },
      city: { type: String, trim: true },
    },

    // *** Email Verification ***
    isVerified: {
      type: Boolean,
      default: false,
    },
    otpCode: {
      type: String,
      select: false, // Do not return otpCode field by default in queries
    },
    otpExpiresAt: {
      type: Date,
      select: false, // Do not return otpExpiresAt field by default in queries
    },

    // *** Password Management ***
    passwordChangedAt: {
      type: Date,
      default: Date.now,
    },
    passwordExpiresAt: {
      type: Date,
      default: function () {
        // Set default password expiry to 90 days from creation
        const expiryDate = new Date();
        expiryDate.setDate(
          expiryDate.getDate() + (process.env.PASSWORD_EXPIRY_DAYS || 90)
        );
        return expiryDate;
      },
    },

    // *** Password Reset System ***
    resetPasswordToken: {
      type: String,
      select: false, // Do not return resetPasswordToken field by default in queries
    },
    resetPasswordExpires: {
      type: Date,
      select: false, // Do not return resetPasswordExpires field by default in queries
    },

    // *** JWT Token Management ***
    refreshTokens: [
      {
        token: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // *** OAuth Integration (Google) ***
    googleId: {
      type: String,
      sparse: true, // Allows multiple null values but unique non-null values
    },
    avatar: {
      type: String, // URL to the user's avatar image
    },

    // *** Account Management ***
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },

    // *** Account Management ***
    role: {
      type: String,
      enum: {
        values: ["user", "moderator", "admin"],
        message: "Role must be either 'user', 'moderator', or 'admin'.",
      },
      default: "user",
    },

    accountStatus: {
      type: String,
      enum: {
        values: ["active", "suspended", "banned", "pending"],
        message: "Invalid account status",
      },
      default: "active",
    },

    // *** Security and Tracking ***
    loginHistory: [
      {
        timestamp: { type: Date, default: Date.now },
        ip: { type: String },
        userAgent: { type: String },
        location: {
          country: { type: String, trim: true },
          city: { type: String, trim: true },
        },
        success: { type: Boolean, default: true },
        failureReason: { type: String },
      },
    ],
    accountLockout: {
      failedAttempts: { type: Number, default: 0 },
      lockUntil: Date,
    },

    // *** 2FA (Email-Based - FREE!) ***
    twoFactorAuth: {
      isEnabled: {
        type: Boolean,
        default: false,
      },
      secret: String,
      backupCodes: [String],
      lastUsed: Date,
    },
  },
  {
    timestamps: true, // Automatically manage createdAt and updatedAt fields
    toJSON: { virtuals: true }, // Include virtuals when converting to JSON
    toObject: { virtuals: true },
  }
);

// ==================== INDEXES ====================
// Improve query performance
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ resetPasswordToken: 1 });
userSchema.index({ "refreshTokens.token": 1 });

// ==================== VIRTUALS ====================
// *** Virtual field to check if password is expired ***
userSchema.virtual("isPasswordExpired").get(function () {
  return this.passwordExpiresAt < new Date();
});

// *** Virtual field to check if account is locked ***
userSchema.virtual("isLocked").get(function () {
  return !!(
    this.accountLockout.lockUntil && this.accountLockout.lockUntil > Date.now()
  );
});

// ==================== MIDDLEWARES ====================
// *** Hash password before saving ***
userSchema.pre("save", async function (next) {
  // Only hash the password if it's been modified (or is new)
  if (!this.isModified("password")) return next();

  // Don't hash if password is not provided (OAuth users)
  if (!this.password) return next();

  try {
    // Hash the password with a cost of 12
    this.password = await bcrypt.hash(this.password, 12);

    // Update password  change timestamp
    this.passwordChangedAt = new Date();

    // Set new password expiry date
    const expiryDate = new Date();
    expiryDate.setDate(
      expiryDate.getDate() + (process.env.PASSWORD_EXPIRY_DAYS || 90)
    );
    this.passwordExpiresAt = expiryDate;
    next();
  } catch (err) {
    return next(err);
  }
});

// *** Update lastLogin before saving ***
userSchema.pre("save", function (next) {
  if (this.isModified("lastLogin")) {
    this.lastLogin = new Date();
  }
  next();
});

// ==================== INSTANCE METHODS ====================
// *** Compare password method ***
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// *** Check if password was changed after JWT was issued ***
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// *** Add Refresh Token ***
userSchema.methods.addRefreshToken = function (token) {
  this.refreshTokens.push({ token });

  // Keep Only last 5 refresh tokens (security measure)
  if (this.refreshTokens.length > 5) {
    this.refreshTokens = this.refreshTokens.slice(-5);
  }

  // Return this for method chaining
  return this;
};

// *** Remove Specific Refresh Token ***
userSchema.methods.removeRefreshToken = function (token) {
  this.refreshTokens = this.refreshTokens.filter(
    (refreshTokens) => refreshTokens.token !== token
  );
};

// *** Remove all Refresh tokens (logout from all devices) ***
userSchema.methods.removeAllRefreshTokens = function () {
  this.refreshTokens = [];
};

// *** Generate OTP code ***
userSchema.methods.generateOTP = function () {
  // Generate a 6-digit OTP code
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Set OTP code and expiry (10 minutes from now)
  this.otpCode = otp;
  this.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  return otp;
};

// *** Verify OTP code ***
userSchema.methods.verifyOTP = function (candidateOTP) {
  // Check if OTP is exists and has not expired
  if (!this.otpCode || !this.otpExpiresAt) return false;
  if (this.otpExpiresAt < new Date()) return false;

  return this.otpCode === candidateOTP;
};

// *** Clear OTP after verification ***
userSchema.methods.clearOTP = function () {
  this.otpCode = undefined;
  this.otpExpiresAt = undefined;
};

// *** Create Password Reset Token ***
userSchema.methods.createPasswordResetToken = function () {
  // Generate a random token
  const resetToken = crypto.randomBytes(32).toString("hex");

  // Hash the token and store it in the database
  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Set token expiry (10 minutes from now)
  this.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);

  // Return the plain token (not hashed) to send via email
  return resetToken;
};

// *** Record Login Attempt ***
userSchema.methods.recordLogin = function (
  req,
  success = true,
  failureReason = null
) {
  // Add Login Record
  this.loginHistory.push({
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get("User-Agent"),
    success,
    failureReason,
    timestamp: new Date(),
  });

  // Keep only last 20 login attempts for performance
  if (this.loginHistory.length > 20) {
    this.loginHistory = this.loginHistory.slice(-20);
  }

  return this;
};

// *** Handle Failed Login Attempt ***
userSchema.methods.handleFailedLogin = function () {
  this.accountLockout.failedAttempts += 1;

  // Lock account after 5 failed attempts for  30 minutes
  if (this.accountLockout.failedAttempts >= 5) {
    this.accountLockout.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  }

  return this;
};

// *** Reset Failed Login Attempts ***
userSchema.methods.resetFailedAttempts = function () {
  this.accountLockout.failedAttempts = 0;
  this.accountLockout.lockUntil = undefined;
  return this;
};

// *** Enable 2FA ***
userSchema.methods.enable2FA = function () {
  // We'll implement this when we add 2FA feature
  this.twoFactorAuth.isEnabled = true;
  return this;
};

// *** Disable 2FA ***
userSchema.methods.disable2FA = function () {
  this.twoFactorAuth.isEnabled = false;
  this.twoFactorAuth.secret = undefined;
  this.twoFactorAuth.backupCodes = [];
  return this;
};

// ==================== STATIC METHODS ====================
// *** Find user by email (including unverified users) ***
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() });
};

// *** Find verified user by email ***
userSchema.statics.findVerifiedByEmail = function (email) {
  return this.findOne({
    email: email.toLowerCase(),
    isVerified: true,
    isActive: true,
  });
};

// *** Find user by google Id ***
userSchema.statics.findByGoogleId = function (googleId) {
  return this.findOne({
    googleId,
    isActive: true,
  });
};

// *** Find user by refresh token ***
userSchema.statics.findByRefreshToken = function (token) {
  return this.findOne({
    "refreshTokens.token": token,
    isActive: true,
  });
};

// ********** CREATE THE MODEL  **********
const User = mongoose.model("User", userSchema);
export default User;
