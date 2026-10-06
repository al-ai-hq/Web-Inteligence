import { describe, it, expect } from "vitest";
import { extractFormAnalysis } from "../src/form-extractor";
import type { EvidencePackage } from "../src/types";

const baseEvidence: EvidencePackage = {
  html: "",
  url: "https://example.com",
  language: "en",
  direction: "ltr",
  viewportWidth: 1280,
};

describe("form-extractor", () => {
  it("extracts form with labeled fields", () => {
    const html = `
      <html>
        <body>
          <form id="contact-form" action="/submit" method="POST">
            <label for="name">Name</label>
            <input type="text" id="name" name="name" required />

            <label for="email">Email</label>
            <input type="email" id="email" name="email" required />

            <label for="message">Message</label>
            <textarea id="message" name="message"></textarea>

            <button type="submit">Submit</button>
          </form>
        </body>
      </html>
    `;

    const result = extractFormAnalysis({ ...baseEvidence, html });

    expect(result.totalForms).toBe(1);
    expect(result.totalFields).toBe(3);
    expect(result.fieldsWithLabels).toBe(3);
    expect(result.fieldsRequired).toBe(2);
    expect(result.formsWithPrivacyText).toBe(0);

    const form = result.forms[0];
    expect(form.id).toBe("contact-form");
    expect(form.action).toBe("/submit");
    expect(form.method).toBe("POST");
    expect(form.fieldCount).toBe(3);
    expect(form.hasPrivacyTextNearby).toBe(false);

    expect(form.fields[0]).toMatchObject({
      name: "name",
      type: "text",
      label: "Name",
      required: true,
      hasLabel: true,
    });

    expect(form.fields[1]).toMatchObject({
      name: "email",
      type: "email",
      label: "Email",
      required: true,
      hasLabel: true,
    });

    expect(form.fields[2]).toMatchObject({
      name: "message",
      type: "textarea",
      label: "Message",
      required: false,
      hasLabel: true,
    });
  });

  it("extracts form with unlabeled fields", () => {
    const html = `
      <html>
        <body>
          <form>
            <input type="text" name="username" />
            <input type="password" name="password" />
          </form>
        </body>
      </html>
    `;

    const result = extractFormAnalysis({ ...baseEvidence, html });

    expect(result.totalForms).toBe(1);
    expect(result.totalFields).toBe(2);
    expect(result.fieldsWithLabels).toBe(0);
    expect(result.fieldsRequired).toBe(0);

    expect(result.forms[0].fields[0]).toMatchObject({
      name: "username",
      type: "text",
      hasLabel: false,
      required: false,
    });

    expect(result.forms[0].fields[1]).toMatchObject({
      name: "password",
      type: "password",
      hasLabel: false,
      required: false,
    });
  });

  it("detects privacy text near form", () => {
    const html = `
      <html>
        <body>
          <form>
            <label for="email">Email</label>
            <input type="email" id="email" name="email" />
            <p class="privacy-text">We respect your privacy and will not share your data.</p>
          </form>
        </body>
      </html>
    `;

    const result = extractFormAnalysis({ ...baseEvidence, html });

    expect(result.totalForms).toBe(1);
    expect(result.formsWithPrivacyText).toBe(1);
    expect(result.forms[0].hasPrivacyTextNearby).toBe(true);
  });

  it("extracts multiple forms", () => {
    const html = `
      <html>
        <body>
          <form id="login">
            <label for="user">Username</label>
            <input type="text" id="user" name="user" required />
          </form>
          <form id="newsletter">
            <label for="nl-email">Email</label>
            <input type="email" id="nl-email" name="email" />
            <p>Read our privacy policy</p>
          </form>
        </body>
      </html>
    `;

    const result = extractFormAnalysis({ ...baseEvidence, html });

    expect(result.totalForms).toBe(2);
    expect(result.totalFields).toBe(2);
    expect(result.fieldsWithLabels).toBe(2);
    expect(result.fieldsRequired).toBe(1);
    expect(result.formsWithPrivacyText).toBe(1);

    expect(result.forms[0].id).toBe("login");
    expect(result.forms[1].id).toBe("newsletter");
    expect(result.forms[1].hasPrivacyTextNearby).toBe(true);
  });

  it("handles empty HTML", () => {
    const result = extractFormAnalysis({ ...baseEvidence, html: "<html><body></body></html>" });

    expect(result.totalForms).toBe(0);
    expect(result.totalFields).toBe(0);
    expect(result.fieldsWithLabels).toBe(0);
    expect(result.fieldsRequired).toBe(0);
    expect(result.formsWithPrivacyText).toBe(0);
    expect(result.forms).toHaveLength(0);
  });

  it("detects various input types", () => {
    const html = `
      <html>
        <body>
          <form>
            <input type="text" name="text" />
            <input type="email" name="email" />
            <input type="tel" name="phone" />
            <input type="number" name="age" />
            <input type="date" name="dob" />
            <input type="checkbox" name="agree" />
            <input type="radio" name="gender" value="male" />
            <input type="radio" name="gender" value="female" />
            <select name="country"><option>USA</option></select>
            <textarea name="bio"></textarea>
          </form>
        </body>
      </html>
    `;

    const result = extractFormAnalysis({ ...baseEvidence, html });

    expect(result.totalFields).toBe(10);
    expect(result.forms[0].fields.map((f) => f.type)).toEqual([
      "text",
      "email",
      "tel",
      "number",
      "date",
      "checkbox",
      "radio",
      "radio",
      "select",
      "textarea",
    ]);
  });

  it("detects labels with for attribute matching input id", () => {
    const html = `
      <html>
        <body>
          <form>
            <label for="field1">Label 1</label>
            <input type="text" id="field1" name="field1" />

            <label for="field2">Label 2</label>
            <input type="text" id="field2" name="field2" />
          </form>
        </body>
      </html>
    `;

    const result = extractFormAnalysis({ ...baseEvidence, html });

    expect(result.fieldsWithLabels).toBe(2);
    expect(result.forms[0].fields[0].label).toBe("Label 1");
    expect(result.forms[0].fields[1].label).toBe("Label 2");
  });

  it("detects labels wrapping inputs", () => {
    const html = `
      <html>
        <body>
          <form>
            <label>
              Username
              <input type="text" name="username" />
            </label>
          </form>
        </body>
      </html>
    `;

    const result = extractFormAnalysis({ ...baseEvidence, html });

    expect(result.fieldsWithLabels).toBe(1);
    expect(result.forms[0].fields[0].label).toBe("Username");
  });
});
