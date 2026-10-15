import type { PasswordResetContext } from "./context.js";

export function passwordResetAr(context: PasswordResetContext) {
  const subject = "إعادة تعيين كلمة مرور WPI";
  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
  <head><meta charset="utf-8"><title>${subject}</title></head>
  <body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1f2937;">
    <h1 style="font-size: 1.25rem; color: #111827;">${subject}</h1>
    <p>اضغط الرابط أدناه لإعادة تعيين كلمة المرور. ينتهي صلاحيته خلال ${context.expiresInMinutes} دقيقة.</p>
    <p><a href="${context.resetUrl}" style="color: #2563eb;">إعادة تعيين كلمة المرور</a></p>
    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 1.5rem 0;">
    <p style="font-size: 0.875rem; color: #6b7280;">إذا لم تطلب هذا، يمكنك تجاهل البريد.</p>
  </body>
</html>`;
  const text = `إعادة تعيين كلمة مرور WPI.\n\nاستخدم هذا الرابط لإعادة تعيين كلمة المرور. ينتهي صلاحيته خلال ${context.expiresInMinutes} دقيقة:\n\n${context.resetUrl}\n\nإذا لم تطلب هذا، يمكنك تجاهل البريد.`;
  return { subject, html, text };
}
