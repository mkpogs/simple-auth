import mongoose from "mongoose";
import bcrypt from "bcryptjs";

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
      unique: true,
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
  },
  {
    timestamps: true, // Automatically manage createdAt and updatedAt fields
    toJSON: { virtuals: true }, // Include virtuals when converting to JSON
    toObject: { virtuals: true },
  }
);

// ==================== INDEXES ====================
// Improve query performance
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ resetPasswordToken: 1 });
userSchema.index({ "refreshTokens.token": 1 });

// ==================== VIRTUALS ====================
// Virtual field to check if password is expired
userSchema.virtual("isPasswordExpired").get(function () {
  return this.passwordExpiresAt < new Date();
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
userSchema.methods.addRefreshToken = async function (token) {
  this.refreshTokens.push({ token });

  // Keep Only last 5 refresh tokens (security measure)
  if (this.refreshTokens.length > 5) {
    this.refreshTokens = this.refreshTokens.slice(-5);
  }
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
