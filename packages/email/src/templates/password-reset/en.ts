import type { PasswordResetContext } from "./context.js";

export function passwordResetEn(context: PasswordResetContext) {
  const subject = "Reset your WPI password";
  const html = `<!DOCTYPE html>
<html lang="en" dir="ltr">
  <head><meta charset="utf-8"><title>${subject}</title></head>
  <body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1f2937;">
    <h1 style="font-size: 1.25rem; color: #111827;">${subject}</h1>
    <p>Click the link below to reset your password. It expires in ${context.expiresInMinutes} minutes.</p>
    <p><a href="${context.resetUrl}" style="color: #2563eb;">Reset my password</a></p>
    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 1.5rem 0;">
    <p style="font-size: 0.875rem; color: #6b7280;">If you did not request this, you can ignore this email.</p>
  </body>
</html>`;
  const text = `Reset your WPI password.\n\nUse this link to reset your password. It expires in ${context.expiresInMinutes} minutes:\n\n${context.resetUrl}\n\nIf you did not request this, you can ignore this email.`;
  return { subject, html, text };
}
