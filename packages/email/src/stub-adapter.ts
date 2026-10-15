import type { EmailService, SendEmailRequest } from "./types.js";

export class StubEmailService implements EmailService {
  private readonly sent: SendEmailRequest[] = [];

  async send(request: SendEmailRequest): Promise<{ id?: string }> {
    this.sent.push(request);
    return { id: "stub-email-id" };
  }

  getSent(): SendEmailRequest[] {
    return [...this.sent];
  }

  clear(): void {
    this.sent.length = 0;
  }
}
