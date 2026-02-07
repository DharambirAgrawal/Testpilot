// src/tester/formTester.ts

import { BrowserEngine } from "../browser/engine";
import { FormInfo, TestResult } from "../types";

// Test data generators
const TEST_DATA: Record<string, string> = {
  email: "testuser@example.com",
  password: "TestPass123!",
  text: "Test input value",
  name: "John Doe",
  tel: "1234567890",
  phone: "1234567890",
  number: "42",
  url: "https://example.com",
  search: "test search query",
  date: "2024-01-15",
  color: "#ff0000",
};

function getTestValue(field: { type: string; name: string; label: string; placeholder: string }): string {
  // Try to match by name/label/placeholder
  const identifier = `${field.name} ${field.label} ${field.placeholder}`.toLowerCase();

  if (identifier.includes("email")) return TEST_DATA.email;
  if (identifier.includes("password") || identifier.includes("pass")) return TEST_DATA.password;
  if (identifier.includes("name") || identifier.includes("first") || identifier.includes("last"))
    return TEST_DATA.name;
  if (identifier.includes("phone") || identifier.includes("tel")) return TEST_DATA.tel;
  if (identifier.includes("url") || identifier.includes("website")) return TEST_DATA.url;
  if (identifier.includes("search")) return TEST_DATA.search;
  if (identifier.includes("date")) return TEST_DATA.date;

  // Fall back to type
  return TEST_DATA[field.type] || TEST_DATA.text;
}

export class FormTester {
  constructor(private browser: BrowserEngine) {}

  async testForms(pageUrl: string, forms: FormInfo[]): Promise<TestResult[]> {
    const results: TestResult[] = [];

    if (forms.length === 0) {
      results.push({
        page: pageUrl,
        test: "form-presence",
        status: "pass",
        message: "No forms found on page (nothing to test)",
      });
      return results;
    }

    for (let i = 0; i < forms.length; i++) {
      const form = forms[i];
      const formId = form.id || `form-${i + 1}`;

      // Test 1: Check form has a submit mechanism
      if (!form.submitButton && form.fields.length > 0) {
        results.push({
          page: pageUrl,
          test: `${formId}-submit-button`,
          status: "warning",
          message: `Form "${formId}" has no visible submit button`,
        });
      }

      // Test 2: Try filling out the form
      if (form.fields.length === 0) {
        results.push({
          page: pageUrl,
          test: `${formId}-fields`,
          status: "warning",
          message: `Form "${formId}" has no input fields`,
        });
        continue;
      }

      // Navigate fresh to the page for each form test
      await this.browser.goto(pageUrl);

      let allFieldsFilled = true;
      const fieldErrors: string[] = [];

      for (const field of form.fields) {
        if (field.type === "hidden" || field.type === "submit") continue;

        const selector = field.id
          ? `#${field.id}`
          : field.name
            ? `[name="${field.name}"]`
            : null;

        if (!selector) {
          fieldErrors.push(`Could not find selector for field: ${field.label || field.name || "unknown"}`);
          allFieldsFilled = false;
          continue;
        }

        if (field.type === "select" || field.type === "select-one") {
          const selected = await this.browser.selectOption(selector, "");
          if (!selected) {
            fieldErrors.push(`Could not interact with select: ${selector}`);
            allFieldsFilled = false;
          }
          continue;
        }

        if (field.type === "checkbox" || field.type === "radio") {
          const clicked = await this.browser.click(selector);
          if (!clicked.success) {
            fieldErrors.push(`Could not click ${field.type}: ${selector}`);
            allFieldsFilled = false;
          }
          continue;
        }

        const testValue = getTestValue(field);
        const filled = await this.browser.fillField(selector, testValue);
        if (!filled) {
          fieldErrors.push(`Could not fill field: ${selector} (${field.label || field.name})`);
          allFieldsFilled = false;
        }
      }

      if (allFieldsFilled) {
        results.push({
          page: pageUrl,
          test: `${formId}-fill`,
          status: "pass",
          message: `All fields in "${formId}" were filled successfully`,
        });
      } else {
        results.push({
          page: pageUrl,
          test: `${formId}-fill`,
          status: "fail",
          message: `Some fields in "${formId}" could not be filled`,
          details: fieldErrors.join("\n"),
        });
      }

      // Test 3: Submit the form
      if (form.submitButton) {
        const submitSelector = form.id
          ? `#${form.id} button[type="submit"], #${form.id} input[type="submit"]`
          : `form:nth-of-type(${i + 1}) button[type="submit"], form:nth-of-type(${i + 1}) input[type="submit"]`;

        const errorsBefore = (await this.browser.getConsoleErrors()).length;
        const clickResult = await this.browser.click(submitSelector);

        if (!clickResult.success) {
          results.push({
            page: pageUrl,
            test: `${formId}-submit`,
            status: "fail",
            message: `Could not click submit button for "${formId}"`,
            details: clickResult.error,
          });
        } else {
          // Check for new errors after submit
          const errorsAfter = await this.browser.getConsoleErrors();
          const newErrors = errorsAfter.slice(errorsBefore);

          if (newErrors.length > 0) {
            results.push({
              page: pageUrl,
              test: `${formId}-submit`,
              status: "fail",
              message: `Form "${formId}" submission caused ${newErrors.length} error(s)`,
              details: newErrors.map((e) => e.text).join("\n"),
              screenshot: await this.browser.screenshot(),
            });
          } else {
            results.push({
              page: pageUrl,
              test: `${formId}-submit`,
              status: "pass",
              message: `Form "${formId}" submitted without errors`,
              screenshot: await this.browser.screenshot(),
            });
          }
        }
      }

      // Test 4: Submit empty form (validation check)
      await this.browser.goto(pageUrl);

      const requiredFields = form.fields.filter((f) => f.required);
      if (requiredFields.length > 0 && form.submitButton) {
        const submitSelector = form.id
          ? `#${form.id} button[type="submit"], #${form.id} input[type="submit"]`
          : `form:nth-of-type(${i + 1}) button[type="submit"]`;

        await this.browser.click(submitSelector);

        // Check if validation messages appear (page should NOT navigate away)
        const currentUrl = await this.browser.getCurrentUrl();
        if (currentUrl === pageUrl || currentUrl === pageUrl + "/") {
          results.push({
            page: pageUrl,
            test: `${formId}-validation`,
            status: "pass",
            message: `Form "${formId}" correctly blocks empty submission (has required fields)`,
          });
        } else {
          results.push({
            page: pageUrl,
            test: `${formId}-validation`,
            status: "warning",
            message: `Form "${formId}" has required fields but submitted empty (validation may be missing)`,
          });
        }
      }
    }

    return results;
  }
}