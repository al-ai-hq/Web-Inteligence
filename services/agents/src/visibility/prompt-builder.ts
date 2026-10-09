// services/agents/src/visibility/prompt-builder.ts
import type { VisibilityIntake } from "./types.js";

interface TemplateInput {
  id: string;
  panel: "free" | "connected";
  category?: string;
  branded: boolean;
  text: string;
  placeholders: string[];
}

export interface FilledPrompt {
  prompt_id: string;
  panel: "free" | "connected";
  category?: string;
  branded: boolean;
  final_prompt: string;
  template_id: string;
}

const INTAKE_MAP: Record<string, keyof VisibilityIntake> = {
  brand: "brand_name",
  offering: "offering_description",
  audience: "target_audience",
  market: "market",
  city: "city",
  category: "category",
  use_case: "use_case",
  requirement: "requirement",
};

export function buildVisibilityPrompts(
  intake: VisibilityIntake,
  _panelTier: "free" | "connected",
  templates: TemplateInput[],
): FilledPrompt[] {
  return templates.map((tpl) => {
    let filled = tpl.text;

    for (const ph of tpl.placeholders) {
      const intakeKey = INTAKE_MAP[ph];
      if (!intakeKey) {
        throw new Error(`Missing value for placeholder: ${ph}`);
      }
      const value = intake[intakeKey];
      if (value === null || value === undefined) {
        throw new Error(`Missing value for placeholder: ${ph}`);
      }
      filled = filled.replaceAll(`{${ph}}`, String(value));
    }

    const unresolved = filled.match(/\{(\w+)\}/);
    if (unresolved) {
      throw new Error(`Missing value for placeholder: ${unresolved[1]}`);
    }

    return {
      prompt_id: tpl.id,
      panel: tpl.panel,
      category: tpl.category,
      branded: tpl.branded,
      final_prompt: filled,
      template_id: tpl.id,
    };
  });
}
