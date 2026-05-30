import { useEffect, useMemo, useState } from "react";
import "./App.css";

type LocatorStrategy = "playwright" | "xpath" | "css";

interface LocatorCandidate {
  type: string;
  locator: string;
  isUnique: boolean;
  count: number;
  confidence: number;
  reason: string;
}

interface RecordedAction {
  action: "click" | "fill" | "check" | "selectOption";
  value?: string;
  url: string;
  tagName: string;
  text?: string;
  bestLocator: string;
  locatorType: string;
  confidence: number;
  reason: string;
  locatorCandidates: LocatorCandidate[];
  timestamp: string;
}

interface InspectedElement {
  selectedMode: LocatorStrategy;
  tagName: string;
  text?: string;
  value?: string;
  bestLocator: string;
  locatorType: string;
  confidence: number;
  reason: string;
  locatorCandidates: LocatorCandidate[];
  url: string;
  timestamp: string;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  instruction?: string;
  currentUrl?: string;
  usingExistingBrowser?: boolean;
  actions?: RecordedAction[];
  count?: number;
  inspectedElement?: InspectedElement | null;
  replayedActions?: number;
  applicationUrl?: string;
  data?: T;
}

const API_BASE_URL = "http://localhost:5000/api/recorder";

function App() {
  const [applicationUrl, setApplicationUrl] = useState<string>(
    "https://www.saucedemo.com/"
  );

  const [selectedStrategy, setSelectedStrategy] =
    useState<LocatorStrategy>("playwright");

  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isInspectorStarted, setIsInspectorStarted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [statusMessage, setStatusMessage] = useState<string>(
    "Ready to start AI Playwright Smart Recorder."
  );

  const [recordedActions, setRecordedActions] = useState<RecordedAction[]>([]);
  const [inspectedElement, setInspectedElement] =
    useState<InspectedElement | null>(null);

  const [generatedScript, setGeneratedScript] = useState<string>("");

  const latestBestLocator = useMemo(() => {
    if (!inspectedElement) return "";
    return inspectedElement.bestLocator || "";
  }, [inspectedElement]);

  async function callApi<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      const text = await response.text();
      throw new Error(text || `Unexpected non-JSON response from ${endpoint}`);
    }

    const data = (await response.json()) as ApiResponse<T>;

    if (!response.ok || !data.success) {
      throw new Error(data.message || data.error || "API request failed.");
    }

    return data;
  }

  async function startRecording(): Promise<void> {
    try {
      setIsLoading(true);
      setStatusMessage("Starting recording...");

      const response = await callApi("/start", {
        method: "POST",
        body: JSON.stringify({
          applicationUrl,
          strategy: selectedStrategy,
        }),
      });

      setIsRecording(true);
      setRecordedActions([]);
      setGeneratedScript("");
      setStatusMessage(
        response.message ||
          `Recording started with ${selectedStrategy} strategy.`
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to start recording."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function stopRecording(): Promise<void> {
    try {
      setIsLoading(true);
      setStatusMessage("Stopping recording...");

      const response = await callApi("/stop", {
        method: "POST",
      });

      setIsRecording(false);
      setRecordedActions(response.actions || []);
      setStatusMessage(response.message || "Recording stopped successfully.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to stop recording."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchRecordedActions(): Promise<void> {
    try {
      const response = await callApi("/actions", {
        method: "GET",
      });

      setRecordedActions(response.actions || []);
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Failed to fetch recorded actions."
      );
    }
  }

  async function clearRecordedActions(): Promise<void> {
    try {
      setIsLoading(true);

      const response = await callApi("/clear-actions", {
        method: "POST",
      });

      setRecordedActions([]);
      setGeneratedScript("");
      setStatusMessage(response.message || "Recorded actions cleared.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Failed to clear recorded actions."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function startInspector(): Promise<void> {
    try {
      setIsLoading(true);
      setStatusMessage("Starting Smart Inspector popup...");

      const response = await callApi("/start-inspector", {
        method: "POST",
        body: JSON.stringify({
          applicationUrl,
          mode: selectedStrategy,
        }),
      });

      setIsInspectorStarted(true);
      setStatusMessage(
        response.instruction ||
          response.message ||
          "Smart Inspector popup started successfully."
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to start inspector."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function stopInspector(): Promise<void> {
    try {
      setIsLoading(true);
      setStatusMessage("Stopping Smart Inspector...");

      const response = await callApi("/stop-inspector", {
        method: "POST",
      });

      setIsInspectorStarted(false);
      setInspectedElement(null);
      setStatusMessage(response.message || "Smart Inspector stopped.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to stop inspector."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchInspectedElement(): Promise<void> {
    try {
      const response = await callApi("/inspected-element", {
        method: "GET",
      });

      setInspectedElement(response.inspectedElement || null);
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Failed to fetch inspected element."
      );
    }
  }

  async function replayRecordedActions(): Promise<void> {
    try {
      setIsLoading(true);
      setStatusMessage("Executing recorded test replay...");

      const response = await callApi("/replay", {
        method: "POST",
        body: JSON.stringify({
          applicationUrl,
        }),
      });

      setStatusMessage(
        response.message ||
          `Replay completed. Actions replayed: ${response.replayedActions || 0}`
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Replay execution failed."
      );
    } finally {
      setIsLoading(false);
    }
  }

  function generatePlaywrightScript(): void {
    const actions = recordedActions;

    if (actions.length === 0) {
      setGeneratedScript("// No recorded actions available.");
      setStatusMessage("No recorded actions available to generate script.");
      return;
    }

    const lines: string[] = [
      "import { test, expect } from '@playwright/test';",
      "",
      "test('AI Smart Recorder generated test', async ({ page }) => {",
      `  await page.goto('${applicationUrl}');`,
      "",
    ];

    for (const action of actions) {
      const locator = action.bestLocator;

      if (!locator) {
        lines.push("  // Skipped action because no stable locator was generated.");
        continue;
      }

      if (action.action === "click") {
        lines.push(`  await ${locator}.click();`);
      }

      if (action.action === "fill") {
        lines.push(
          `  await ${locator}.fill('${escapeForGeneratedScript(
            action.value || ""
          )}');`
        );
      }

      if (action.action === "check") {
        lines.push(`  await ${locator}.check();`);
      }

      if (action.action === "selectOption") {
        lines.push(
          `  await ${locator}.selectOption('${escapeForGeneratedScript(
            action.value || ""
          )}');`
        );
      }
    }

    lines.push("");
    lines.push("  await expect(page).toHaveURL(/.*/);");
    lines.push("});");

    setGeneratedScript(lines.join("\n"));
    setStatusMessage("Playwright script generated successfully.");
  }

  function escapeForGeneratedScript(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }

  useEffect(() => {
    let intervalId: number | undefined;

    if (isInspectorStarted) {
      intervalId = window.setInterval(() => {
        void fetchInspectedElement();
      }, 1500);
    }

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [isInspectorStarted]);

  return (
    <main className="app-shell">
      <section className="hero-section">
        <div>
          <p className="eyebrow">Day 3 POC</p>
          <h1>AI Playwright Smart Recorder</h1>
          <p className="hero-subtitle">
            Codeless recording, smart inspector, unique locator engine, and
            replay-ready Playwright scripts.
          </p>
        </div>

        <div className="status-card">
          <span className="status-label">Current Status</span>
          <p>{statusMessage}</p>
        </div>
      </section>

      <section className="control-grid">
        <div className="panel primary-panel">
          <h2>Application Setup</h2>

          <label className="field-label" htmlFor="applicationUrl">
            Application URL
          </label>
          <input
            id="applicationUrl"
            className="text-input"
            value={applicationUrl}
            onChange={(event) => setApplicationUrl(event.target.value)}
            placeholder="https://www.saucedemo.com/"
          />

          <label className="field-label" htmlFor="locatorStrategy">
            Default Locator Strategy
          </label>
          <select
            id="locatorStrategy"
            className="text-input"
            value={selectedStrategy}
            onChange={(event) =>
              setSelectedStrategy(event.target.value as LocatorStrategy)
            }
          >
            <option value="playwright">Playwright Stable Locators</option>
            <option value="xpath">Relative XPath</option>
            <option value="css">CSS Selectors</option>
          </select>

          <div className="button-row">
            <button
              className="btn btn-primary"
              onClick={startRecording}
              disabled={isLoading || isRecording}
            >
              Start Recording
            </button>

            <button
              className="btn btn-danger"
              onClick={stopRecording}
              disabled={isLoading || !isRecording}
            >
              Stop Recording
            </button>
          </div>

          <div className="button-row">
            <button
              className="btn btn-inspector"
              onClick={startInspector}
              disabled={isLoading || isInspectorStarted}
            >
              Start Inspector
            </button>

            <button
              className="btn btn-secondary"
              onClick={stopInspector}
              disabled={isLoading || !isInspectorStarted}
            >
              Stop Inspector
            </button>
          </div>
        </div>

        <div className="panel">
          <h2>Smart Inspector Result</h2>

          {inspectedElement ? (
            <div className="inspector-result">
              <div className="result-line">
                <span>Mode</span>
                <strong>{inspectedElement.selectedMode}</strong>
              </div>

              <div className="result-line">
                <span>Locator Type</span>
                <strong>{inspectedElement.locatorType}</strong>
              </div>

              <div className="locator-box">{latestBestLocator}</div>

              <div className="result-grid">
                <div>
                  <span>Unique</span>
                  <strong>
                    {inspectedElement.locatorCandidates?.[0]?.isUnique
                      ? "Yes"
                      : "No"}
                  </strong>
                </div>

                <div>
                  <span>Matches</span>
                  <strong>
                    {inspectedElement.locatorCandidates?.[0]?.count ?? 0}
                  </strong>
                </div>

                <div>
                  <span>Confidence</span>
                  <strong>{inspectedElement.confidence}%</strong>
                </div>
              </div>

              <p className="reason-text">{inspectedElement.reason}</p>
            </div>
          ) : (
            <div className="empty-state">
              Start Inspector, select mode in browser popup, enable picker, and
              click any element.
            </div>
          )}
        </div>
      </section>

      <section className="panel full-width-panel">
        <div className="section-header">
          <div>
            <h2>Recorded Actions</h2>
            <p>
              Actions captured with best locator, confidence, and uniqueness
              metadata.
            </p>
          </div>

          <div className="button-row compact">
            <button className="btn btn-secondary" onClick={fetchRecordedActions}>
              Refresh
            </button>

            <button className="btn btn-secondary" onClick={clearRecordedActions}>
              Clear
            </button>

            <button className="btn btn-primary" onClick={generatePlaywrightScript}>
              Generate Script
            </button>

            <button className="btn btn-inspector" onClick={replayRecordedActions}>
              Execute Replay
            </button>
          </div>
        </div>

        {recordedActions.length === 0 ? (
          <div className="empty-state">No recorded actions yet.</div>
        ) : (
          <div className="actions-table-wrapper">
            <table className="actions-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Action</th>
                  <th>Element</th>
                  <th>Best Locator</th>
                  <th>Unique</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {recordedActions.map((action, index) => (
                  <tr key={`${action.timestamp}-${index}`}>
                    <td>{index + 1}</td>
                    <td>{action.action}</td>
                    <td>{action.text || action.tagName}</td>
                    <td>
                      <code>{action.bestLocator || "Not generated"}</code>
                    </td>
                    <td>
                      {action.locatorCandidates?.[0]?.isUnique ? "Yes" : "No"}
                    </td>
                    <td>{action.confidence}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel full-width-panel">
        <div className="section-header">
          <div>
            <h2>Generated Playwright Script</h2>
            <p>Copy this script into your Playwright test file.</p>
          </div>
        </div>

        <pre className="script-box">
          <code>
            {generatedScript ||
              "// Click Generate Script after recording actions."}
          </code>
        </pre>
      </section>
    </main>
  );
}

export default App;