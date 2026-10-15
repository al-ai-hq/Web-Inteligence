import { describe, expect, it, beforeEach } from "vitest";
import { StubEmailService } from "../src/index.js";
import type { SendEmailRequest } from "../src/index.js";

describe("StubEmailService", () => {
  let service: StubEmailService;

  beforeEach(() => {
    service = new StubEmailService();
  });

  it("captures sent emails", async () => {
    const request: SendEmailRequest = {
      to: "user@example.com",
      subject: "subject",
      html: "<p>html</p>",
      text: "text",
      locale: "en",
    };

    const result = await service.send(request);

    expect(result.id).toBe("stub-email-id");
    expect(service.getSent()).toEqual([request]);
  });

  it("isolation between instances", async () => {
    const other = new StubEmailService();
    await service.send({
      to: "a@example.com",
      subject: "s",
      html: "h",
      text: "t",
      locale: "en",
    });
    expect(other.getSent()).toHaveLength(0);
  });
});
