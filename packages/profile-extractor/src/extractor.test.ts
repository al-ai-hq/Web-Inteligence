import { describe, expect, it } from "vitest";
import { extractProfileData } from "./extractor.js";

describe("extractProfileData", () => {
  it("extracts business name from h1 tag", () => {
    const html = `<html><body><h1>Example Business</h1></body></html>`;
    const result = extractProfileData(html, "https://example.com/profile");
    expect(result.extracted_name).toBe("Example Business");
  });

  it("extracts phone number from tel: link", () => {
    const html = `<html><body><a href="tel:+1-555-0100">Call us</a></body></html>`;
    const result = extractProfileData(html, "https://example.com/profile");
    expect(result.extracted_phone).toBe("+1-555-0100");
  });

  it("extracts email from mailto: link", () => {
    const html = `<html><body><a href="mailto:contact@example.com">Email</a></body></html>`;
    const result = extractProfileData(html, "https://example.com/profile");
    expect(result.extracted_email).toBe("contact@example.com");
  });

  it("extracts address from schema.org LocalBusiness markup", () => {
    const html = `
      <html>
        <body>
          <div itemscope itemtype="http://schema.org/LocalBusiness">
            <span itemprop="streetAddress">123 Main St</span>
            <span itemprop="addressLocality">Anytown</span>
            <span itemprop="addressRegion">CA</span>
            <span itemprop="postalCode">90210</span>
            <span itemprop="addressCountry">US</span>
          </div>
        </body>
      </html>
    `;
    const result = extractProfileData(html, "https://example.com/profile");
    expect(result.extracted_address).toEqual({
      street: "123 Main St",
      city: "Anytown",
      region: "CA",
      postal_code: "90210",
      country: "US",
    });
  });

  it("returns confidence score based on extraction completeness", () => {
    const html = `<html><body><h1>Example</h1><a href="tel:+1-555-0100">Call</a></body></html>`;
    const result = extractProfileData(html, "https://example.com/profile");
    expect(result.extraction_confidence).toBeGreaterThan(0);
    expect(result.extraction_confidence).toBeLessThanOrEqual(1);
  });

  it("returns low confidence for empty HTML", () => {
    const html = `<html><body></body></html>`;
    const result = extractProfileData(html, "https://example.com/profile");
    expect(result.extraction_confidence).toBe(0);
  });
});
