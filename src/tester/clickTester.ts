// src/tester/clickTester.ts

import { BrowserEngine } from "../browser/engine";
import { ButtonInfo, TestResult } from "../types";

export class ClickTester {
  constructor(private browser: BrowserEngine) {}

  async testButtons(pageUrl: string, buttons: ButtonInfo[]): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Filter to non-submit buttons (form submission tested separately)
    const testableButtons = buttons.filter(
      (b) => b.type !== "submit" && !b.disabled && b.text.length > 0
    );

    if (testableButtons.length === 0) {
      return results; // nothing to test
    }

    for (const button of testableButtons) {
      // Reload page fresh for each button test
      await this.browser.goto(pageUrl);

      const errorsBefore = (await this.browser.getConsoleErrors()).length;

      const clickResult = await this.browser.click(button.selector);

      if (!clickResult.success) {
        results.push({
          page: pageUrl,
          test: `click-button-"${button.text}"`,
          status: "fail",
          message: `Button "${button.text}" could not be clicked`,
          details: clickResult.error,
        });
        continue;
      }

      // Check for errors after click
      const errorsAfter = await this.browser.getConsoleErrors();
      const newErrors = errorsAfter.slice(errorsBefore);

      if (newErrors.length > 0) {
        results.push({
          page: pageUrl,
          test: `click-button-"${button.text}"`,
          status: "fail",
          message: `Clicking "${button.text}" caused ${newErrors.length} error(s)`,
          details: newErrors.map((e) => e.text).join("\n"),
          screenshot: await this.browser.screenshot(),
        });
      } else {
        results.push({
          page: pageUrl,
          test: `click-button-"${button.text}"`,
          status: "pass",
          message: `Button "${button.text}" clicked successfully${clickResult.newUrl ? ` (navigated to ${clickResult.newUrl})` : ""}`,
        });
      }
    }

    return results;
  }
}