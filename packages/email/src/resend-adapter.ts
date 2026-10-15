import { EmailSendError } from "./types.js";
import type { EmailService, SendEmailRequest } from "./types.js";

export interface ResendEmailServiceConfig {
  apiKey: string;
  from: string;
}

export class ResendEmailService implements EmailService {
  constructor(private readonly config: ResendEmailServiceConfig) {}

  async send(request: SendEmailRequest): Promise<{ id?: string }> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.config.from,
        to: request.to,
        subject: request.subject,
        html: request.html,
        text: request.text,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "unknown");
      throw new EmailSendError(
        `Resend returned ${response.status}: ${body}`,
        { status: response.status },
      );
    }

    const data = (await response.json()) as { id?: string };
    return { id: data.id };
  }
}

export function createResendEmailService(): ResendEmailService {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["EMAIL_FROM_ADDRESS"];
  if (!apiKey || !from) {
    throw new Error(
      "RESEND_API_KEY and EMAIL_FROM_ADDRESS environment variables are required",
    );
  }
  return new ResendEmailService({ apiKey, from });
}
