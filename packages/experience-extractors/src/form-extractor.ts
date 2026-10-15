import * as cheerio from "cheerio";
import type { EvidencePackage, FormAnalysis, FormField, FormInfo } from "./types.js";

export function extractFormAnalysis(evidence: EvidencePackage): FormAnalysis {
  const $ = cheerio.load(evidence.html);
  const forms: FormInfo[] = [];

  $("form").each((_, formElement) => {
    const $form = $(formElement);
    const id = $form.attr("id");
    const action = $form.attr("action");
    const method = $form.attr("method");

    const fields: FormField[] = [];

    $form.find("input, textarea, select").each((_, fieldElement) => {
      const $field = $(fieldElement);
      const tagName = fieldElement.tagName.toLowerCase();
      const name = $field.attr("name") || "";
      const type = tagName === "input" ? $field.attr("type") || "text" : tagName;
      const id = $field.attr("id");
      const required = Boolean($field.prop("required")) || $field.attr("required") !== undefined;

      let label: string | undefined;
      let hasLabel = false;

      if (id) {
        const $label = $(`label[for="${id}"]`);
        if ($label.length > 0) {
          label = $label.text().trim();
          hasLabel = true;
        }
      }

      if (!hasLabel) {
        const $parentLabel = $field.closest("label");
        if ($parentLabel.length > 0) {
          const labelText = $parentLabel
            .clone()
            .children("input, textarea, select")
            .remove()
            .end()
            .text()
            .trim();
          if (labelText) {
            label = labelText;
            hasLabel = true;
          }
        }
      }

      fields.push({ name, type, label, required, hasLabel });
    });

    const hasPrivacyTextNearby = detectPrivacyText($form);

    forms.push({
      id,
      action,
      method,
      fields,
      fieldCount: fields.length,
      hasPrivacyTextNearby,
    });
  });

  const totalForms = forms.length;
  const totalFields = forms.reduce((sum, form) => sum + form.fieldCount, 0);
  const fieldsWithLabels = forms.reduce(
    (sum, form) => sum + form.fields.filter((f: FormField) => f.hasLabel).length,
    0,
  );
  const fieldsRequired = forms.reduce(
    (sum, form) => sum + form.fields.filter((f: FormField) => f.required).length,
    0,
  );
  const formsWithPrivacyText = forms.filter((f) => f.hasPrivacyTextNearby).length;

  return {
    forms,
    totalForms,
    totalFields,
    fieldsWithLabels,
    fieldsRequired,
    formsWithPrivacyText,
  };
}

function detectPrivacyText($form: cheerio.Cheerio<any>): boolean {
  const privacyKeywords = [
    "privacy",
    "personal data",
    "personal information",
    "data protection",
    "gdpr",
    "we respect",
    "will not share",
    "won't share",
  ];

  const text = $form.text().toLowerCase();
  return privacyKeywords.some((keyword) => text.includes(keyword));
}
