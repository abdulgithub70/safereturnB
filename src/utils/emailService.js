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

  newClaimNotification: (finderName, caseId, claimantName, claimantPhone, claimantEmail, relationship) => ({
    subject: `New Claim on Your Report - Case #${caseId}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1e40af; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Missing Child Platform</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <p>Dear <strong>${finderName}</strong>,</p>
          <p>A parent/guardian has submitted a claim for case <strong>#${caseId}</strong>. Here are their details:</p>

          <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 12px; color: #1e40af; font-size: 16px;">Claimant Details</h3>
            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
              <tr><td style="padding: 6px 0; color: #6b7280; width: 130px;">Name</td><td style="padding: 6px 0; font-weight: bold;">${claimantName}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Relationship</td><td style="padding: 6px 0; text-transform: capitalize;">${relationship}</td></tr>
              ${claimantPhone ? `<tr><td style="padding: 6px 0; color: #6b7280;">Phone</td><td style="padding: 6px 0;"><a href="tel:${claimantPhone}" style="color: #1e40af; font-weight: bold; font-size: 16px;">${claimantPhone}</a></td></tr>` : ''}
              <tr><td style="padding: 6px 0; color: #6b7280;">Email</td><td style="padding: 6px 0;"><a href="mailto:${claimantEmail}" style="color: #1e40af;">${claimantEmail}</a></td></tr>
            </table>
          </div>

          ${claimantPhone ? `
          <div style="text-align: center; margin: 20px 0;">
            <a href="tel:${claimantPhone}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
              📞 Call ${claimantName} Now
            </a>
          </div>` : ''}

          <div style="background: #fef3c7; padding: 12px 16px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-top: 16px;">
            <p style="margin: 0; color: #92400e; font-size: 13px;">
              <strong>Note:</strong> Our verification team is also reviewing this claim. 
              You may contact the claimant directly, but please also wait for official verification before any handoff.
            </p>
          </div>
        </div>
        <div style="padding: 20px; background: #f3f4f6; text-align: center; font-size: 12px; color: #6b7280;">
          <p>SafeReturn — Reuniting families, one child at a time.</p>
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
