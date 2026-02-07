// src/reporter/reporter.ts

import { TestReport, TestResult } from "../types";

export class Reporter {
  compile(url: string, results: TestResult[]): TestReport {
    const passed = results.filter((r) => r.status === "pass").length;
    const failed = results.filter((r) => r.status === "fail").length;
    const warnings = results.filter((r) => r.status === "warning").length;

    const summary = this.buildSummary(url, results, passed, failed, warnings);
    const fixInstructions = this.buildFixInstructions(results);

    return {
      url,
      timestamp: new Date().toISOString(),
      totalTests: results.length,
      passed,
      failed,
      warnings,
      results,
      summary,
      fixInstructions,
    };
  }

  private buildSummary(
    url: string,
    results: TestResult[],
    passed: number,
    failed: number,
    warnings: number
  ): string {
    let summary = `## AutoTest Report for ${url}\n\n`;
    summary += `**Results:** ${passed} passed, ${failed} failed, ${warnings} warnings\n\n`;

    if (failed === 0 && warnings === 0) {
      summary += `✅ All tests passed! The frontend appears to be working correctly.\n`;
      return summary;
    }

    if (failed > 0) {
      summary += `### ❌ Failures\n`;
      for (const r of results.filter((r) => r.status === "fail")) {
        summary += `- **${r.test}** (${r.page}): ${r.message}\n`;
        if (r.details) summary += `  \`\`\`\n  ${r.details}\n  \`\`\`\n`;
      }
      summary += "\n";
    }

    if (warnings > 0) {
      summary += `### ⚠️ Warnings\n`;
      for (const r of results.filter((r) => r.status === "warning")) {
        summary += `- **${r.test}** (${r.page}): ${r.message}\n`;
      }
      summary += "\n";
    }

    return summary;
  }

  private buildFixInstructions(results: TestResult[]): string {
    const failures = results.filter((r) => r.status === "fail");

    if (failures.length === 0) {
      return "No fixes needed. All tests passed.";
    }

    let instructions = "## Fix Instructions\n\n";
    instructions += "The following issues were found by testing the actual frontend in a browser:\n\n";

    for (const failure of failures) {
      instructions += `### Issue: ${failure.test}\n`;
      instructions += `- **Page:** ${failure.page}\n`;
      instructions += `- **Problem:** ${failure.message}\n`;

      if (failure.details) {
        instructions += `- **Details:**\n\`\`\`\n${failure.details}\n\`\`\`\n`;
      }

      // Add contextual fix hints
      instructions += `- **Suggested fix:** ${this.suggestFix(failure)}\n\n`;
    }

    return instructions;
  }

  private suggestFix(result: TestResult): string {
    const test = result.test.toLowerCase();
    const msg = result.message.toLowerCase();

    if (test.includes("console-error") || test.includes("page-error")) {
      return "Check the browser console errors above. These are JavaScript runtime errors in your code. Look at the error message and stack trace to find the source file and line.";
    }

    if (test.includes("network-error")) {
      return "API or resource requests are failing. Check that your API endpoints exist, the server is running, and URLs are correct. Check CORS settings if it's a cross-origin request.";
    }

    if (test.includes("form") && test.includes("fill")) {
      return "Form fields could not be interacted with. Ensure input fields have proper 'name' or 'id' attributes and are not hidden or overlapped by other elements.";
    }

    if (test.includes("form") && test.includes("submit")) {
      return "Form submission caused errors. Check your form submission handler, ensure the API endpoint exists, and verify error handling in the submit function.";
    }

    if (test.includes("click") && test.includes("button")) {
      return "A button click caused errors. Check the onClick handler for this button, verify any state changes it triggers, and ensure referenced variables/functions exist.";
    }

    if (test.includes("overflow")) {
      return "Content is wider than the viewport causing horizontal scroll. Check for fixed-width elements, missing overflow:hidden, or elements with absolute positioning outside the viewport.";
    }

    if (test.includes("broken-images")) {
      return "Some images are not loading. Verify image file paths, ensure files exist in the correct directory, and check that the image URLs are correct.";
    }

    if (test.includes("has-content")) {
      return "The page appears blank or empty. Check if the root component is rendering, verify there are no JavaScript errors preventing render, and ensure data fetching is working.";
    }

    if (msg.includes("error text")) {
      return "The page is displaying an error message to the user. This could be a React error boundary, a 404 page, or an unhandled error. Check the component rendering logic.";
    }

    return "Review the error details above and fix the underlying code issue.";
  }

  formatForCopilot(report: TestReport): string {
    let output = report.summary + "\n";

    if (report.failed > 0) {
      output += report.fixInstructions + "\n";
      output += "---\n";
      output += "Please fix the above issues. After fixing, I can test again to verify.\n";
    }

    return output;
  }
}