import { describe, expect, it } from "vitest";
import { EmailSendError, type EmailLocale, type SendEmailRequest } from "../src/index.js";

describe("@wpi/email public API", () => {
  it("exports the EmailLocale union", () => {
    const locale: EmailLocale = "en";
    expect(locale).toBe("en");
  });

  it("exports a typed EmailSendError", () => {
    const error = new EmailSendError("boom", new Error("cause"));
    expect(error.name).toBe("EmailSendError");
    expect(error.message).toBe("boom");
    expect(error.cause).toBeInstanceOf(Error);
  });

  it("SendEmailRequest accepts the required fields", () => {
    const request: SendEmailRequest = {
      to: "user@example.com",
      subject: "subject",
      html: "<p>html</p>",
      text: "text",
      locale: "ar",
    };
    expect(request.locale).toBe("ar");
  });
});
