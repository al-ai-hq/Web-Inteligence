// XSS patterns (case-insensitive)
const XSS_PATTERNS: readonly RegExp[] = [
  /<script[\s>]/i,
  /javascript:/i,
  /\bon\w+\s*=/i,
  /<(iframe|object|embed|form)[\s>]/i,
  /data:/i,
];

// Prompt injection patterns (case-insensitive)
const PROMPT_INJECTION_PATTERNS: readonly RegExp[] = [
  /<!--\s*ai:/i,
  /<!--\s*ignore\s+previous\s+instructions/i,
  /<!--\s*system:/i,
  /\[INST\]/i,
  /<</i,
  /\[system\]/i,
  /ignore\s+previous\s+instructions/i,
  /forget\s+(everything|all)/i,
  /new\s+instructions/i,
];

// CSV injection patterns (case-insensitive)
const CSV_INJECTION_PATTERNS: readonly RegExp[] = [
  /^[=+\-@][a-z]+\|/i,
  /^=(SUM|HYPERLINK|EXEC)\(/i,
];

export function detectInjection(content: string): boolean {
  if (content === "") return false;

  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(content)) return true;
  }

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(content)) return true;
  }

  for (const pattern of CSV_INJECTION_PATTERNS) {
    if (pattern.test(content)) return true;
  }

  return false;
}
