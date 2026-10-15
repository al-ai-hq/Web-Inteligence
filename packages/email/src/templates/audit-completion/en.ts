import type { AuditCompletionContext } from "./context.js";

export function auditCompletionEn(context: AuditCompletionContext) {
  const site = new URL(context.siteUrl).hostname;
  const subject = `Your WPI audit for ${site} is ready`;
  const html = `<!DOCTYPE html>
<html lang="en" dir="ltr">
  <head><meta charset="utf-8"><title>${subject}</title></head>
  <body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1f2937;">
    <h1 style="font-size: 1.25rem; color: #111827;">${subject}</h1>
    <p>Your Presence Readiness score is <strong>${context.score}%</strong>.</p>
    <p><a href="${context.reportUrl}" style="color: #2563eb;">View your full report</a></p>
    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 1.5rem 0;">
    <p style="font-size: 0.875rem; color: #6b7280;">This link is private. Do not forward it.</p>
  </body>
</html>`;
  const text = `Your WPI audit for ${site} is ready.\n\nScore: ${context.score}%\n\nView your report: ${context.reportUrl}\n\nThis link is private. Do not forward it.`;
  return { subject, html, text };
}
