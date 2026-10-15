import type { EmailLocale } from "../../types.js";
import type { PasswordResetContext } from "./context.js";
import { passwordResetAr } from "./ar.js";
import { passwordResetEn } from "./en.js";

export type { PasswordResetContext };

export function passwordResetTemplate(
  context: PasswordResetContext & { locale: EmailLocale },
) {
  const { locale, ...rest } = context;
  const rendered = locale === "ar" ? passwordResetAr(rest) : passwordResetEn(rest);
  return {
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  };
}
