// src/tester/visualChecker.ts

import { BrowserEngine } from "../browser/engine";
import { TestResult } from "../types";

export class VisualChecker {
  constructor(private browser: BrowserEngine) {}

  async checkPage(pageUrl: string): Promise<TestResult[]> {
    const results: TestResult[] = [];

    await this.browser.goto(pageUrl);

    // Check 1: Page has a reasonable title
    const pageInfo = await this.browser.getPageInfo(pageUrl);
    if (!pageInfo.title || pageInfo.title === "localhost" || pageInfo.title === "") {
      results.push({
        page: pageUrl,
        test: "page-title",
        status: "warning",
        message: `Page has no meaningful title (got: "${pageInfo.title || "(empty)"}")`,
      });
    }

    // Check 2: Overflow / horizontal scroll
    const hasOverflow = await this.checkOverflow();
    if (hasOverflow) {
      results.push({
        page: pageUrl,
        test: "horizontal-overflow",
        status: "fail",
        message: "Page has horizontal overflow (content wider than viewport)",
        screenshot: await this.browser.screenshot(),
      });
    }

    // Check 3: Overlapping elements (basic check)
    const overlaps = await this.checkOverlaps();
    if (overlaps.length > 0) {
      results.push({
        page: pageUrl,
        test: "element-overlaps",
        status: "warning",
        message: `Found ${overlaps.length} potentially overlapping interactive element(s)`,
        details: overlaps.join("\n"),
      });
    }

    // Check 4: Images without alt text
    const missingAlt = await this.checkImagesAlt();
    if (missingAlt > 0) {
      results.push({
        page: pageUrl,
        test: "images-alt",
        status: "warning",
        message: `${missingAlt} image(s) missing alt text`,
      });
    }

    // Check 5: Broken images
    const brokenImages = await this.checkBrokenImages();
    if (brokenImages.length > 0) {
      results.push({
        page: pageUrl,
        test: "broken-images",
        status: "fail",
        message: `${brokenImages.length} broken image(s) found`,
        details: brokenImages.join("\n"),
      });
    }

    // Check 6: Mobile responsiveness
    const mobileResults = await this.checkMobileView(pageUrl);
    results.push(...mobileResults);

    return results;
  }

  private async checkOverflow(): Promise<boolean> {
    return await (await this.getPage()).evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
  }

  private async checkOverlaps(): Promise<string[]> {
    return await (await this.getPage()).evaluate(() => {
      const interactiveEls = Array.from(
        document.querySelectorAll("button, a, input, select, textarea")
      );
      const overlaps: string[] = [];

      for (let i = 0; i < interactiveEls.length; i++) {
        for (let j = i + 1; j < interactiveEls.length; j++) {
          const r1 = interactiveEls[i].getBoundingClientRect();
          const r2 = interactiveEls[j].getBoundingClientRect();

          if (r1.width === 0 || r1.height === 0 || r2.width === 0 || r2.height === 0) continue;

          const overlap =
            r1.left < r2.right &&
            r1.right > r2.left &&
            r1.top < r2.bottom &&
            r1.bottom > r2.top;

          if (overlap) {
            const el1 = interactiveEls[i].tagName + (interactiveEls[i].id ? `#${interactiveEls[i].id}` : "");
            const el2 = interactiveEls[j].tagName + (interactiveEls[j].id ? `#${interactiveEls[j].id}` : "");
            overlaps.push(`${el1} overlaps with ${el2}`);
          }
        }
        if (overlaps.length > 5) break; // don't flood
      }
      return overlaps;
    });
  }

  private async checkImagesAlt(): Promise<number> {
    return await (await this.getPage()).evaluate(() => {
      const images = Array.from(document.querySelectorAll("img"));
      return images.filter((img) => !img.alt || img.alt.trim() === "").length;
    });
  }

  private async checkBrokenImages(): Promise<string[]> {
    return await (await this.getPage()).evaluate(() => {
      const images = Array.from(document.querySelectorAll("img"));
      return images
        .filter((img) => !img.complete || img.naturalWidth === 0)
        .map((img) => img.src);
    });
  }

  private async checkMobileView(pageUrl: string): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const page = await this.getPage();

    // Switch to mobile viewport
    await page.setViewport({ width: 375, height: 667 });
    await this.browser.goto(pageUrl);

    const mobileOverflow = await this.checkOverflow();
    if (mobileOverflow) {
      results.push({
        page: pageUrl,
        test: "mobile-overflow",
        status: "fail",
        message: "Page has horizontal overflow on mobile viewport (375px)",
        screenshot: await this.browser.screenshot(),
      });
    } else {
      results.push({
        page: pageUrl,
        test: "mobile-responsive",
        status: "pass",
        message: "Page renders without horizontal overflow on mobile",
      });
    }

    // Restore desktop viewport
    await page.setViewport({ width: 1280, height: 800 });

    return results;
  }

  private async getPage(): Promise<any> {
    // Access the internal page - this is a simplified accessor
    return (this.browser as any).page || (await this.browser.newPage());
  }
}