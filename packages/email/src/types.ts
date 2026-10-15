export type EmailLocale = "en" | "ar";

export interface SendEmailRequest {
  to: string;
  subject: string;
  html: string;
  text: string;
  locale: EmailLocale;
}

export interface EmailService {
  send(request: SendEmailRequest): Promise<{ id?: string }>;
}

export class EmailSendError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "EmailSendError";
  }
}
