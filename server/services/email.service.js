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
        html: this.gotOTPEmailTemplate(name, otp),
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
        html: this.passwordResetEmailTemplate(name, resetURL),
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
        html: this.welcomeEmailTemplate(name),
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
        html: this.passwordChangeNotificationTemplate(name),
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

  //   ***  ***
  //   ***  ***
}

export default new EmailService();
