const nodemailer = require('nodemailer');
const logger = require('./logger');

const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text,
      html,
    });
    logger.info(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error(`Email failed: ${error.message}`);
    throw error;
  }
};

const emailTemplates = {
  welcome: (name) => ({
    subject: 'Welcome to Missing Child Platform',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1e40af; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Missing Child Platform</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <h2>Welcome, ${name}!</h2>
          <p>Your account has been created successfully. You can now report found children or search for missing ones.</p>
          <p>Together, we can help reunite families.</p>
        </div>
        <div style="padding: 20px; background: #f3f4f6; text-align: center; font-size: 12px; color: #6b7280;">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    `,
  }),

  claimSubmitted: (parentName, caseId) => ({
    subject: `Claim Submitted - Case #${caseId}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1e40af; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Missing Child Platform</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <h2>Claim Submitted Successfully</h2>
          <p>Dear ${parentName},</p>
          <p>Your claim for case <strong>#${caseId}</strong> has been submitted and is under review.</p>
          <p>Our verification team will contact you within 24 hours. Please have your identification documents ready.</p>
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <p style="margin: 0; color: #92400e;"><strong>Important:</strong> Do not share sensitive information over social media. All verifications happen through our secure platform.</p>
          </div>
        </div>
      </div>
    `,
  }),

  claimApproved: (parentName, meetingDetails) => ({
    subject: 'Claim Approved - Next Steps',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #065f46; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Claim Approved</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <h2>Great News, ${parentName}!</h2>
          <p>Your claim has been approved after verification.</p>
          <p><strong>Next Steps:</strong> ${meetingDetails}</p>
          <p>Please bring original government-issued ID and any supporting documents.</p>
        </div>
      </div>
    `,
  }),

  newClaimNotification: (finderName, caseId, claimantName) => ({
    subject: `New Claim on Your Report - Case #${caseId}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1e40af; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Missing Child Platform</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <p>Dear ${finderName},</p>
          <p>A parent/guardian (${claimantName}) has submitted a claim for case <strong>#${caseId}</strong>.</p>
          <p>Our team is verifying their identity. You will be notified once verification is complete.</p>
        </div>
      </div>
    `,
  }),

  passwordReset: (resetUrl) => ({
    subject: 'Password Reset Request',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1e40af; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Missing Child Platform</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <h2>Password Reset</h2>
          <p>You requested a password reset. Click the button below to reset your password:</p>
          <a href="${resetUrl}" style="display: inline-block; background: #1e40af; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 20px 0;">Reset Password</a>
          <p>This link expires in 15 minutes. If you didn't request this, please ignore this email.</p>
        </div>
      </div>
    `,
  }),

  caseResolved: (name, caseId) => ({
    subject: `Case Resolved - #${caseId}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #065f46; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">🎉 Case Resolved!</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <p>Dear ${name},</p>
          <p>Case <strong>#${caseId}</strong> has been marked as resolved. The child has been successfully reunited with their family.</p>
          <p>Thank you for your help in making this possible!</p>
        </div>
      </div>
    `,
  }),
};

module.exports = { sendEmail, emailTemplates };
