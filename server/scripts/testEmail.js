/**
 * Simple script to test Gmail SMTP integration.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const nodemailer = require('nodemailer');

const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const fromEmail = process.env.SMTP_FROM || user;
const recipient = process.argv[2] || fromEmail;

if (!user || !pass) {
  console.error('❌ Error: SMTP_USER or SMTP_PASS not found in environment.');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user, pass },
});

async function test() {
  console.log(`🚀 Sending test email via Gmail SMTP from ${fromEmail} to ${recipient}...`);
  try {
    const info = await transporter.sendMail({
      from: `"TeamFlow Test" <${fromEmail}>`,
      to: recipient,
      subject: 'Gmail SMTP Test Success! ⚡',
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #7c3aed; border-radius: 8px; background: #0f172a; color: #f8fafc;">
          <h2 style="color: #7c3aed;">Notification System Ready!</h2>
          <p>This is a test email to verify that your <strong>Gmail App Password</strong> is working correctly.</p>
          <p>You can now send task alerts to any team member in the project.</p>
        </div>
      `
    });

    console.log('✅ Success! Email sent. ID:', info.messageId);
  } catch (err) {
    console.error('❌ Failed to run Gmail SMTP test:', err.message);
  }
}

test();
