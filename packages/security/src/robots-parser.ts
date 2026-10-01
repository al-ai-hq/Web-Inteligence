interface Rule {
  allow: boolean;
  pattern: string;
}

/**
 * Parse a robots.txt string and determine if a URL is allowed for a given user-agent.
 * Implements RFC 9309 robots.txt parsing with longest-match-wins rule.
 */
export function parseRobots(robotsTxt: string, userAgent: string, url: string): boolean {
  if (!robotsTxt.trim()) {
    return true;
  }

  const lines = robotsTxt.split(/\r?\n/);

  // Parse groups: each group has user-agents and rules
  const groups: Map<string, Rule[]> = new Map();
  let currentUserAgents: string[] = [];
  let currentRules: Rule[] = [];

  for (const rawLine of lines) {
    // Strip comments
    const line = (rawLine.split("#")[0] ?? "").trim();
    if (!line) continue;

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const field = line.substring(0, colonIndex).trim().toLowerCase();
    const value = line.substring(colonIndex + 1).trim();

    if (field === "user-agent") {
      // If we already have rules for previous user-agents, save them and start a new group
      if (currentRules.length > 0 && currentUserAgents.length > 0) {
        for (const ua of currentUserAgents) {
          const existing = groups.get(ua) ?? [];
          groups.set(ua, [...existing, ...currentRules]);
        }
        currentUserAgents = [];
        currentRules = [];
      }
      // If we had user-agents but no rules yet, just add to the list (consecutive User-agent lines)
      if (currentUserAgents.length > 0) {
        currentUserAgents.push(value.toLowerCase());
      } else {
        currentUserAgents = [value.toLowerCase()];
      }
    } else if (field === "allow" || field === "disallow") {
      if (value) {
        currentRules.push({
          allow: field === "allow",
          pattern: value,
        });
      }
    }
  }

  // Save the last group
  if (currentUserAgents.length > 0 && currentRules.length > 0) {
    for (const ua of currentUserAgents) {
      const existing = groups.get(ua) ?? [];
      groups.set(ua, [...existing, ...currentRules]);
    }
  }

  // Determine which group to use: specific user-agent first, then *
  const uaLower = userAgent.toLowerCase();
  let rules = groups.get(uaLower);
  if (!rules) {
    rules = groups.get("*") ?? [];
  }

  if (rules.length === 0) {
    return true;
  }

  // Extract path from URL for matching
  let urlPath: string;
  try {
    const parsed = new URL(url);
    urlPath = parsed.pathname + parsed.search;
  } catch {
    urlPath = url;
  }

  // Find the longest matching rule
  let bestMatch: Rule | null = null;
  let bestLength = -1;

  for (const rule of rules) {
    if (matchesPattern(rule.pattern, urlPath)) {
      const patternLength = patternLengthForPriority(rule.pattern);
      if (patternLength > bestLength) {
        bestLength = patternLength;
        bestMatch = rule;
      }
    }
  }

  if (!bestMatch) {
    return true;
  }

  return bestMatch.allow;
}

/**
 * Convert a robots.txt pattern to a regex and test it against a path.
 * Supports * wildcard and $ end-anchor.
 */
function matchesPattern(pattern: string, path: string): boolean {
  const patternLower = pattern.toLowerCase();
  const pathLower = path.toLowerCase();

  let hasEndAnchor = false;
  let regexPattern = patternLower;

  if (regexPattern.endsWith("$")) {
    hasEndAnchor = true;
    regexPattern = regexPattern.slice(0, -1);
  }

  // Escape regex special chars except *
  let regex = "";
  for (const char of regexPattern) {
    if (char === "*") {
      regex += ".*";
    } else if ("\\^$.|?+()[]{}".includes(char)) {
      regex += "\\" + char;
    } else {
      regex += char;
    }
  }

  if (hasEndAnchor) {
    regex += "$";
  }

  const re = new RegExp("^" + regex);
  return re.test(pathLower);
}

/**
 * Calculate the pattern length for priority comparison.
 * Per RFC 9309, the length of the pattern determines priority.
 * Wildcards count as their expanded length for matching purposes,
 * but for priority we use the raw pattern string length.
 */
function patternLengthForPriority(pattern: string): number {
  // Strip the $ end-anchor for length calculation
  let p = pattern;
  if (p.endsWith("$")) {
    p = p.slice(0, -1);
  }
  return p.length;
}
