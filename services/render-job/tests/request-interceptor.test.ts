import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@wpi/security", () => ({
  validateUrl: vi.fn(),
}));

import { validateUrl } from "@wpi/security";
const mockValidateUrl = vi.mocked(validateUrl);

import { interceptRequest } from "../src/request-interceptor.js";

function makeRequest(url: string, resourceType = "document") {
  return {
    url: () => url,
    resourceType: () => resourceType,
  };
}

describe("interceptRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("allows valid HTTPS URL", async () => {
    mockValidateUrl.mockResolvedValue({ valid: true });
    const req = makeRequest("https://example.com/page");
    expect(await interceptRequest(req)).toBe(true);
    expect(mockValidateUrl).toHaveBeenCalledWith("https://example.com/page");
  });

  it("allows valid HTTP URL", async () => {
    mockValidateUrl.mockResolvedValue({ valid: true });
    const req = makeRequest("http://example.com/page");
    expect(await interceptRequest(req)).toBe(true);
  });

  it("blocks URL that fails SSRF validation", async () => {
    mockValidateUrl.mockResolvedValue({ valid: false, reason: "private IP" });
    const req = makeRequest("https://169.254.169.254/metadata");
    expect(await interceptRequest(req)).toBe(false);
  });

  it("blocks ws:// scheme", async () => {
    const req = makeRequest("ws://example.com/socket");
    expect(await interceptRequest(req)).toBe(false);
    expect(mockValidateUrl).not.toHaveBeenCalled();
  });

  it("blocks wss:// scheme", async () => {
    const req = makeRequest("wss://example.com/socket");
    expect(await interceptRequest(req)).toBe(false);
    expect(mockValidateUrl).not.toHaveBeenCalled();
  });

  it("blocks file:// scheme", async () => {
    const req = makeRequest("file:///etc/passwd");
    expect(await interceptRequest(req)).toBe(false);
    expect(mockValidateUrl).not.toHaveBeenCalled();
  });

  it("blocks data: scheme", async () => {
    const req = makeRequest("data:text/html,<h1>hi</h1>");
    expect(await interceptRequest(req)).toBe(false);
    expect(mockValidateUrl).not.toHaveBeenCalled();
  });

  it("blocks ftp:// scheme", async () => {
    const req = makeRequest("ftp://example.com/file");
    expect(await interceptRequest(req)).toBe(false);
    expect(mockValidateUrl).not.toHaveBeenCalled();
  });

  it("logs blocked requests with redacted hostname", async () => {
    mockValidateUrl.mockResolvedValue({ valid: false, reason: "private IP" });
    const req = makeRequest("https://secret.internal.corps/metadata");
    await interceptRequest(req);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("secret.internal.corps"));
    expect(console.warn).toHaveBeenCalledWith(
      expect.not.stringContaining("https://secret.internal.corps/metadata"),
    );
  });

  it("handles invalid URL gracefully", async () => {
    const req = makeRequest("not-a-valid-url");
    expect(await interceptRequest(req)).toBe(false);
    expect(mockValidateUrl).not.toHaveBeenCalled();
  });
});
