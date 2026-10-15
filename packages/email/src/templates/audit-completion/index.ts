import type { EmailLocale } from "../../types.js";
import { auditCompletionAr } from "./ar.js";
import type { AuditCompletionContext } from "./context.js";
import { auditCompletionEn } from "./en.js";

export type { AuditCompletionContext };

export function auditCompletionTemplate(context: AuditCompletionContext & { locale: EmailLocale }) {
  const { locale, ...rest } = context;
  const rendered = locale === "ar" ? auditCompletionAr(rest) : auditCompletionEn(rest);
  return {
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  };
}
