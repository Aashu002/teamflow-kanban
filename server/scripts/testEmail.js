/**
 * Simple script to test Resend integration.
 * Run with: RESEND_API_KEY=re_yourkey node server/scripts/testEmail.js [recipient_email]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Resend } = require('resend');

const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.SMTP_FROM || 'teamflow.kanban@gmail.com';
const recipient = process.argv[2] || fromEmail;

if (!apiKey) {
  console.error('❌ Error: RESEND_API_KEY not found in environment.');
  process.exit(1);
}

const resend = new Resend(apiKey);

async function test() {
  console.log(`🚀 Sending test email from ${fromEmail} to ${recipient}...`);
  try {
    const { data, error } = await resend.emails.send({
      from: `TeamFlow Test <${fromEmail}>`,
      to: [recipient],
      subject: 'Hello from TeamFlow! ⚡',
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #7c3aed; border-radius: 8px;">
          <h2 style="color: #7c3aed;">Notification System Active!</h2>
          <p>This is a test email to verify that your <strong>Resend</strong> integration is working correctly.</p>
          <p>If you see this, you are ready to receive task assignment and update alerts.</p>
        </div>
      `
    });

    if (error) {
       console.error('❌ Resend Error:', error);
    } else {
       console.log('✅ Success! Email sent. ID:', data.id);
    }
  } catch (err) {
    console.error('❌ Failed to run test:', err.message);
  }
}

test();
