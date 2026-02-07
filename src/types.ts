// src/types.ts

export interface TestRequest {
  url: string;
  context?: string;        // what the agent just did/changed
  testType?: "full" | "forms" | "navigation" | "clicks" | "visual";
}

export interface PageInfo {
  url: string;
  title: string;
  links: LinkInfo[];
  forms: FormInfo[];
  buttons: ButtonInfo[];
  errors: ConsoleError[];
  screenshot: string;      // base64
}

export interface LinkInfo {
  text: string;
  href: string;
  isInternal: boolean;
}

export interface FormInfo {
  action: string;
  method: string;
  fields: FieldInfo[];
  submitButton: string | null;
  id?: string;
}

export interface FieldInfo {
  type: string;
  name: string;
  id: string;
  placeholder: string;
  required: boolean;
  label: string;
}

export interface ButtonInfo {
  text: string;
  type: string;
  id: string;
  disabled: boolean;
  selector: string;
}

export interface ConsoleError {
  type: string;
  text: string;
  url?: string;
  line?: number;
}

export interface TestResult {
  page: string;
  test: string;
  status: "pass" | "fail" | "warning";
  message: string;
  screenshot?: string;
  details?: string;
}

export interface TestReport {
  url: string;
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  warnings: number;
  results: TestResult[];
  summary: string;          // human-readable summary for Copilot
  fixInstructions: string;  // actionable fix notes for the agent
}