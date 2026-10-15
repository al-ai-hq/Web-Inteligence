import type { AuditCompletionContext } from "./context.js";

export function auditCompletionAr(context: AuditCompletionContext) {
  const site = new URL(context.siteUrl).hostname;
  const subject = `تقرير WPI لموقع ${site} جاهز`;
  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
  <head><meta charset="utf-8"><title>${subject}</title></head>
  <body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1f2937;">
    <h1 style="font-size: 1.25rem; color: #111827;">${subject}</h1>
    <p>درجة جاهزية الحضور الرقمي: <strong>${context.score}%</strong>.</p>
    <p><a href="${context.reportUrl}" style="color: #2563eb;">عرض التقرير الكامل</a></p>
    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 1.5rem 0;">
    <p style="font-size: 0.875rem; color: #6b7280;">هذا الرابط خاص. لا تعمّمه.</p>
  </body>
</html>`;
  const text = `تقرير WPI لموقع ${site} جاهز.\n\nالدرجة: ${context.score}%\n\nعرض التقرير: ${context.reportUrl}\n\nهذا الرابط خاص. لا تعمّمه.`;
  return { subject, html, text };
}
