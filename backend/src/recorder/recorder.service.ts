import { Request, Response } from "express";
import {
  chromium,
  Browser,
  BrowserContext,
  Page,
  Locator,
} from "playwright";

type InspectorMode = "playwright" | "xpath" | "css";

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
  selectedMode: InspectorMode;
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

interface ElementAncestorInfo {
  tagName: string;
  id?: string;
  name?: string;
  className?: string;
  role?: string;
  ariaLabel?: string;
  dataTestId?: string;
  dataTest?: string;
}

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;

let isRecording = false;
let isInspectorActive = false;
let isInspectorReinjectAttached = false;

let recordedActions: RecordedAction[] = [];
let inspectedElement: InspectedElement | null = null;

async function getOrCreatePage(applicationUrl?: string): Promise<Page> {
  if (!browser) {
    browser = await chromium.launch({
      headless: false,
      slowMo: 80,
    });
  }

  if (!context) {
    context = await browser.newContext({
      viewport: {
        width: 1366,
        height: 768,
      },
    });
  }

  if (!page || page.isClosed()) {
    page = await context.newPage();
    attachInspectorReinjectAfterNavigation(page);
  }

  if (applicationUrl) {
    const currentUrl = page.url();

    if (currentUrl === "about:blank") {
      await page.goto(applicationUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
    }
  }

  return page;
}

function attachInspectorReinjectAfterNavigation(currentPage: Page): void {
  if (isInspectorReinjectAttached) return;

  isInspectorReinjectAttached = true;

  currentPage.on("domcontentloaded", async () => {
    if (!isInspectorActive) return;
    if (!page || page.isClosed()) return;

    try {
      await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
      await page.waitForTimeout(700);
      await injectInspectorPopup(page);
    } catch {
      // Ignore reinjection error.
    }
  });
}

function normalizeText(value?: string | null): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function escapeSingleQuote(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function cssEscape(value: string): string {
  return value.replace(/([ #;?%&,.+*~':"!^$[\]()=>|/@])/g, "\\$1");
}

function getRole(tagName: string, type: string): string | null {
  if (tagName === "button") return "button";
  if (tagName === "a") return "link";
  if (tagName === "select") return "combobox";
  if (tagName === "textarea") return "textbox";

  if (tagName === "input") {
    if (type === "submit" || type === "button" || type === "reset") {
      return "button";
    }

    if (type === "checkbox") return "checkbox";
    if (type === "radio") return "radio";
    if (type === "search") return "searchbox";

    return "textbox";
  }

  return null;
}

function buildLocatorFromText(currentPage: Page, locatorText: string): Locator {
  const roleMatch = locatorText.match(
    /^page\.getByRole\('([^']+)'(?:,\s*\{\s*name:\s*'(.+)'\s*\})?\)$/
  );

  if (roleMatch) {
    const role = roleMatch[1] as Parameters<Page["getByRole"]>[0];
    const name = roleMatch[2];

    return name
      ? currentPage.getByRole(role, { name })
      : currentPage.getByRole(role);
  }

  const textMatch = locatorText.match(/^page\.getByText\('(.+)'\)$/);
  if (textMatch) return currentPage.getByText(textMatch[1]);

  const labelMatch = locatorText.match(/^page\.getByLabel\('(.+)'\)$/);
  if (labelMatch) return currentPage.getByLabel(labelMatch[1]);

  const placeholderMatch = locatorText.match(
    /^page\.getByPlaceholder\('(.+)'\)$/
  );
  if (placeholderMatch) return currentPage.getByPlaceholder(placeholderMatch[1]);

  const altTextMatch = locatorText.match(/^page\.getByAltText\('(.+)'\)$/);
  if (altTextMatch) return currentPage.getByAltText(altTextMatch[1]);

  const titleMatch = locatorText.match(/^page\.getByTitle\('(.+)'\)$/);
  if (titleMatch) return currentPage.getByTitle(titleMatch[1]);

  const testIdMatch = locatorText.match(/^page\.getByTestId\('(.+)'\)$/);
  if (testIdMatch) return currentPage.getByTestId(testIdMatch[1]);

  return currentPage.locator(locatorText);
}

async function getLocatorCount(
  currentPage: Page,
  locatorText: string
): Promise<number> {
  try {
    return await buildLocatorFromText(currentPage, locatorText).count();
  } catch {
    return 0;
  }
}

async function addCandidate(
  currentPage: Page,
  candidates: LocatorCandidate[],
  type: string,
  locator: string,
  confidence: number,
  reason: string
): Promise<void> {
  if (!locator) return;

  const count = await getLocatorCount(currentPage, locator);
  const isUnique = count === 1;

  candidates.push({
    type,
    locator,
    isUnique,
    count,
    confidence: isUnique ? confidence : Math.max(confidence - 30, 10),
    reason: isUnique
      ? reason
      : `${reason} Current match count is ${count}. Engine will continue searching for stronger locator.`,
  });
}

function buildAncestorXPathPrefix(ancestor: ElementAncestorInfo): string | null {
  const tag = ancestor.tagName || "*";

  if (ancestor.dataTestId) {
    return `//*[@data-testid='${escapeSingleQuote(ancestor.dataTestId)}']`;
  }

  if (ancestor.dataTest) {
    return `//*[@data-test='${escapeSingleQuote(ancestor.dataTest)}']`;
  }

  if (ancestor.id) {
    return `//*[@id='${escapeSingleQuote(ancestor.id)}']`;
  }

  if (ancestor.name) {
    return `//${tag}[@name='${escapeSingleQuote(ancestor.name)}']`;
  }

  if (ancestor.role) {
    return `//${tag}[@role='${escapeSingleQuote(ancestor.role)}']`;
  }

  if (ancestor.ariaLabel) {
    return `//${tag}[@aria-label='${escapeSingleQuote(ancestor.ariaLabel)}']`;
  }

  if (ancestor.className) {
    const firstStableClass = ancestor.className
      .split(/\s+/)
      .find((cls) => cls && !cls.includes(":") && !/^\d/.test(cls));

    if (firstStableClass) {
      return `//${tag}[contains(concat(' ',normalize-space(@class),' '),' ${escapeSingleQuote(
        firstStableClass
      )} ')]`;
    }
  }

  return null;
}

async function addXPathCandidatesUntilUnique(
  currentPage: Page,
  candidates: LocatorCandidate[],
  elementInfo: any
): Promise<void> {
  const tagName = normalizeText(elementInfo.tagName).toLowerCase() || "*";
  const text = normalizeText(elementInfo.text);
  const id = normalizeText(elementInfo.id);
  const name = normalizeText(elementInfo.name);
  const type = normalizeText(elementInfo.type).toLowerCase();
  const placeholder = normalizeText(elementInfo.placeholder);
  const ariaLabel = normalizeText(elementInfo.ariaLabel);
  const title = normalizeText(elementInfo.title);
  const role = normalizeText(elementInfo.role);
  const testId = normalizeText(elementInfo.testId);
  const testAttribute = normalizeText(
    elementInfo.testAttribute || "data-testid"
  );
  const className = normalizeText(elementInfo.className);

  const ancestors: ElementAncestorInfo[] = Array.isArray(elementInfo.ancestors)
    ? elementInfo.ancestors
    : [];

  const xpathSteps: Array<{
    type: string;
    locator: string;
    confidence: number;
    reason: string;
  }> = [];

  if (testId) {
    xpathSteps.push({
      type: "XPath Unique Test Attribute",
      locator: `xpath=//*[@${testAttribute}='${escapeSingleQuote(testId)}']`,
      confidence: 98,
      reason: "Used stable automation test attribute.",
    });
  }

  if (id) {
    xpathSteps.push({
      type: "XPath Unique Id",
      locator: `xpath=//*[@id='${escapeSingleQuote(id)}']`,
      confidence: 96,
      reason: "Used stable id attribute.",
    });
  }

  if (name) {
    xpathSteps.push({
      type: "XPath Name",
      locator: `xpath=//${tagName}[@name='${escapeSingleQuote(name)}']`,
      confidence: 88,
      reason: "Used name attribute.",
    });
  }

  if (placeholder) {
    xpathSteps.push({
      type: "XPath Placeholder",
      locator: `xpath=//${tagName}[@placeholder='${escapeSingleQuote(
        placeholder
      )}']`,
      confidence: 86,
      reason: "Used placeholder attribute.",
    });
  }

  if (ariaLabel) {
    xpathSteps.push({
      type: "XPath Aria Label",
      locator: `xpath=//${tagName}[@aria-label='${escapeSingleQuote(
        ariaLabel
      )}']`,
      confidence: 86,
      reason: "Used aria-label attribute.",
    });
  }

  if (title) {
    xpathSteps.push({
      type: "XPath Title",
      locator: `xpath=//${tagName}[@title='${escapeSingleQuote(title)}']`,
      confidence: 84,
      reason: "Used title attribute.",
    });
  }

  if (role && text) {
    xpathSteps.push({
      type: "XPath Role And Text",
      locator: `xpath=//${tagName}[@role='${escapeSingleQuote(
        role
      )}' and normalize-space()='${escapeSingleQuote(text)}']`,
      confidence: 84,
      reason: "Used role with visible text.",
    });
  }

  if (name && type) {
    xpathSteps.push({
      type: "XPath Name And Type",
      locator: `xpath=//${tagName}[@name='${escapeSingleQuote(
        name
      )}' and @type='${escapeSingleQuote(type)}']`,
      confidence: 86,
      reason: "Used name and type combination.",
    });
  }

  if (className) {
    const stableClass = className
      .split(/\s+/)
      .find((cls) => cls && !cls.includes(":") && !/^\d/.test(cls));

    if (stableClass) {
      xpathSteps.push({
        type: "XPath Class",
        locator: `xpath=//${tagName}[contains(concat(' ',normalize-space(@class),' '),' ${escapeSingleQuote(
          stableClass
        )} ')]`,
        confidence: 74,
        reason: "Used stable class fallback.",
      });

      if (text) {
        xpathSteps.push({
          type: "XPath Class And Text",
          locator: `xpath=//${tagName}[contains(concat(' ',normalize-space(@class),' '),' ${escapeSingleQuote(
            stableClass
          )} ') and normalize-space()='${escapeSingleQuote(text)}']`,
          confidence: 82,
          reason: "Used class and visible text combination.",
        });
      }
    }
  }

  if (text && text.length <= 120) {
    xpathSteps.push({
      type: "XPath Text",
      locator: `xpath=//${tagName}[normalize-space()='${escapeSingleQuote(
        text
      )}']`,
      confidence: 76,
      reason: "Used visible text.",
    });

    xpathSteps.push({
      type: "XPath Any Text",
      locator: `xpath=//*[normalize-space()='${escapeSingleQuote(text)}']`,
      confidence: 70,
      reason: "Used visible text across all tags.",
    });
  }

  for (const step of xpathSteps) {
    await addCandidate(
      currentPage,
      candidates,
      step.type,
      step.locator,
      step.confidence,
      step.reason
    );

    if (candidates[candidates.length - 1]?.isUnique) return;
  }

  const childConditions: string[] = [];

  if (testId) {
    childConditions.push(`@${testAttribute}='${escapeSingleQuote(testId)}'`);
  }

  if (id) childConditions.push(`@id='${escapeSingleQuote(id)}'`);
  if (name) childConditions.push(`@name='${escapeSingleQuote(name)}'`);
  if (placeholder) {
    childConditions.push(`@placeholder='${escapeSingleQuote(placeholder)}'`);
  }
  if (ariaLabel) {
    childConditions.push(`@aria-label='${escapeSingleQuote(ariaLabel)}'`);
  }
  if (title) childConditions.push(`@title='${escapeSingleQuote(title)}'`);

  if (text && text.length <= 120) {
    childConditions.push(`normalize-space()='${escapeSingleQuote(text)}'`);
  }

  const childXPath =
    childConditions.length > 0
      ? `.//${tagName}[${childConditions.join(" and ")}]`
      : `.//${tagName}`;

  for (const ancestor of ancestors) {
    const ancestorPrefix = buildAncestorXPathPrefix(ancestor);
    if (!ancestorPrefix) continue;

    const fullXPath = `xpath=${ancestorPrefix}${childXPath.replace(".", "")}`;

    await addCandidate(
      currentPage,
      candidates,
      "XPath Stable Parent Chain",
      fullXPath,
      90,
      "Direct locator was not unique, so engine combined it with stable parent/ancestor."
    );

    if (candidates[candidates.length - 1]?.isUnique) return;
  }

  if (text && text.length <= 120) {
    const baseTextXPath = `xpath=//${tagName}[normalize-space()='${escapeSingleQuote(
      text
    )}']`;

    const matchCount = await getLocatorCount(currentPage, baseTextXPath);

    if (matchCount > 1) {
      for (let index = 1; index <= matchCount; index++) {
        const indexedXPath = `xpath=(//${tagName}[normalize-space()='${escapeSingleQuote(
          text
        )}'])[${index}]`;

        await addCandidate(
          currentPage,
          candidates,
          "XPath Indexed Unique Fallback",
          indexedXPath,
          65,
          "No fully stable unique XPath was found, so engine used indexed XPath fallback to avoid manual intervention."
        );

        if (candidates[candidates.length - 1]?.isUnique) return;
      }
    }
  }

  const structuralXPath = normalizeText(elementInfo.structuralXPath);

  if (structuralXPath) {
    await addCandidate(
      currentPage,
      candidates,
      "XPath Structural Unique Fallback",
      `xpath=${structuralXPath}`,
      60,
      "Final fallback using DOM structure. Unique, but less stable than attribute-based XPath."
    );
  }
}

async function generateLocatorCandidates(
  currentPage: Page,
  elementInfo: any,
  mode: InspectorMode
): Promise<LocatorCandidate[]> {
  const candidates: LocatorCandidate[] = [];

  const tagName = normalizeText(elementInfo.tagName).toLowerCase();
  const text = normalizeText(elementInfo.text);
  const id = normalizeText(elementInfo.id);
  const name = normalizeText(elementInfo.name);
  const type = normalizeText(elementInfo.type).toLowerCase();
  const placeholder = normalizeText(elementInfo.placeholder);
  const ariaLabel = normalizeText(elementInfo.ariaLabel);
  const title = normalizeText(elementInfo.title);
  const alt = normalizeText(elementInfo.alt);
  const testId = normalizeText(elementInfo.testId);
  const testAttribute = normalizeText(
    elementInfo.testAttribute || "data-testid"
  );
  const cssSelector = normalizeText(elementInfo.cssSelector);

  if (mode === "playwright") {
    if (testId) {
      await addCandidate(
        currentPage,
        candidates,
        "Playwright TestId",
        `page.getByTestId('${escapeSingleQuote(testId)}')`,
        98,
        "data-testid/data-test is the strongest automation-friendly locator."
      );
    }

    if (ariaLabel) {
      await addCandidate(
        currentPage,
        candidates,
        "Playwright Label",
        `page.getByLabel('${escapeSingleQuote(ariaLabel)}')`,
        94,
        "ARIA label is stable and readable."
      );
    }

    if (placeholder) {
      await addCandidate(
        currentPage,
        candidates,
        "Playwright Placeholder",
        `page.getByPlaceholder('${escapeSingleQuote(placeholder)}')`,
        90,
        "Placeholder is useful for input fields."
      );
    }

    const role = getRole(tagName, type);

    if (role && text && text.length <= 80) {
      await addCandidate(
        currentPage,
        candidates,
        "Playwright Role",
        `page.getByRole('${role}', { name: '${escapeSingleQuote(text)}' })`,
        96,
        "Role with accessible name is Playwright recommended strategy."
      );
    }

    if (text && text.length <= 80) {
      await addCandidate(
        currentPage,
        candidates,
        "Playwright Text",
        `page.getByText('${escapeSingleQuote(text)}')`,
        82,
        "Visible text locator is readable when unique."
      );
    }

    if (alt) {
      await addCandidate(
        currentPage,
        candidates,
        "Playwright AltText",
        `page.getByAltText('${escapeSingleQuote(alt)}')`,
        86,
        "Alt text is useful for image elements."
      );
    }

    if (title) {
      await addCandidate(
        currentPage,
        candidates,
        "Playwright Title",
        `page.getByTitle('${escapeSingleQuote(title)}')`,
        84,
        "Title attribute can be useful when unique."
      );
    }

    const hasUniquePlaywright = candidates.some(
      (candidate) => candidate.isUnique
    );

    if (!hasUniquePlaywright) {
      await addXPathCandidatesUntilUnique(currentPage, candidates, elementInfo);
    }
  }

  if (mode === "xpath") {
    await addXPathCandidatesUntilUnique(currentPage, candidates, elementInfo);
  }

  if (mode === "css") {
    if (testId) {
      await addCandidate(
        currentPage,
        candidates,
        "CSS Test Attribute",
        `[${testAttribute}='${escapeSingleQuote(testId)}']`,
        94,
        "Test attribute CSS selector is automation-friendly."
      );
    }

    if (id) {
      await addCandidate(
        currentPage,
        candidates,
        "CSS Id",
        `#${cssEscape(id)}`,
        86,
        "ID CSS selector is short and readable."
      );
    }

    if (name && tagName) {
      await addCandidate(
        currentPage,
        candidates,
        "CSS Name",
        `${tagName}[name='${escapeSingleQuote(name)}']`,
        80,
        "Name CSS selector is useful for form fields."
      );
    }

    if (placeholder && tagName) {
      await addCandidate(
        currentPage,
        candidates,
        "CSS Placeholder",
        `${tagName}[placeholder='${escapeSingleQuote(placeholder)}']`,
        78,
        "Placeholder CSS selector is readable for input fields."
      );
    }

    if (ariaLabel && tagName) {
      await addCandidate(
        currentPage,
        candidates,
        "CSS Aria Label",
        `${tagName}[aria-label='${escapeSingleQuote(ariaLabel)}']`,
        78,
        "ARIA-label CSS selector is useful when unique."
      );
    }

    if (cssSelector) {
      await addCandidate(
        currentPage,
        candidates,
        "Generated CSS Selector",
        cssSelector,
        68,
        "Generated CSS selector fallback."
      );
    }

    const hasUniqueCss = candidates.some((candidate) => candidate.isUnique);

    if (!hasUniqueCss) {
      await addXPathCandidatesUntilUnique(currentPage, candidates, elementInfo);
    }
  }

  return candidates
    .filter(
      (candidate, index, self) =>
        index === self.findIndex((item) => item.locator === candidate.locator)
    )
    .sort((a, b) => {
      if (a.isUnique && !b.isUnique) return -1;
      if (!a.isUnique && b.isUnique) return 1;
      return b.confidence - a.confidence;
    });
}

async function exposeInspectorFunction(currentPage: Page): Promise<void> {
  const anyPage = currentPage as Page & {
    __smartInspectorExposeDone?: boolean;
  };

  if (anyPage.__smartInspectorExposeDone) return;

  await currentPage.exposeFunction(
    "smartInspectorCaptureElement",
    async (payload: any) => {
      if (!page) {
        return {
          success: false,
          message: "No active page found.",
        };
      }

      const selectedMode: InspectorMode = payload.selectedMode || "playwright";

      const candidates = await generateLocatorCandidates(
        page,
        payload,
        selectedMode
      );

      const bestCandidate =
        candidates.find((candidate) => candidate.isUnique) || candidates[0];

      inspectedElement = {
        selectedMode,
        tagName: payload.tagName,
        text: normalizeText(payload.text),
        value: payload.value,
        bestLocator: bestCandidate?.locator || "",
        locatorType: bestCandidate?.type || "unknown",
        confidence: bestCandidate?.confidence || 0,
        reason: bestCandidate?.reason || "No locator candidate found.",
        locatorCandidates: candidates,
        url: page.url(),
        timestamp: new Date().toISOString(),
      };

      return {
        success: true,
        inspectedElement,
      };
    }
  );

  anyPage.__smartInspectorExposeDone = true;
}

async function injectInspectorPopup(currentPage: Page): Promise<void> {
  await exposeInspectorFunction(currentPage);

  await currentPage.addScriptTag({
    content: `
      (() => {
        if (window.__smartInspectorPopupInstalled) {
          const existingPanel = document.getElementById("smart-inspector-panel");
          if (existingPanel) existingPanel.style.display = "block";
          return;
        }

        window.__smartInspectorPopupInstalled = true;
        window.__smartInspectorSelectedMode = "playwright";
        window.__smartInspectorEnabled = false;

        let lastHighlightedElement = null;

        const panel = document.createElement("div");
        panel.id = "smart-inspector-panel";
        panel.innerHTML = \`
          <div id="smart-inspector-drag-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;cursor:move;user-select:none;">
            <div style="font-size:14px;font-weight:700;color:#111827;">Smart Inspector</div>
            <button id="smart-inspector-close" style="border:none;background:#fee2e2;color:#991b1b;border-radius:8px;padding:4px 8px;cursor:pointer;font-weight:700;">X</button>
          </div>

          <div style="font-size:12px;color:#4b5563;margin-bottom:8px;">1. Select locator type</div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px;">
            <button class="smart-inspector-mode-btn active" data-mode="playwright">Playwright</button>
            <button class="smart-inspector-mode-btn" data-mode="xpath">XPath</button>
            <button class="smart-inspector-mode-btn" data-mode="css">CSS</button>
          </div>

          <div style="font-size:12px;color:#4b5563;margin-bottom:8px;">2. Click arrow, then click elements</div>

          <button id="smart-inspector-arrow" style="width:100%;border:none;background:#2563eb;color:white;border-radius:12px;padding:10px;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:10px;">
            ➜ Enable Element Pick
          </button>

          <div id="smart-inspector-status" style="background:#f3f4f6;border-radius:10px;padding:8px;font-size:12px;color:#374151;margin-bottom:10px;">
            Inspector is OFF
          </div>

          <div style="font-size:12px;font-weight:700;color:#111827;margin-bottom:6px;">Result</div>

          <textarea id="smart-inspector-result" readonly style="width:100%;height:105px;resize:none;border:1px solid #d1d5db;border-radius:10px;padding:8px;font-size:12px;color:#111827;background:#ffffff;box-sizing:border-box;">No element selected yet.</textarea>

          <div id="smart-inspector-meta" style="margin-top:8px;font-size:11px;color:#6b7280;line-height:1.4;"></div>
        \`;

        panel.style.position = "fixed";
        panel.style.top = "18px";
        panel.style.right = "18px";
        panel.style.width = "350px";
        panel.style.zIndex = "2147483647";
        panel.style.background = "white";
        panel.style.border = "1px solid #d1d5db";
        panel.style.borderRadius = "18px";
        panel.style.boxShadow = "0 18px 50px rgba(0,0,0,0.22)";
        panel.style.padding = "14px";
        panel.style.fontFamily = "Arial, sans-serif";

        const style = document.createElement("style");
        style.innerHTML = \`
          .smart-inspector-mode-btn {
            border: 1px solid #d1d5db;
            background: #f9fafb;
            color: #111827;
            border-radius: 10px;
            padding: 8px 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 700;
          }

          .smart-inspector-mode-btn.active {
            background: #dbeafe;
            border-color: #2563eb;
            color: #1d4ed8;
          }
        \`;

        document.documentElement.appendChild(style);
        document.body.appendChild(panel);

        const closeButton = document.getElementById("smart-inspector-close");
        const dragHeader = document.getElementById("smart-inspector-drag-header");
        const arrowButton = document.getElementById("smart-inspector-arrow");
        const statusBox = document.getElementById("smart-inspector-status");
        const resultBox = document.getElementById("smart-inspector-result");
        const metaBox = document.getElementById("smart-inspector-meta");
        const modeButtons = Array.from(document.querySelectorAll(".smart-inspector-mode-btn"));

        let isDraggingInspector = false;
        let dragOffsetX = 0;
        let dragOffsetY = 0;

        dragHeader.addEventListener("mousedown", (event) => {
          if (event.target && event.target.id === "smart-inspector-close") return;

          isDraggingInspector = true;

          const rect = panel.getBoundingClientRect();

          dragOffsetX = event.clientX - rect.left;
          dragOffsetY = event.clientY - rect.top;

          panel.style.left = rect.left + "px";
          panel.style.top = rect.top + "px";
          panel.style.right = "auto";

          event.preventDefault();
          event.stopPropagation();
        });

        document.addEventListener("mousemove", (event) => {
          if (!isDraggingInspector) return;

          panel.style.left = event.clientX - dragOffsetX + "px";
          panel.style.top = event.clientY - dragOffsetY + "px";
          panel.style.right = "auto";

          event.preventDefault();
          event.stopPropagation();
        });

        document.addEventListener("mouseup", () => {
          isDraggingInspector = false;
        });

        function setStatus(message, active) {
          statusBox.textContent = message;
          statusBox.style.background = active ? "#dcfce7" : "#f3f4f6";
          statusBox.style.color = active ? "#166534" : "#374151";
        }

        function clearHighlight() {
          if (!lastHighlightedElement) return;

          lastHighlightedElement.style.outline =
            lastHighlightedElement.__smartInspectorOldOutline || "";

          lastHighlightedElement.style.backgroundColor =
            lastHighlightedElement.__smartInspectorOldBackground || "";

          lastHighlightedElement = null;
        }

        function highlight(element) {
          if (!window.__smartInspectorEnabled) return;
          if (element.closest && element.closest("#smart-inspector-panel")) return;

          clearHighlight();

          lastHighlightedElement = element;

          element.__smartInspectorOldOutline = element.style.outline;
          element.__smartInspectorOldBackground = element.style.backgroundColor;

          element.style.outline = "3px solid #2563eb";
          element.style.backgroundColor = "rgba(37, 99, 235, 0.12)";
        }

        function cleanText(value) {
          return (value || "").replace(/\\s+/g, " ").trim();
        }

        function safeXPathValue(value) {
          return String(value || "").replace(/'/g, "\\\\'");
        }

        function getStructuralXPath(element) {
          if (!element || element.nodeType !== 1) return "";

          const parts = [];
          let current = element;

          while (
            current &&
            current.nodeType === 1 &&
            current.tagName.toLowerCase() !== "html"
          ) {
            const tagName = current.tagName.toLowerCase();
            const parent = current.parentElement;

            if (!parent) {
              parts.unshift(tagName);
              break;
            }

            const siblings = Array.from(parent.children);
            const sameTagSiblings = siblings.filter(
              (child) => child.tagName.toLowerCase() === tagName
            );

            const index = sameTagSiblings.indexOf(current) + 1;
            parts.unshift(tagName + "[" + index + "]");
            current = parent;
          }

          return "/" + parts.join("/");
        }

        function getRelativeXPath(element) {
          const attributes = ["data-testid", "data-test", "id", "name", "placeholder", "aria-label", "title"];

          for (const attr of attributes) {
            const value = element.getAttribute(attr);
            if (value) return "//*[@" + attr + "='" + safeXPathValue(value) + "']";
          }

          const text = cleanText(element.textContent);

          if (text && text.length <= 120) {
            return "//*[normalize-space()='" + safeXPathValue(text) + "']";
          }

          return getStructuralXPath(element);
        }

        function getCssSelector(element) {
          const testId =
            element.getAttribute("data-testid") ||
            element.getAttribute("data-test");

          if (testId) {
            const attr = element.getAttribute("data-testid") ? "data-testid" : "data-test";
            return "[" + attr + "='" + testId + "']";
          }

          if (element.id) return "#" + element.id;

          const name = element.getAttribute("name");
          if (name) return element.tagName.toLowerCase() + "[name='" + name + "']";

          const placeholder = element.getAttribute("placeholder");
          if (placeholder) {
            return element.tagName.toLowerCase() + "[placeholder='" + placeholder + "']";
          }

          const ariaLabel = element.getAttribute("aria-label");
          if (ariaLabel) {
            return element.tagName.toLowerCase() + "[aria-label='" + ariaLabel + "']";
          }

          const className = typeof element.className === "string"
            ? element.className.trim().split(/\\s+/).filter(Boolean)[0]
            : "";

          if (className) return element.tagName.toLowerCase() + "." + className;

          return element.tagName.toLowerCase();
        }

        function getAncestors(element) {
          const ancestors = [];
          let current = element.parentElement;

          while (current && current.tagName && current.tagName.toLowerCase() !== "html") {
            ancestors.push({
              tagName: current.tagName.toLowerCase(),
              id: current.id || "",
              name: current.getAttribute("name") || "",
              className: typeof current.className === "string" ? current.className : "",
              role: current.getAttribute("role") || "",
              ariaLabel: current.getAttribute("aria-label") || "",
              dataTestId: current.getAttribute("data-testid") || "",
              dataTest: current.getAttribute("data-test") || ""
            });

            current = current.parentElement;
          }

          return ancestors;
        }

        function collectElementInfo(element) {
          const dataTestId = element.getAttribute("data-testid");
          const dataTest = element.getAttribute("data-test");

          return {
            selectedMode: window.__smartInspectorSelectedMode,
            tagName: element.tagName.toLowerCase(),
            text: element.innerText || element.textContent || "",
            value: element.value || "",
            id: element.id || "",
            name: element.getAttribute("name") || "",
            type: element.getAttribute("type") || "",
            role: element.getAttribute("role") || "",
            className: typeof element.className === "string" ? element.className : "",
            placeholder: element.getAttribute("placeholder") || "",
            ariaLabel: element.getAttribute("aria-label") || "",
            title: element.getAttribute("title") || "",
            alt: element.getAttribute("alt") || "",
            testId: dataTestId || dataTest || "",
            testAttribute: dataTestId ? "data-testid" : dataTest ? "data-test" : "data-testid",
            relativeXPath: getRelativeXPath(element),
            structuralXPath: getStructuralXPath(element),
            cssSelector: getCssSelector(element),
            ancestors: getAncestors(element)
          };
        }

        modeButtons.forEach((button) => {
          button.addEventListener("click", () => {
            modeButtons.forEach((btn) => btn.classList.remove("active"));
            button.classList.add("active");

            window.__smartInspectorSelectedMode = button.getAttribute("data-mode");

            resultBox.value =
              "Mode selected: " +
              window.__smartInspectorSelectedMode +
              "\\nNow click the arrow button to enable element picking.";

            metaBox.textContent = "";
          });
        });

        arrowButton.addEventListener("click", () => {
          window.__smartInspectorEnabled = !window.__smartInspectorEnabled;

          if (window.__smartInspectorEnabled) {
            arrowButton.textContent = "✓ Inspector ON - Click Elements";
            arrowButton.style.background = "#16a34a";
            setStatus("Inspector is ON. Click elements. Click this button again to turn OFF.", true);
          } else {
            arrowButton.textContent = "➜ Enable Element Pick";
            arrowButton.style.background = "#2563eb";
            setStatus("Inspector is OFF. You can navigate the application normally.", false);
            clearHighlight();
          }
        });

        closeButton.addEventListener("click", () => {
          window.__smartInspectorEnabled = false;
          clearHighlight();
          panel.style.display = "none";
        });

        document.addEventListener(
          "mouseover",
          (event) => {
            if (!window.__smartInspectorEnabled) return;

            const target = event.target;
            if (!target || !target.tagName) return;

            highlight(target);
          },
          true
        );

        document.addEventListener(
          "click",
          async (event) => {
            if (!window.__smartInspectorEnabled) return;

            const target = event.target;
            if (!target || !target.tagName) return;

            if (target.closest && target.closest("#smart-inspector-panel")) return;

            event.preventDefault();
            event.stopPropagation();

            resultBox.value = "Finding unique locator. Please wait...";

            try {
              const response = await window.smartInspectorCaptureElement(
                collectElementInfo(target)
              );

              if (!response || !response.success) {
                resultBox.value = "Unable to inspect selected element.";
                return;
              }

              const inspected = response.inspectedElement;
              const best = inspected.locatorCandidates && inspected.locatorCandidates[0];

              resultBox.value = inspected.bestLocator || "No locator generated.";

              metaBox.innerHTML =
                "<b>Mode:</b> " + inspected.selectedMode +
                "<br><b>Type:</b> " + inspected.locatorType +
                "<br><b>Unique:</b> " + (best?.isUnique ? "Yes" : "No") +
                "<br><b>Matches:</b> " + (best?.count ?? 0) +
                "<br><b>Confidence:</b> " + inspected.confidence + "%" +
                "<br><b>Reason:</b> " + inspected.reason;

              setStatus(
                "Element captured. Inspector is still ON. Click another element or disable picker.",
                true
              );

              clearHighlight();
            } catch (error) {
              resultBox.value = "Error while inspecting element: " + error.message;
            }
          },
          true
        );
      })();
    `,
  });
}

async function exposeRecorderFunction(currentPage: Page): Promise<void> {
  const anyPage = currentPage as Page & {
    __smartRecorderExposeDone?: boolean;
  };

  if (anyPage.__smartRecorderExposeDone) return;

  await currentPage.exposeFunction(
    "smartRecorderCaptureAction",
    async (payload: any) => {
      if (!isRecording || !page) return;

      const candidates = await generateLocatorCandidates(
        page,
        payload,
        "playwright"
      );

      const bestCandidate =
        candidates.find((candidate) => candidate.isUnique) || candidates[0];

      recordedActions.push({
        action: payload.action,
        value: payload.value,
        url: page.url(),
        tagName: payload.tagName,
        text: normalizeText(payload.text),
        bestLocator: bestCandidate?.locator || "",
        locatorType: bestCandidate?.type || "unknown",
        confidence: bestCandidate?.confidence || 0,
        reason: bestCandidate?.reason || "No stable locator candidate found.",
        locatorCandidates: candidates,
        timestamp: new Date().toISOString(),
      });
    }
  );

  anyPage.__smartRecorderExposeDone = true;
}

async function injectRecorder(currentPage: Page): Promise<void> {
  await exposeRecorderFunction(currentPage);

  await currentPage.addInitScript(() => {
    type RecorderWindow = Window &
      typeof globalThis & {
        smartRecorderCaptureAction: (payload: any) => void;
      };

    function getRelativeXPath(element: Element): string {
      const attributes = [
        "data-testid",
        "data-test",
        "id",
        "name",
        "placeholder",
        "aria-label",
        "title",
      ];

      for (const attr of attributes) {
        const value = element.getAttribute(attr);
        if (value) {
          return `//*[@${attr}='${value}']`;
        }
      }

      const text = element.textContent?.replace(/\s+/g, " ").trim();
      if (text && text.length <= 120) {
        return `//*[normalize-space()='${text}']`;
      }

      const tagName = element.tagName.toLowerCase();
      return `//${tagName}`;
    }

    function getCssSelector(element: Element): string {
      const testId =
        element.getAttribute("data-testid") || element.getAttribute("data-test");

      if (testId) {
        const attr = element.getAttribute("data-testid")
          ? "data-testid"
          : "data-test";

        return `[${attr}='${testId}']`;
      }

      if (element.id) return `#${element.id}`;

      const name = element.getAttribute("name");
      if (name) return `${element.tagName.toLowerCase()}[name='${name}']`;

      return element.tagName.toLowerCase();
    }

    function getStructuralXPath(element: Element): string {
      const parts: string[] = [];

      let current: Element | null = element;

      while (
        current !== null &&
        current.nodeType === 1 &&
        current.tagName.toLowerCase() !== "html"
      ) {
        const tagName: string = current.tagName.toLowerCase();
        const parent: Element | null = current.parentElement;

        if (parent === null) {
          parts.unshift(tagName);
          break;
        }

        const siblings: Element[] = Array.from(parent.children) as Element[];

        const sameTagSiblings: Element[] = siblings.filter((child: Element) => {
          return child.tagName.toLowerCase() === tagName;
        });

        const index: number = sameTagSiblings.indexOf(current) + 1;

        parts.unshift(`${tagName}[${index}]`);

        current = parent;
      }

      return `/${parts.join("/")}`;
    }

    function getAncestors(element: HTMLElement): any[] {
      const ancestors: any[] = [];

      let current: HTMLElement | null = element.parentElement;

      while (
        current !== null &&
        current.tagName &&
        current.tagName.toLowerCase() !== "html"
      ) {
        ancestors.push({
          tagName: current.tagName.toLowerCase(),
          id: current.id || "",
          name: current.getAttribute("name") || "",
          className:
            typeof current.className === "string" ? current.className : "",
          role: current.getAttribute("role") || "",
          ariaLabel: current.getAttribute("aria-label") || "",
          dataTestId: current.getAttribute("data-testid") || "",
          dataTest: current.getAttribute("data-test") || "",
        });

        current = current.parentElement;
      }

      return ancestors;
    }

    function collectElementInfo(
      element: HTMLElement,
      action: string,
      value?: string
    ) {
      const dataTestId = element.getAttribute("data-testid");
      const dataTest = element.getAttribute("data-test");

      return {
        action,
        value,
        selectedMode: "playwright",
        tagName: element.tagName.toLowerCase(),
        text: element.innerText || element.textContent || "",
        id: element.id || "",
        name: element.getAttribute("name") || "",
        type: element.getAttribute("type") || "",
        role: element.getAttribute("role") || "",
        className: typeof element.className === "string" ? element.className : "",
        placeholder: element.getAttribute("placeholder") || "",
        ariaLabel: element.getAttribute("aria-label") || "",
        title: element.getAttribute("title") || "",
        alt: element.getAttribute("alt") || "",
        testId: dataTestId || dataTest || "",
        testAttribute: dataTestId
          ? "data-testid"
          : dataTest
          ? "data-test"
          : "data-testid",
        relativeXPath: getRelativeXPath(element),
        structuralXPath: getStructuralXPath(element),
        cssSelector: getCssSelector(element),
        ancestors: getAncestors(element),
      };
    }

    document.addEventListener(
      "click",
      (event) => {
        const target = event.target as HTMLElement;
        if (!target) return;

        (window as RecorderWindow).smartRecorderCaptureAction(
          collectElementInfo(target, "click")
        );
      },
      true
    );

    document.addEventListener(
      "input",
      (event) => {
        const target = event.target as HTMLInputElement;
        if (!target) return;

        const tagName = target.tagName.toLowerCase();
        const inputType = target.getAttribute("type") || "";

        if (tagName === "input" || tagName === "textarea") {
          const action =
            inputType === "checkbox" || inputType === "radio" ? "check" : "fill";

          (window as RecorderWindow).smartRecorderCaptureAction(
            collectElementInfo(target, action, target.value)
          );
        }
      },
      true
    );

    document.addEventListener(
      "change",
      (event) => {
        const target = event.target as HTMLSelectElement;
        if (!target) return;

        if (target.tagName.toLowerCase() === "select") {
          (window as RecorderWindow).smartRecorderCaptureAction(
            collectElementInfo(target, "selectOption", target.value)
          );
        }
      },
      true
    );
  });
}

export async function startInspectorHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { applicationUrl } = req.body as {
      applicationUrl?: string;
    };

    if (!applicationUrl && (!page || page.isClosed())) {
      res.status(400).json({
        success: false,
        message:
          "applicationUrl is required when no browser page is currently open.",
      });
      return;
    }

    const usingExistingBrowser = Boolean(browser && page && !page.isClosed());

    const currentPage = await getOrCreatePage(applicationUrl);

    isInspectorActive = true;
    inspectedElement = null;

    attachInspectorReinjectAfterNavigation(currentPage);
    await injectInspectorPopup(currentPage);

    res.status(200).json({
      success: true,
      message: "Smart Inspector popup started successfully",
      usingExistingBrowser,
      currentUrl: currentPage.url(),
      instruction:
        "Use floating Inspector UI. Select XPath/CSS/Playwright, click arrow, then click elements. Picker stays ON until disabled manually.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to start Smart Inspector",
      error: error.message,
    });
  }
}

export async function stopInspectorHandler(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    isInspectorActive = false;

    if (page && !page.isClosed()) {
      await page
        .evaluate(() => {
          const anyWindow = window as any;
          anyWindow.__smartInspectorEnabled = false;

          const panel = document.getElementById("smart-inspector-panel");
          if (panel) {
            panel.style.display = "none";
          }
        })
        .catch(() => {
          // Ignore page evaluate error.
        });
    }

    res.status(200).json({
      success: true,
      message: "Smart Inspector stopped successfully",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to stop Smart Inspector",
      error: error.message,
    });
  }
}

export async function getInspectedElementHandler(
  _req: Request,
  res: Response
): Promise<void> {
  res.status(200).json({
    success: true,
    inspectedElement,
  });
}

export async function startRecordingHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { applicationUrl } = req.body as { applicationUrl?: string };

    if (!applicationUrl) {
      res.status(400).json({
        success: false,
        message: "applicationUrl is required.",
      });
      return;
    }

    recordedActions = [];
    inspectedElement = null;
    isRecording = true;

    const currentPage = await getOrCreatePage(applicationUrl);
    await injectRecorder(currentPage);

    res.status(200).json({
      success: true,
      message: "Recording started successfully",
      applicationUrl,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to start recording",
      error: error.message,
    });
  }
}

