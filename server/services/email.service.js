import nodemailer from "nodemailer";
import AppError from "../utils/AppError.js";

const EMAIL_FROM = process.env.EMAIL_FROM;
const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = process.env.EMAIL_PORT;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const CLIENT_URL = process.env.CLIENT_URL;

class EmailService {
  constructor() {
    // Initialize email transporter
    this.transporter = nodemailer.createTransport();
  }

  //   *** Create email transporter ***
  createTransporter() {
    return nodemailer.createTransporter({
      host: EMAIL_HOST,
      port: parseInt(EMAIL_PORT) || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });
  }

  //   *** Send OTP verification email ***
  async sendOTPEmail(email, otp, name) {
    try {
      const mailOptions = {
        from: EMAIL_FROM,
        to: email,
        subject: "Verify Your Account - OTP Code",
        html: this.getOTPEmailTemplate(name, otp),
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`OTP email sent to ${email}: ${info.messageId}`);
      return info;
    } catch (error) {
      console.error(`Error sending OTP email to ${email}:`, error);
      throw new AppError(`Failed to send verification email.`, 500);
    }
  }

  //   *** Send password reset email ***
  async sendPasswordResetEmail(email, resetToken, name) {
    try {
      const resetURL = `${CLIENT_URL}/reset-password/${resetToken}`;

      const mailOptions = {
        from: EMAIL_FROM,
        to: email,
        subject: "Password Reset Request",
        html: this.getPasswordResetEmailTemplate(name, resetURL),
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`Password reset email sent to ${email}: ${info.messageId}`);
      return info;
    } catch (error) {
      console.error(`Error sending password reset email to ${email}:`, error);
      throw new AppError(`Failed to send password reset email.`, 500);
    }
  }

  //   *** Send Welcome email after successful verification ***
  async sendWelcomeEmail(email, name) {
    try {
      const mailOptions = {
        from: EMAIL_FROM,
        to: email,
        subject: "Welcome to our platform!",
        html: this.getWelcomeEmailTemplate(name),
      };
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`Welcome email sent to ${email}: ${info.messageId}`);
      return info;
    } catch (error) {
      console.error(`Error sending welcome email to ${email}:`, error);
      throw new AppError(`Failed to send welcome email.`, 500);
    }
  }

  //   *** Send Password change notification ***
  async sendPasswordChangeNotification(email, name) {
    try {
      const mailOptions = {
        from: EMAIL_FROM,
        to: email,
        subject: "Password Changed Successfully",
        html: this.getPasswordChangeNotificationTemplate(name),
      };

      const info = await this.transporter.sendMail(mailOptions);
      return info;
    } catch (error) {
      console.error(
        `Error sending password change notification to ${email}:`,
        error
      );
      throw new AppError(`Failed to password change notification email.`, 500);
    }
  }

  //   ===== Email Templates =====
  //   *** OTP Email Template ***
  getOTPEmailTemplate(name, otp) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin-bottom: 10px;">Verify Your Account</h1>
          <p style="color: #666;">Hello ${name},</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
          <p style="margin-bottom: 20px; color: #333; font-size: 16px;">Your verification code is:</p>
          <div style="background-color: #007bff; color: white; padding: 15px 30px; border-radius: 5px; font-size: 32px; font-weight: bold; letter-spacing: 5px; display: inline-block;">
            ${otp}
          </div>
        </div>
        
        <div style="color: #666; font-size: 14px; line-height: 1.5;">
          <p><strong>Important:</strong></p>
          <ul style="margin-left: 20px;">
            <li>This code will expire in <strong>10 minutes</strong></li>
            <li>Do not share this code with anyone</li>
            <li>If you didn't request this code, please ignore this email</li>
          </ul>
        </div>
        
        <div style="margin-top: 30px; text-align: center; color: #999; font-size: 12px;">
          <p>This is an automated message, please do not reply to this email.</p>
        </div>
      </div>
    `;
  }

  //   *** Password Reset Email Template ***
  getPasswordResetEmailTemplate(name, resetURL) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin-bottom: 10px;">Password Reset Request</h1>
          <p style="color: #666;">Hello ${name},</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 30px;">
          <p style="color: #333; font-size: 16px; line-height: 1.5; margin-bottom: 25px;">
            We received a request to reset your password. Click the button below to create a new password:
          </p>
          
          <div style="text-align: center;">
            <a href="${resetURL}" style="background-color: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Reset Password
            </a>
          </div>
        </div>
        
        <div style="color: #666; font-size: 14px; line-height: 1.5;">
          <p><strong>Important:</strong></p>
          <ul style="margin-left: 20px;">
            <li>This link will expire in <strong>1 hour</strong></li>
            <li>If you didn't request this reset, please ignore this email</li>
            <li>Your password will remain unchanged until you create a new one</li>
          </ul>
        </div>
        
        <div style="margin-top: 30px; text-align: center; color: #999; font-size: 12px;">
          <p>If the button doesn't work, copy and paste this link: ${resetURL}</p>
        </div>
      </div>
    `;
  }

  //   *** Welcome Email Template ***
  getWelcomeEmailTemplate(name) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #28a745; margin-bottom: 10px;">Welcome to Our Platform!</h1>
          <p style="color: #666; font-size: 18px;">Hello ${name},</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 30px;">
          <p style="color: #333; font-size: 16px; line-height: 1.5;">
            🎉 Congratulations! Your account has been successfully verified and you're now part of our community.
          </p>
        </div>
        
        <div style="color: #666; font-size: 14px; line-height: 1.5;">
          <p><strong>What's next?</strong></p>
          <ul style="margin-left: 20px;">
            <li>Complete your profile setup</li>
            <li>Explore our features</li>
            <li>Connect with other users</li>
          </ul>
        </div>
        
        <div style="margin-top: 30px; text-align: center;">
          <a href="${CLIENT_URL}" style="background-color: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Get Started
          </a>
        </div>
      </div>
    `;
  }

  //   *** Password Change  Notification Email Template ***
  getPasswordChangeNotificationTemplate(name) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin-bottom: 10px;">Password Changed</h1>
          <p style="color: #666;">Hello ${name},</p>
        </div>
        
        <div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
          <p style="color: #155724; margin: 0; text-align: center;">
            ✅ Your password has been successfully changed.
          </p>
        </div>
        
        <div style="color: #666; font-size: 14px; line-height: 1.5;">
          <p>If you didn't make this change, please contact our support team immediately.</p>
          <p>Time: ${new Date().toLocaleString()}</p>
        </div>
      </div>
    `;
  }

  //   ***  ***
}

export default new EmailService();
