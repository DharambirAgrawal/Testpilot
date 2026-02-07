// src/browser/engine.ts

import puppeteer, { Browser, Page } from "puppeteer";
import { PageInfo, ConsoleError, LinkInfo, FormInfo, ButtonInfo, FieldInfo } from "../types";

export class BrowserEngine {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private consoleErrors: ConsoleError[] = [];

  async launch(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--window-size=1280,800",
      ],
    });
  }

  async newPage(): Promise<Page> {
    if (!this.browser) throw new Error("Browser not launched");

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1280, height: 800 });
    this.consoleErrors = [];

    // Capture console errors
    this.page.on("console", (msg) => {
      if (msg.type() === "error") {
        this.consoleErrors.push({
          type: "console-error",
          text: msg.text(),
        });
      }
    });

    // Capture page errors
    this.page.on("pageerror", (err) => {
      this.consoleErrors.push({
        type: "page-error",
        text: err.message,
      });
    });

    // Capture failed requests
    this.page.on("requestfailed", (req) => {
      this.consoleErrors.push({
        type: "network-error",
        text: `${req.method()} ${req.url()} - ${req.failure()?.errorText || "failed"}`,
        url: req.url(),
      });
    });

    return this.page;
  }

  async goto(url: string): Promise<boolean> {
    if (!this.page) throw new Error("No page open");
    try {
      const response = await this.page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 15000,
      });
      return response !== null && response.ok();
    } catch (e: any) {
      this.consoleErrors.push({
        type: "navigation-error",
        text: `Failed to navigate to ${url}: ${e.message}`,
        url,
      });
      return false;
    }
  }

  async screenshot(): Promise<string> {
    if (!this.page) throw new Error("No page open");
    const buffer = await this.page.screenshot({ encoding: "base64", fullPage: true });
    return buffer as string;
  }

  async getPageInfo(url: string): Promise<PageInfo> {
    if (!this.page) throw new Error("No page open");

    const title = await this.page.title();

    // Get all links
    const links: LinkInfo[] = await this.page.evaluate((baseUrl: string) => {
      const anchors = Array.from(document.querySelectorAll("a[href]"));
      return anchors.map((a) => {
        const href = (a as HTMLAnchorElement).href;
        return {
          text: (a.textContent || "").trim().substring(0, 100),
          href,
          isInternal: href.startsWith(baseUrl) || href.startsWith("/"),
        };
      });
    }, url);

    // Get all forms
    const forms: FormInfo[] = await this.page.evaluate(() => {
      const formEls = Array.from(document.querySelectorAll("form"));
      return formEls.map((form) => {
        const fields = Array.from(
          form.querySelectorAll("input, select, textarea")
        ).map((el) => {
          const input = el as HTMLInputElement;
          // Find label
          let label = "";
          if (input.id) {
            const labelEl = document.querySelector(`label[for="${input.id}"]`);
            if (labelEl) label = (labelEl.textContent || "").trim();
          }
          if (!label) {
            const parent = input.closest("label");
            if (parent) label = (parent.textContent || "").trim();
          }

          return {
            type: input.type || el.tagName.toLowerCase(),
            name: input.name || "",
            id: input.id || "",
            placeholder: input.placeholder || "",
            required: input.required,
            label,
          };
        });

        const submitBtn = form.querySelector(
          'button[type="submit"], input[type="submit"]'
        );

        return {
          action: form.action || "",
          method: (form.method || "GET").toUpperCase(),
          fields,
          submitButton: submitBtn
            ? (submitBtn.textContent || (submitBtn as HTMLInputElement).value || "Submit").trim()
            : null,
          id: form.id || undefined,
        };
      });
    });

    // Get all buttons (outside forms too)
    const buttons: ButtonInfo[] = await this.page.evaluate(() => {
      const btnEls = Array.from(
        document.querySelectorAll(
          'button, [role="button"], input[type="button"]'
        )
      );
      return btnEls.map((el, i) => {
        const btn = el as HTMLButtonElement;
        let selector = "";
        if (btn.id) selector = `#${btn.id}`;
        else if (btn.className) selector = `${btn.tagName.toLowerCase()}.${btn.className.split(" ")[0]}`;
        else selector = `button:nth-of-type(${i + 1})`;

        return {
          text: (btn.textContent || (btn as HTMLInputElement).value || "").trim().substring(0, 100),
          type: btn.type || "button",
          id: btn.id || "",
          disabled: btn.disabled,
          selector,
        };
      });
    });

    const screenshotBase64 = await this.screenshot();

    return {
      url,
      title,
      links,
      forms,
      buttons,
      errors: [...this.consoleErrors],
      screenshot: screenshotBase64,
    };
  }

  async click(selector: string): Promise<{ success: boolean; error?: string; newUrl?: string }> {
    if (!this.page) throw new Error("No page open");
    try {
      await this.page.waitForSelector(selector, { timeout: 5000 });
      const beforeUrl = this.page.url();
      await this.page.click(selector);
      // Wait a bit for any navigation or render
      await this.page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1500)));
      try {
        await this.page.waitForNetworkIdle({ timeout: 3000 });
      } catch {}
      return { success: true, newUrl: this.page.url() !== beforeUrl ? this.page.url() : undefined };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async fillField(selector: string, value: string): Promise<boolean> {
    if (!this.page) throw new Error("No page open");
    try {
      await this.page.waitForSelector(selector, { timeout: 5000 });
      await this.page.click(selector, { clickCount: 3 }); // select all
      await this.page.type(selector, value, { delay: 30 });
      return true;
    } catch {
      return false;
    }
  }

  async selectOption(selector: string, value: string): Promise<boolean> {
    if (!this.page) throw new Error("No page open");
    try {
      await this.page.select(selector, value);
      return true;
    } catch {
      return false;
    }
  }

  async waitForNavigation(timeout = 5000): Promise<boolean> {
    if (!this.page) throw new Error("No page open");
    try {
      await this.page.waitForNavigation({ timeout, waitUntil: "networkidle2" });
      return true;
    } catch {
      return false;
    }
  }

  async getCurrentUrl(): Promise<string> {
    if (!this.page) return "";
    return this.page.url();
  }

  async getConsoleErrors(): Promise<ConsoleError[]> {
    return [...this.consoleErrors];
  }

  async getPageText(): Promise<string> {
    if (!this.page) return "";
    return this.page.evaluate(() => document.body.innerText || "");
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}