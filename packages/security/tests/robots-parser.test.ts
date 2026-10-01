import { describe, it, expect } from "vitest";
import { parseRobots } from "../src/robots-parser.js";

describe("parseRobots", () => {
  it("empty robots.txt allows everything", () => {
    expect(parseRobots("", "Googlebot", "https://example.com/any/path")).toBe(true);
  });

  it("Disallow: / blocks all paths", () => {
    const robotsTxt = "User-agent: *\nDisallow: /";
    expect(parseRobots(robotsTxt, "Googlebot", "https://example.com/")).toBe(false);
    expect(parseRobots(robotsTxt, "Googlebot", "https://example.com/page")).toBe(false);
    expect(parseRobots(robotsTxt, "Googlebot", "https://example.com/deep/path")).toBe(false);
  });

  it("Disallow: /private blocks /private and /private/page", () => {
    const robotsTxt = "User-agent: *\nDisallow: /private";
    expect(parseRobots(robotsTxt, "Googlebot", "https://example.com/private")).toBe(false);
    expect(parseRobots(robotsTxt, "Googlebot", "https://example.com/private/page")).toBe(false);
  });

  it("Allow: /public allows /public even when Disallow: / exists", () => {
    const robotsTxt = "User-agent: *\nDisallow: /\nAllow: /public";
    expect(parseRobots(robotsTxt, "Googlebot", "https://example.com/public")).toBe(true);
    expect(parseRobots(robotsTxt, "Googlebot", "https://example.com/public/page")).toBe(true);
    expect(parseRobots(robotsTxt, "Googlebot", "https://example.com/other")).toBe(false);
  });

  it("longest match wins: Disallow: /dir/ vs Allow: /dir/page.html", () => {
    const robotsTxt = "User-agent: *\nDisallow: /dir/\nAllow: /dir/page.html";
    // /dir/page.html (15 chars) is longer than /dir/ (5 chars), so Allow wins
    expect(parseRobots(robotsTxt, "Googlebot", "https://example.com/dir/page.html")).toBe(true);
    // /dir/other matches only Disallow: /dir/
    expect(parseRobots(robotsTxt, "Googlebot", "https://example.com/dir/other")).toBe(false);
  });

  it("wildcard: Disallow: /*.pdf blocks /file.pdf", () => {
    const robotsTxt = "User-agent: *\nDisallow: /*.pdf";
    expect(parseRobots(robotsTxt, "Googlebot", "https://example.com/file.pdf")).toBe(false);
    expect(parseRobots(robotsTxt, "Googlebot", "https://example.com/dir/file.pdf")).toBe(false);
    expect(parseRobots(robotsTxt, "Googlebot", "https://example.com/file.html")).toBe(true);
  });

  it("end anchor: Disallow: /*.php$ blocks /page.php but not /page.php?id=1", () => {
    const robotsTxt = "User-agent: *\nDisallow: /*.php$";
    expect(parseRobots(robotsTxt, "Googlebot", "https://example.com/page.php")).toBe(false);
    expect(parseRobots(robotsTxt, "Googlebot", "https://example.com/page.php?id=1")).toBe(true);
  });

  it("user-agent matching: specific agent vs * fallback", () => {
    const robotsTxt = [
      "User-agent: Googlebot",
      "Disallow: /secret",
      "",
      "User-agent: *",
      "Disallow: /public",
    ].join("\n");
    // Googlebot should use its own group
    expect(parseRobots(robotsTxt, "Googlebot", "https://example.com/secret")).toBe(false);
    expect(parseRobots(robotsTxt, "Googlebot", "https://example.com/public")).toBe(true);
    // Other bots should use the * group
    expect(parseRobots(robotsTxt, "Bingbot", "https://example.com/public")).toBe(false);
    expect(parseRobots(robotsTxt, "Bingbot", "https://example.com/secret")).toBe(true);
  });

  it("comments are ignored", () => {
    const robotsTxt = [
      "# This is a comment",
      "User-agent: *",
      "Disallow: /private # inline comment",
    ].join("\n");
    expect(parseRobots(robotsTxt, "Googlebot", "https://example.com/private")).toBe(false);
    expect(parseRobots(robotsTxt, "Googlebot", "https://example.com/public")).toBe(true);
  });

  it("case-insensitive path matching", () => {
    const robotsTxt = "User-agent: *\nDisallow: /Private";
    expect(parseRobots(robotsTxt, "Googlebot", "https://example.com/private")).toBe(false);
    expect(parseRobots(robotsTxt, "Googlebot", "https://example.com/Private")).toBe(false);
    expect(parseRobots(robotsTxt, "Googlebot", "https://example.com/PRIVATE")).toBe(false);
  });
});
