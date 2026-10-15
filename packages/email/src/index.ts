export type { EmailLocale, SendEmailRequest, EmailService } from "./types.js";
export { EmailSendError } from "./types.js";
export { StubEmailService } from "./stub-adapter.js";
export { ResendEmailService, createResendEmailService } from "./resend-adapter.js";
export type { ResendEmailServiceConfig } from "./resend-adapter.js";
export { auditCompletionTemplate } from "./templates/audit-completion/index.js";
export type { AuditCompletionContext } from "./templates/audit-completion/index.js";
export { passwordResetTemplate } from "./templates/password-reset/index.js";
export type { PasswordResetContext } from "./templates/password-reset/index.js";
