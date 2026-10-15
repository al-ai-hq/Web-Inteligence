import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import {
  StubEmailService,
  ResendEmailService,
  EmailSendError,
} from "../src/index.js";
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

describe("ResendEmailService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls the Resend API and returns the message id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "resend-msg-id" }), { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const service = new ResendEmailService({ apiKey: "re_test", from: "from@example.com" });
    const result = await service.send({
      to: "to@example.com",
      subject: "Hello",
      html: "<p>Hello</p>",
      text: "Hello",
      locale: "en",
    });

    expect(result.id).toBe("resend-msg-id");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer re_test",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          from: "from@example.com",
          to: "to@example.com",
          subject: "Hello",
          html: "<p>Hello</p>",
          text: "Hello",
        }),
      }),
    );
  });

  it("throws EmailSendError on Resend failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("Internal Server Error", { status: 500 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const service = new ResendEmailService({ apiKey: "re_test", from: "from@example.com" });

    await expect(
      service.send({
        to: "to@example.com",
        subject: "Hello",
        html: "<p>Hello</p>",
        text: "Hello",
        locale: "en",
      }),
    ).rejects.toThrow(EmailSendError);
  });
});
