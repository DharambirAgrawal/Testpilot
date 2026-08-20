# TestPilot

![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript&logoColor=white)
![Node](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)
![Status](https://img.shields.io/badge/status-early--stage-yellow)

**A GitHub Copilot Extension that tests your frontend in a real browser, then hands Copilot a fix list.**

AI coding agents can write UI code, but they can't see whether it works — they don't know if a button throws an error, a form fails to submit, or a page overflows on mobile. TestPilot closes that gap: point it at a local URL and it opens the page in headless Chrome, crawls the app, fills out forms, clicks buttons, checks the layout, and reports concrete, actionable failures back to Copilot Chat.

## Features

- **Page discovery** — crawls up to 10 pages from a starting URL, following internal links
- **Error detection** — captures console errors, uncaught JS exceptions, and failed network requests (4xx/5xx) as they happen
- **Form testing** — finds every form on a page, fills fields with type-appropriate test data (email, password, phone, date, etc.), submits, and watches for errors or missing validation
- **Click testing** — clicks every button/link on a page and checks for crashes or broken navigation
- **Visual checks** — screenshots each page, flags horizontal overflow, broken images, missing `alt` text, and overlapping interactive elements; re-checks the layout at a 375px mobile viewport
- **Structured reporting** — compiles all results into a pass/fail/warning summary with per-issue fix suggestions, formatted for Copilot Chat or as raw JSON

## Tech stack

- **TypeScript** (strict mode) on **Node.js**
- **Express** — serves the Copilot Extension endpoint (SSE) and a plain REST API
- **Puppeteer** — drives headless Chrome for navigation, DOM inspection, and screenshots

## How it works

```
Copilot Chat
     │
     ▼
TestPilot Extension (Express server)
     │
     ▼
Puppeteer → headless Chrome
     │
     ▼
Crawl → fill forms → click buttons → check layout
     │
     ▼
Structured report + fix instructions → back to Copilot
```

There are no mocks and no static analysis — every check runs against the real, rendered page. The server exposes two things: a `/` endpoint that speaks the Copilot Extension SSE protocol (`text/event-stream`), and a plain `POST /api/test` endpoint for calling it directly without Copilot.

## Getting started

Requires Node.js and npm.

```bash
git clone https://github.com/DharambirAgrawal/Testpilot.git
cd Testpilot
npm install
npm run build
npm start
```

The server starts on port `8765` by default (override with the `PORT` environment variable). For local development without a build step:

```bash
npm run dev
```

## Usage

### Via Copilot Chat

Register the extension using `.github/copilot-extensions.yaml`, then invoke it in Copilot Chat:

```
@autotest test http://localhost:3000
```

Scope the run to a specific check:

```
@autotest test forms on http://localhost:3000/login
@autotest test clicks on http://localhost:3000/dashboard
@autotest test visual http://localhost:3000
```

### Via the direct API

```bash
curl -X POST http://localhost:8765/api/test \
  -H "Content-Type: application/json" \
  -d '{"url": "http://localhost:3000", "testType": "full"}'
```

`testType` accepts `full`, `navigation`, `forms`, `clicks`, or `visual`. The response is the same structured `TestReport` JSON that Copilot receives, including a summary, a pass/fail/warning breakdown, and per-issue fix instructions.

## Project structure

```
src/
├── index.ts              # Express server + Copilot SSE endpoint + request parsing
├── browser/
│   └── engine.ts          # Puppeteer wrapper: navigation, DOM scraping, clicking, filling
├── tester/
│   ├── navigator.ts        # Page crawling, console/network error capture
│   ├── formTester.ts       # Form filling, submission, validation checks
│   ├── clickTester.ts      # Button/link interaction testing
│   └── visualChecker.ts    # Overflow, broken images, alt text, mobile viewport
├── reporter/
│   └── reporter.ts         # Compiles results into a report with fix suggestions
└── types.ts                # Shared TypeScript interfaces
```

## Status

Early-stage and experimental. It works end-to-end for its core loop (crawl → interact → report), but there's no test suite yet, error handling is basic, and it hasn't been hardened against complex or auth-gated apps. It's built to be fast and useful for local development, not to replace a real E2E testing framework.
