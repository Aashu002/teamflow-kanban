const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM_EMAIL = process.env.SMTP_FROM || 'teamflow.kanban@gmail.com';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

/**
 * Basic HTML Wrapper for emails
 */
const emailTemplate = (title, content, actionLabel, actionUrl) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 40px; }
    .container { max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 32px; border: 1px solid #334155; }
    .logo { font-size: 24px; font-weight: 800; color: #7c3aed; margin-bottom: 24px; }
    h1 { font-size: 20px; font-weight: 700; color: #f8fafc; margin-top: 0; }
    p { font-size: 16px; line-height: 1.6; color: #94a3b8; }
    .btn { display: inline-block; padding: 12px 24px; background: #7c3aed; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; }
    .footer { margin-top: 40px; font-size: 12px; color: #64748b; text-align: center; }
    .accent { color: #7c3aed; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">⚡ TeamFlow</div>
    <h1>${title}</h1>
    <div class="content">${content}</div>
    ${actionLabel && actionUrl ? `<a href="${actionUrl}" class="btn">${actionLabel}</a>` : ''}
    <div class="footer">
      Sent by TeamFlow Kanban. Manage your notifications in your profile settings.
    </div>
  </div>
</body>
</html>
`;

const sendEmail = async (to, subject, html) => {
  if (!process.env.SMTP_PASS) {
    console.warn('⚠️ SMTP Credentials missing. Skipping email.');
    return;
  }
  try {
    const info = await transporter.sendMail({
      from: `"TeamFlow Alerts" <${FROM_EMAIL}>`,
      to,
      subject,
      html,
    });
    console.log('✅ Email sent:', info.messageId);
    return info;
  } catch (err) {
    console.error('❌ Failed to send email via Gmail SMTP:', err.message);
  }
};

const notifyTaskAssignment = async (task, assignee) => {
  if (!assignee?.email) return;
  
  const title = "New Task Assigned";
  const taskKey = `${task.key_prefix}-${task.task_number}`;
  const content = `
    <p>Hi ${assignee.name},</p>
    <p>A new task has been assigned to you in project <span class="accent">${task.key_prefix}</span>.</p>
    <p><strong>[${taskKey}] ${task.title}</strong></p>
    <p>Priority: <span style="text-transform: uppercase; color: ${task.priority === 'high' ? '#ef4444' : '#f59e0b'}">${task.priority}</span></p>
  `;
  const url = `${APP_URL}/projects/${task.project_id}/tasks/${task.task_number}`;
  
  await sendEmail(assignee.email, `[${taskKey}] Assigned to you: ${task.title}`, emailTemplate(title, content, 'View Task', url));
};

const notifyStatusChange = async (task, participant, changedBy) => {
  if (!participant?.email) return;
  
  const title = "Task Status Updated";
  const taskKey = `${task.key_prefix}-${task.task_number}`;
  const content = `
    <p>The status of task <strong>[${taskKey}] ${task.title}</strong> has been updated to <span class="accent" style="text-transform: uppercase;">${task.status}</span> by ${changedBy.name}.</p>
  `;
  const url = `${APP_URL}/projects/${task.project_id}/tasks/${task.task_number}`;
  
  await sendEmail(participant.email, `[${taskKey}] Status Update: ${task.status}`, emailTemplate(title, content, 'View Task', url));
};

const notifyNewComment = async (task, participant, comment, commenter) => {
  if (!participant?.email) return;
  
  const title = "New Comment Received";
  const taskKey = `${task.key_prefix}-${task.task_number}`;
  const content = `
    <p><strong>${commenter.name}</strong> commented on task <strong>[${taskKey}] ${task.title}</strong>:</p>
    <p style="background: #0f172a; padding: 16px; border-radius: 8px; color: #f8fafc; font-style: italic;">
      "${comment.content}"
    </p>
  `;
  const url = `${APP_URL}/projects/${task.project_id}/tasks/${task.task_number}`;
  
  await sendEmail(participant.email, `Re: [${taskKey}] New comment from ${commenter.name}`, emailTemplate(title, content, 'Reply to Comment', url));
};

module.exports = {
  notifyTaskAssignment,
  notifyStatusChange,
  notifyNewComment
};
