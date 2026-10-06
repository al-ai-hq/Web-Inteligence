import { describe, it, expect } from "vitest";
import { extractContactLinks } from "../src/contact-extractor";
import type { EvidencePackage } from "../src/types";

const baseEvidence: EvidencePackage = {
  html: "",
  url: "https://example.com",
  language: "en",
  direction: "ltr",
  viewportWidth: 1280,
};

describe("contact-extractor", () => {
  it("extracts phone links", () => {
    const html = `
      <html>
        <body>
          <a href="tel:+1234567890">Call us</a>
          <a href="tel:+0987654321">+0987654321</a>
        </body>
      </html>
    `;

    const result = extractContactLinks({ ...baseEvidence, html });

    expect(result.hasPhone).toBe(true);
    expect(result.hasEmail).toBe(false);
    expect(result.hasMessaging).toBe(false);
    expect(result.totalLinks).toBe(2);

    expect(result.links[0]).toMatchObject({
      type: "phone",
      href: "tel:+1234567890",
      text: "Call us",
    });

    expect(result.links[1]).toMatchObject({
      type: "phone",
      href: "tel:+0987654321",
      text: "+0987654321",
    });
  });

  it("extracts email links", () => {
    const html = `
      <html>
        <body>
          <a href="mailto:info@example.com">Contact us</a>
          <a href="mailto:support@example.com">support@example.com</a>
        </body>
      </html>
    `;

    const result = extractContactLinks({ ...baseEvidence, html });

    expect(result.hasPhone).toBe(false);
    expect(result.hasEmail).toBe(true);
    expect(result.hasMessaging).toBe(false);
    expect(result.totalLinks).toBe(2);

    expect(result.links[0]).toMatchObject({
      type: "email",
      href: "mailto:info@example.com",
      text: "Contact us",
    });
  });

  it("extracts WhatsApp links", () => {
    const html = `
      <html>
        <body>
          <a href="https://wa.me/1234567890">WhatsApp us</a>
          <a href="whatsapp://send?phone=1234567890">Chat on WhatsApp</a>
        </body>
      </html>
    `;

    const result = extractContactLinks({ ...baseEvidence, html });

    expect(result.hasPhone).toBe(false);
    expect(result.hasEmail).toBe(false);
    expect(result.hasMessaging).toBe(true);
    expect(result.totalLinks).toBe(2);

    expect(result.links[0]).toMatchObject({
      type: "whatsapp",
      href: "https://wa.me/1234567890",
      text: "WhatsApp us",
    });

    expect(result.links[1]).toMatchObject({
      type: "whatsapp",
      href: "whatsapp://send?phone=1234567890",
      text: "Chat on WhatsApp",
    });
  });

  it("extracts Telegram links", () => {
    const html = `
      <html>
        <body>
          <a href="https://t.me/username">Telegram</a>
          <a href="tg://resolve?domain=username">Message on Telegram</a>
        </body>
      </html>
    `;

    const result = extractContactLinks({ ...baseEvidence, html });

    expect(result.hasMessaging).toBe(true);
    expect(result.totalLinks).toBe(2);

    expect(result.links[0]).toMatchObject({
      type: "telegram",
      href: "https://t.me/username",
      text: "Telegram",
    });

    expect(result.links[1]).toMatchObject({
      type: "telegram",
      href: "tg://resolve?domain=username",
      text: "Message on Telegram",
    });
  });

  it("extracts Messenger links", () => {
    const html = `
      <html>
        <body>
          <a href="https://m.me/pagename">Messenger</a>
          <a href="fb-messenger://share?to=pagename">Chat on Messenger</a>
        </body>
      </html>
    `;

    const result = extractContactLinks({ ...baseEvidence, html });

    expect(result.hasMessaging).toBe(true);
    expect(result.totalLinks).toBe(2);

    expect(result.links[0]).toMatchObject({
      type: "messenger",
      href: "https://m.me/pagename",
      text: "Messenger",
    });

    expect(result.links[1]).toMatchObject({
      type: "messenger",
      href: "fb-messenger://share?to=pagename",
      text: "Chat on Messenger",
    });
  });

  it("extracts mixed contact links", () => {
    const html = `
      <html>
        <body>
          <a href="tel:+1234567890">Call</a>
          <a href="mailto:info@example.com">Email</a>
          <a href="https://wa.me/1234567890">WhatsApp</a>
          <a href="https://example.com">Regular link</a>
        </body>
      </html>
    `;

    const result = extractContactLinks({ ...baseEvidence, html });

    expect(result.hasPhone).toBe(true);
    expect(result.hasEmail).toBe(true);
    expect(result.hasMessaging).toBe(true);
    expect(result.totalLinks).toBe(3);
  });

  it("handles empty HTML", () => {
    const result = extractContactLinks({ ...baseEvidence, html: "<html><body></body></html>" });

    expect(result.hasPhone).toBe(false);
    expect(result.hasEmail).toBe(false);
    expect(result.hasMessaging).toBe(false);
    expect(result.totalLinks).toBe(0);
    expect(result.links).toHaveLength(0);
  });

  it("handles links without text", () => {
    const html = `
      <html>
        <body>
          <a href="tel:+1234567890"></a>
        </body>
      </html>
    `;

    const result = extractContactLinks({ ...baseEvidence, html });

    expect(result.totalLinks).toBe(1);
    expect(result.links[0].text).toBeUndefined();
  });
});
