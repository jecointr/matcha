import nodemailer from 'nodemailer';

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'maildev',
  port: parseInt(process.env.MAIL_PORT) || 1025,
  secure: false, // true for 465, false for other ports
  auth: process.env.MAIL_USER ? {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASSWORD
  } : undefined
});

/**
 * Send an email
 * @param {Object} options - Email options
 */
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || '"Matcha" <noreply@matcha.local>',
      to,
      subject,
      text,
      html
    });
    console.log('Email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Email error:', error);
    return false;
  }
};

/**
 * Send verification email
 */
export const sendVerificationEmail = async (email, username, token) => {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  
  return sendEmail({
    to: email,
    subject: 'Verify your Matcha account',
    text: `Hi ${username},\n\nPlease verify your email by clicking this link:\n${verifyUrl}\n\nThis link expires in 24 hours.\n\nIf you didn't create an account, please ignore this email.\n\nBest,\nThe Matcha Team`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; padding: 20px 0; }
          .logo { font-size: 32px; color: #ec4899; }
          .button { display: inline-block; background: #ec4899; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">💕 Matcha</div>
          </div>
          <h2>Welcome to Matcha, ${username}!</h2>
          <p>Thanks for signing up. Please verify your email address to complete your registration.</p>
          <p style="text-align: center;">
            <a href="${verifyUrl}" class="button">Verify Email</a>
          </p>
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; color: #666;">${verifyUrl}</p>
          <p><strong>This link expires in 24 hours.</strong></p>
          <p>If you didn't create an account, please ignore this email.</p>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Matcha. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  });
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (email, username, token) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  
  return sendEmail({
    to: email,
    subject: 'Reset your Matcha password',
    text: `Hi ${username},\n\nYou requested to reset your password. Click this link to set a new password:\n${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest,\nThe Matcha Team`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; padding: 20px 0; }
          .logo { font-size: 32px; color: #ec4899; }
          .button { display: inline-block; background: #ec4899; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">💕 Matcha</div>
          </div>
          <h2>Password Reset Request</h2>
          <p>Hi ${username},</p>
          <p>You requested to reset your password. Click the button below to set a new password:</p>
          <p style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </p>
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>
          <p><strong>This link expires in 1 hour.</strong></p>
          <p>If you didn't request this, please ignore this email. Your password will remain unchanged.</p>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Matcha. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  });
};

export default transporter;
