import nodemailer from "nodemailer";
import AppError from "../utils/AppError.js";

const EMAIL_FROM = process.env.EMAIL_FROM;
const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = process.env.EMAIL_PORT;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

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

  //   ***  ***
  //   ***  ***
}

export default new EmailService();