export async function stopRecordingHandler(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    isRecording = false;

    res.status(200).json({
      success: true,
      message: "Recording stopped successfully",
      actions: recordedActions,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to stop recording",
      error: error.message,
    });
  }
}

export async function getRecordedActionsHandler(
  _req: Request,
  res: Response
): Promise<void> {
  res.status(200).json({
    success: true,
    count: recordedActions.length,
    actions: recordedActions,
  });
}

export async function clearRecordedActionsHandler(
  _req: Request,
  res: Response
): Promise<void> {
  recordedActions = [];

  res.status(200).json({
    success: true,
    message: "Recorded actions cleared successfully",
  });
}

export async function replayRecordedActionsHandler(
  req: Request,
  res: Response
): Promise<void> {
  let replayBrowser: Browser | null = null;

  try {
    const { applicationUrl } = req.body as { applicationUrl?: string };

    if (!applicationUrl) {
      res.status(400).json({
        success: false,
        message: "applicationUrl is required.",
      });
      return;
    }

    if (recordedActions.length === 0) {
      res.status(400).json({
        success: false,
        message: "No recorded actions available for replay.",
      });
      return;
    }

    replayBrowser = await chromium.launch({
      headless: false,
      slowMo: 300,
    });

    const replayContext = await replayBrowser.newContext({
      viewport: {
        width: 1366,
        height: 768,
      },
    });

    const replayPage = await replayContext.newPage();

    await replayPage.goto(applicationUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    for (const action of recordedActions) {
      if (!action.bestLocator) continue;

      const locator = buildLocatorFromText(
        replayPage,
        action.bestLocator
      ).first();

      if (action.action === "click") {
        await locator.click({ timeout: 10000 });
      }

      if (action.action === "fill") {
        await locator.fill(action.value || "", { timeout: 10000 });
      }

      if (action.action === "check") {
        await locator.check({ timeout: 10000 });
      }

      if (action.action === "selectOption") {
        await locator.selectOption(action.value || "", { timeout: 10000 });
      }
    }

    res.status(200).json({
      success: true,
      message: "Replay completed successfully",
      replayedActions: recordedActions.length,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Replay failed",
      error: error.message,
    });
  } finally {
    if (replayBrowser) {
      await replayBrowser.close().catch(() => {
        // Ignore close error.
      });
    }
  }
}