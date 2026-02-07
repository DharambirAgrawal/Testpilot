// src/tester/navigator.ts

import { BrowserEngine } from "../browser/engine";
import { TestResult, PageInfo } from "../types";

export class NavigationTester {
  constructor(private browser: BrowserEngine) {}

  async discoverAndTestPages(baseUrl: string): Promise<{
    results: TestResult[];
    pages: PageInfo[];
  }> {
    const results: TestResult[] = [];
    const pages: PageInfo[] = [];
    const visited = new Set<string>();
    const toVisit: string[] = [baseUrl];

    // Limit to prevent infinite crawling
    const MAX_PAGES = 10;

    while (toVisit.length > 0 && visited.size < MAX_PAGES) {
      const url = toVisit.shift()!;
      const normalizedUrl = this.normalizeUrl(url);

      if (visited.has(normalizedUrl)) continue;
      visited.add(normalizedUrl);

      // Navigate
      const page = await this.browser.newPage();
      const loaded = await this.browser.goto(url);

      if (!loaded) {
        results.push({
          page: url,
          test: "page-load",
          status: "fail",
          message: `Page failed to load: ${url}`,
        });
        continue;
      }

      // Get page info
      const pageInfo = await this.browser.getPageInfo(url);
      pages.push(pageInfo);

      // Check for console errors on load
      if (pageInfo.errors.length > 0) {
        const criticalErrors = pageInfo.errors.filter(
          (e) => e.type === "page-error" || e.type === "console-error"
        );
        if (criticalErrors.length > 0) {
          results.push({
            page: url,
            test: "console-errors",
            status: "fail",
            message: `Page has ${criticalErrors.length} console error(s)`,
            details: criticalErrors.map((e) => e.text).join("\n"),
          });
        }

        const networkErrors = pageInfo.errors.filter((e) => e.type === "network-error");
        if (networkErrors.length > 0) {
          results.push({
            page: url,
            test: "network-errors",
            status: "warning",
            message: `${networkErrors.length} failed network request(s)`,
            details: networkErrors.map((e) => e.text).join("\n"),
          });
        }
      }

      // Check page has content
      const bodyText = await this.browser.getPageText();
      if (!bodyText || bodyText.trim().length < 10) {
        results.push({
          page: url,
          test: "has-content",
          status: "fail",
          message: "Page appears empty or has very little content",
        });
      } else {
        results.push({
          page: url,
          test: "page-load",
          status: "pass",
          message: `Page loaded successfully: "${pageInfo.title}"`,
          screenshot: pageInfo.screenshot,
        });
      }

      // Check for common error indicators in page text
      const errorIndicators = [
        "cannot read properties",
        "is not defined",
        "unexpected token",
        "module not found",
        "404",
        "500 internal server error",
        "something went wrong",
        "error boundary",
        "unhandled runtime error",
      ];

      const lowerText = bodyText.toLowerCase();
      for (const indicator of errorIndicators) {
        if (lowerText.includes(indicator)) {
          results.push({
            page: url,
            test: "error-text-check",
            status: "fail",
            message: `Page contains error text: "${indicator}"`,
            details: this.extractContext(bodyText, indicator),
          });
          break;
        }
      }

      // Queue internal links for visiting
      for (const link of pageInfo.links) {
        if (link.isInternal && !visited.has(this.normalizeUrl(link.href))) {
          toVisit.push(link.href);
        }
      }
    }

    return { results, pages };
  }

  private normalizeUrl(url: string): string {
    try {
      const u = new URL(url);
      return `${u.origin}${u.pathname}`.replace(/\/$/, "");
    } catch {
      return url;
    }
  }

  private extractContext(text: string, keyword: string): string {
    const lower = text.toLowerCase();
    const idx = lower.indexOf(keyword);
    if (idx === -1) return "";
    const start = Math.max(0, idx - 50);
    const end = Math.min(text.length, idx + keyword.length + 50);
    return "..." + text.substring(start, end) + "...";
  }
}