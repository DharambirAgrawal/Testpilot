// src/index.ts

import express, { Request, Response } from "express";
import { BrowserEngine } from "./browser/engine";
import { NavigationTester } from "./tester/navigator";
import { FormTester } from "./tester/formTester";
import { ClickTester } from "./tester/clickTester";
import { VisualChecker } from "./tester/visualChecker";
import { Reporter } from "./reporter/reporter";
import { TestResult, TestRequest } from "./types";

const app = express();
app.use(express.json());

// ============================================
// GitHub Copilot Extension Endpoint
// ============================================

app.post("/", async (req: Request, res: Response) => {
  // Copilot sends messages in this format
  const messages = req.body.messages || [];
  const lastMessage = messages[messages.length - 1]?.content || "";

  // Set SSE headers for streaming response (Copilot protocol)
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  function sendSSE(data: string) {
    const payload = JSON.stringify({
      choices: [{ index: 0, delta: { content: data, role: "assistant" } }],
    });
    res.write(`data: ${payload}\n\n`);
  }

  function endSSE() {
    const payload = JSON.stringify({
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    });
    res.write(`data: ${payload}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }

  try {
    // Parse the user's request
    const testReq = parseRequest(lastMessage);

    if (!testReq) {
      sendSSE(
        "I can test your frontend for you. Tell me what to test:\n\n" +
          "**Examples:**\n" +
          "- `test http://localhost:3000` - Full test (navigation, forms, buttons, visuals)\n" +
          "- `test forms on http://localhost:3000/signup` - Test only forms\n" +
          "- `test clicks on http://localhost:3000` - Test all buttons\n" +
          "- `test visual http://localhost:3000` - Check visual/layout issues\n"
      );
      endSSE();
      return;
    }

    sendSSE(`🔍 Starting ${testReq.testType || "full"} test on **${testReq.url}**...\n\n`);

    // Run the tests
    const report = await runTests(testReq, (update: string) => {
      sendSSE(update);
    });

    // Format and send results
    const reporter = new Reporter();
    const formatted = reporter.formatForCopilot(report);
    sendSSE(formatted);

    endSSE();
  } catch (error: any) {
    sendSSE(`\n❌ Error during testing: ${error.message}\n`);
    endSSE();
  }
});

// Also expose a direct API for non-Copilot usage
app.post("/api/test", async (req: Request, res: Response) => {
  const testReq: TestRequest = req.body;

  if (!testReq.url) {
    res.status(400).json({ error: "url is required" });
    return;
  }

  try {
    const report = await runTests(testReq);
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get("/", (req: Request, res: Response) => {
  res.json({
    name: "AutoTest Copilot Extension",
    status: "running",
    description: "Autonomous frontend testing for GitHub Copilot",
  });
});

// ============================================
// Request Parser
// ============================================

function parseRequest(message: string): TestRequest | null {
  // Extract URL
  const urlMatch = message.match(
    /(https?:\/\/[^\s]+|localhost:\d+[^\s]*)/i
  );

  if (!urlMatch) return null;

  let url = urlMatch[1];
  if (!url.startsWith("http")) {
    url = "http://" + url;
  }

  // Determine test type
  const lower = message.toLowerCase();
  let testType: TestRequest["testType"] = "full";

  if (lower.includes("form")) testType = "forms";
  else if (lower.includes("click") || lower.includes("button")) testType = "clicks";
  else if (lower.includes("visual") || lower.includes("layout") || lower.includes("design"))
    testType = "visual";
  else if (lower.includes("nav")) testType = "navigation";

  // Extract context if provided
  const contextMatch = message.match(/context:\s*(.+)/i);

  return {
    url,
    testType,
    context: contextMatch ? contextMatch[1].trim() : undefined,
  };
}

// ============================================
// Test Runner
// ============================================

async function runTests(
  testReq: TestRequest,
  onProgress?: (msg: string) => void
): Promise<ReturnType<Reporter["compile"]>> {
  const browser = new BrowserEngine();
  const allResults: TestResult[] = [];

  try {
    await browser.launch();
    const log = (msg: string) => onProgress && onProgress(msg);

    const runNav = testReq.testType === "full" || testReq.testType === "navigation";
    const runForms = testReq.testType === "full" || testReq.testType === "forms";
    const runClicks = testReq.testType === "full" || testReq.testType === "clicks";
    const runVisual = testReq.testType === "full" || testReq.testType === "visual";

    // Step 1: Navigate and discover pages
    log("📄 Discovering pages and checking for errors...\n");
    const navigator = new NavigationTester(browser);
    const { results: navResults, pages } = await navigator.discoverAndTestPages(testReq.url);

    if (runNav) {
      allResults.push(...navResults);
    }

    log(
      `Found ${pages.length} page(s), ${pages.reduce((s, p) => s + p.forms.length, 0)} form(s), ${pages.reduce((s, p) => s + p.buttons.length, 0)} button(s)\n\n`
    );

    // Step 2: Test forms
    if (runForms) {
      const formTester = new FormTester(browser);
      for (const page of pages) {
        if (page.forms.length > 0) {
          log(`📝 Testing ${page.forms.length} form(s) on ${page.url}...\n`);
          const formResults = await formTester.testForms(page.url, page.forms);
          allResults.push(...formResults);
        }
      }
    }

    // Step 3: Test button clicks
    if (runClicks) {
      const clickTester = new ClickTester(browser);
      for (const page of pages) {
        const testableButtons = page.buttons.filter(
          (b) => b.type !== "submit" && !b.disabled && b.text.length > 0
        );
        if (testableButtons.length > 0) {
          log(`🖱️ Testing ${testableButtons.length} button(s) on ${page.url}...\n`);
          const clickResults = await clickTester.testButtons(page.url, page.buttons);
          allResults.push(...clickResults);
        }
      }
    }

    // Step 4: Visual checks
    if (runVisual) {
      const visualChecker = new VisualChecker(browser);
      for (const page of pages) {
        log(`👁️ Checking visual layout on ${page.url}...\n`);
        const visualResults = await visualChecker.checkPage(page.url);
        allResults.push(...visualResults);
      }
    }

    log("\n✅ Testing complete.\n\n");
  } finally {
    await browser.close();
  }

  const reporter = new Reporter();
  return reporter.compile(testReq.url, allResults);
}

// ============================================
// Start Server
// ============================================

const PORT = process.env.PORT || 8765;
app.listen(PORT, () => {
  console.log(`🚀 AutoTest running on port ${PORT}`);
  console.log(`   Copilot endpoint: http://localhost:${PORT}/`);
  console.log(`   Direct API: POST http://localhost:${PORT}/api/test`);
});