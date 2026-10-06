import { describe, it, expect } from "vitest";
import { extractPolicyLinks } from "../src/policy-extractor";
import type { EvidencePackage } from "../src/types";

const baseEvidence: EvidencePackage = {
  html: "",
  url: "https://example.com",
  language: "en",
  direction: "ltr",
  viewportWidth: 1280,
};

describe("policy-extractor", () => {
  it("extracts privacy policy links", () => {
    const html = `
      <html>
        <body>
          <a href="/privacy">Privacy Policy</a>
          <a href="/privacy-policy">Read our privacy policy</a>
        </body>
      </html>
    `;

    const result = extractPolicyLinks({ ...baseEvidence, html });

    expect(result.hasPrivacy).toBe(true);
    expect(result.totalLinks).toBe(2);
    expect(result.links[0]).toMatchObject({
      type: "privacy",
      href: "/privacy",
      text: "Privacy Policy",
    });
  });

  it("extracts terms of service links", () => {
    const html = `
      <html>
        <body>
          <a href="/terms">Terms of Service</a>
          <a href="/terms-and-conditions">Terms & Conditions</a>
        </body>
      </html>
    `;

    const result = extractPolicyLinks({ ...baseEvidence, html });

    expect(result.hasTerms).toBe(true);
    expect(result.totalLinks).toBe(2);
    expect(result.links[0]).toMatchObject({
      type: "terms",
      href: "/terms",
      text: "Terms of Service",
    });
  });

  it("extracts pricing policy links", () => {
    const html = `
      <html>
        <body>
          <a href="/pricing">Pricing</a>
          <a href="/pricing-policy">Pricing Policy</a>
        </body>
      </html>
    `;

    const result = extractPolicyLinks({ ...baseEvidence, html });

    expect(result.hasPricing).toBe(true);
    expect(result.totalLinks).toBe(2);
    expect(result.links[0]).toMatchObject({
      type: "pricing",
      href: "/pricing",
      text: "Pricing",
    });
  });

  it("extracts delivery policy links", () => {
    const html = `
      <html>
        <body>
          <a href="/delivery">Delivery Information</a>
          <a href="/shipping">Shipping Policy</a>
        </body>
      </html>
    `;

    const result = extractPolicyLinks({ ...baseEvidence, html });

    expect(result.hasDelivery).toBe(true);
    expect(result.totalLinks).toBe(2);
    expect(result.links[0]).toMatchObject({
      type: "delivery",
      href: "/delivery",
      text: "Delivery Information",
    });
  });

  it("extracts returns policy links", () => {
    const html = `
      <html>
        <body>
          <a href="/returns">Returns Policy</a>
          <a href="/refund">Refund Policy</a>
        </body>
      </html>
    `;

    const result = extractPolicyLinks({ ...baseEvidence, html });

    expect(result.hasReturns).toBe(true);
    expect(result.totalLinks).toBe(2);
    expect(result.links[0]).toMatchObject({
      type: "returns",
      href: "/returns",
      text: "Returns Policy",
    });
  });

  it("extracts cookies policy links", () => {
    const html = `
      <html>
        <body>
          <a href="/cookies">Cookie Policy</a>
        </body>
      </html>
    `;

    const result = extractPolicyLinks({ ...baseEvidence, html });

    expect(result.totalLinks).toBe(1);
    expect(result.links[0]).toMatchObject({
      type: "cookies",
      href: "/cookies",
      text: "Cookie Policy",
    });
  });

  it("extracts mixed policy links", () => {
    const html = `
      <html>
        <body>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/pricing">Pricing</a>
          <a href="/delivery">Delivery</a>
          <a href="/returns">Returns</a>
          <a href="/about">About Us</a>
        </body>
      </html>
    `;

    const result = extractPolicyLinks({ ...baseEvidence, html });

    expect(result.hasPrivacy).toBe(true);
    expect(result.hasTerms).toBe(true);
    expect(result.hasPricing).toBe(true);
    expect(result.hasDelivery).toBe(true);
    expect(result.hasReturns).toBe(true);
    expect(result.totalLinks).toBe(5);
  });

  it("handles empty HTML", () => {
    const result = extractPolicyLinks({ ...baseEvidence, html: "<html><body></body></html>" });

    expect(result.hasPrivacy).toBe(false);
    expect(result.hasTerms).toBe(false);
    expect(result.hasPricing).toBe(false);
    expect(result.hasDelivery).toBe(false);
    expect(result.hasReturns).toBe(false);
    expect(result.totalLinks).toBe(0);
    expect(result.links).toHaveLength(0);
  });

  it("detects policy links by href pattern", () => {
    const html = `
      <html>
        <body>
          <a href="/legal/privacy-policy">Learn more</a>
          <a href="/legal/terms-of-service">Click here</a>
        </body>
      </html>
    `;

    const result = extractPolicyLinks({ ...baseEvidence, html });

    expect(result.hasPrivacy).toBe(true);
    expect(result.hasTerms).toBe(true);
    expect(result.totalLinks).toBe(2);
  });
});
