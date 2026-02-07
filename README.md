# ✈️ TestPilot

**Autonomous Frontend Testing for GitHub Copilot**

AI coding agents are great at writing code.
They’re terrible at knowing whether the UI actually works.

They can’t click buttons.
They can’t submit forms.
They can’t see broken layouts.

**TestPilot gives Copilot eyes.**

---

## What is TestPilot?

TestPilot is a GitHub Copilot extension that **autonomously tests your frontend** by opening it in a real browser, interacting with it like a user, and reporting concrete issues back to Copilot with clear fix instructions.

Think of it as a test pilot flying your UI before you ship it.

---

## Why this exists

Copilot, Cursor, and other AI coding agents are effectively **blind to the frontend**.

They:

* Don’t know if a button actually works
* Can’t tell if a form crashes on submit
* Can’t see console errors
* Can’t detect broken layouts or mobile issues

So they generate code… and hope.

TestPilot closes that loop.

---

## What TestPilot does

Given a local URL, TestPilot will automatically:

1. **Discover**

   * Crawl up to 10 pages starting from your URL
   * Follow internal links

2. **Detect**

   * Console errors
   * JavaScript crashes
   * Network failures (4xx / 5xx)

3. **Fill**

   * Find all forms
   * Populate inputs with smart test data
   * Submit and watch for failures

4. **Click**

   * Find buttons and links
   * Click them safely
   * Detect crashes or navigation issues

5. **Visual Check**

   * Take screenshots
   * Detect horizontal overflow
   * Catch broken images
   * Test mobile viewport

6. **Report**

   * Send a clean, structured report back to Copilot
   * Include actionable fix notes (not vague errors)

---

## How it works (simple architecture)

```
Copilot Chat
     ↓
TestPilot Extension
     ↓
Real Browser (Puppeteer)
     ↓
UI Interaction + Screenshots
     ↓
Structured Report → Copilot
```

No mocks. No guesses.
Just a real browser testing your real UI.

---

## Project structure

```
autotest-copilot/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Copilot chat entry point
│   ├── browser/
│   │   └── engine.ts         # Puppeteer browser control
│   ├── tester/
│   │   ├── navigator.ts      # Page crawling & discovery
│   │   ├── formTester.ts     # Form filling & submission
│   │   ├── clickTester.ts    # Button & link testing
│   │   └── visualChecker.ts  # Screenshots & visual checks
│   ├── reporter/
│   │   └── reporter.ts       # Compiles results for Copilot
│   └── types.ts              # Shared types
├── .github/
│   └── copilot-extensions.yml
└── README.md
```

---

## Setup

```bash
# Install dependencies
npm install

# Build
npm run build

# Start the extension server
npm start
```

---

## Using TestPilot with Copilot Chat

Inside GitHub Copilot Chat:

```
@autotest test http://localhost:3000
```

Target specific areas:

```
@autotest test forms on http://localhost:3000/login
@autotest test clicks on http://localhost:3000/dashboard
@autotest test visual http://localhost:3000
```

TestPilot runs immediately and reports back.

---

## Example report sent to Copilot

```md
## TestPilot Report for http://localhost:3000

Results: 8 passed, 3 failed, 1 warning

### ❌ Failures
- console-errors (/signup)
  TypeError: Cannot read properties of undefined (reading 'map')

- form-1-submit (/signup)
  POST /api/register → 500 Internal Server Error

- mobile-overflow (/)
  Horizontal overflow detected on mobile viewport

## Fix Instructions
- Guard the `.map()` call — a variable is undefined
- Investigate `/api/register` server-side handler
- Fix responsive layout (likely fixed-width element)
```

Copilot can now **fix the issues and re-run TestPilot** to verify.

---

## What TestPilot is (and isn’t)

✅ Autonomous
✅ Real browser
✅ UI-focused
✅ Built for AI agents

❌ Not a replacement for unit tests
❌ Not a full E2E framework
❌ Not meant to be perfect — meant to be fast and useful

---

## Status

This project is **early and experimental**.
The goal is to prove that AI agents don’t have to be blind to the frontend anymore.

If you’re building with Copilot and care whether your UI actually works — TestPilot is for you.

---

## License

MIT
