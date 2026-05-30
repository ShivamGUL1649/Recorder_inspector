(function () {
  "use strict";

  const APP_ID = "ai-playwright-smart-recorder-root";
  const STYLE_ID = "ai-playwright-smart-recorder-style";
  const HIGHLIGHT_ID = "ai-playwright-smart-recorder-highlight";

  if (document.getElementById(APP_ID)) {
    const existing = document.getElementById(APP_ID);
    existing.style.display = existing.style.display === "none" ? "block" : "none";
    return;
  }

  const state = {
    mode: "playwright",
    pickEnabled: false,
    recording: false,
    actions: [],
    lastLocator: "",
    lastScript: "",
    inputTimers: new WeakMap()
  };

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${APP_ID} {
        position: fixed;
        top: 80px;
        right: 30px;
        width: 390px;
        max-height: 82vh;
        z-index: 2147483647;
        font-family: Arial, sans-serif;
        color: #111827;
        background: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 16px;
        box-shadow: 0 18px 50px rgba(0,0,0,0.25);
        overflow: hidden;
      }

      #${APP_ID} * {
        box-sizing: border-box;
      }

      .aisr-header {
        padding: 12px 14px;
        cursor: move;
        user-select: none;
        background: linear-gradient(135deg, #2563eb, #7c3aed);
        color: white;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .aisr-title {
        font-size: 15px;
        font-weight: 700;
        line-height: 1.2;
      }

      .aisr-subtitle {
        font-size: 11px;
        opacity: 0.9;
        margin-top: 2px;
      }

      .aisr-close {
        border: none;
        background: rgba(255,255,255,0.18);
        color: white;
        border-radius: 10px;
        padding: 5px 9px;
        cursor: pointer;
        font-size: 13px;
      }

      .aisr-body {
        padding: 12px;
        background: #f9fafb;
        overflow-y: auto;
        max-height: calc(82vh - 56px);
      }

      .aisr-row {
        display: flex;
        gap: 8px;
        margin-bottom: 10px;
      }

      .aisr-button {
        border: 1px solid #d1d5db;
        background: #ffffff;
        color: #111827;
        border-radius: 10px;
        padding: 8px 10px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        flex: 1;
      }

      .aisr-button:hover {
        background: #f3f4f6;
      }

      .aisr-button-primary {
        border-color: #2563eb;
        background: #2563eb;
        color: white;
      }

      .aisr-button-success {
        border-color: #16a34a;
        background: #16a34a;
        color: white;
      }

      .aisr-button-danger {
        border-color: #dc2626;
        background: #dc2626;
        color: white;
      }

      .aisr-button-active {
        border-color: #7c3aed;
        background: #ede9fe;
        color: #5b21b6;
      }

      .aisr-label {
        font-size: 12px;
        font-weight: 700;
        margin: 10px 0 6px;
        color: #374151;
      }

      .aisr-output {
        width: 100%;
        min-height: 74px;
        resize: vertical;
        border: 1px solid #d1d5db;
        border-radius: 10px;
        padding: 8px;
        font-family: Consolas, Monaco, monospace;
        font-size: 12px;
        background: #ffffff;
        color: #111827;
      }

      .aisr-script-output {
        min-height: 170px;
      }

      .aisr-status {
        padding: 8px 10px;
        border-radius: 10px;
        background: #eef2ff;
        color: #3730a3;
        font-size: 12px;
        line-height: 1.4;
        margin-bottom: 10px;
      }

      #${HIGHLIGHT_ID} {
        position: fixed;
        pointer-events: none;
        z-index: 2147483646;
        border: 3px solid #2563eb;
        background: rgba(37, 99, 235, 0.12);
        border-radius: 6px;
        display: none;
      }
    `;

    document.head.appendChild(style);
  }

  function createPanel() {
    const root = document.createElement("div");
    root.id = APP_ID;

    root.innerHTML = `
      <div class="aisr-header" id="aisr-drag-header">
        <div>
          <div class="aisr-title">AI Playwright Smart Recorder</div>
          <div class="aisr-subtitle">GitHub Pages • Bookmarklet • No Backend</div>
        </div>
        <button class="aisr-close" id="aisr-hide-btn">Hide</button>
      </div>

      <div class="aisr-body">
        <div class="aisr-status" id="aisr-status">
          Ready. Select locator mode, enable element pick, then click any element.
        </div>

        <div class="aisr-label">Locator Mode</div>
        <div class="aisr-row">
          <button class="aisr-button aisr-button-active" id="aisr-mode-playwright">Playwright</button>
          <button class="aisr-button" id="aisr-mode-css">CSS</button>
          <button class="aisr-button" id="aisr-mode-xpath">XPath</button>
        </div>

        <div class="aisr-row">
          <button class="aisr-button aisr-button-primary" id="aisr-pick-btn">Enable Element Pick</button>
          <button class="aisr-button aisr-button-success" id="aisr-copy-locator-btn">Copy Locator</button>
        </div>

        <div class="aisr-label">Selected Locator</div>
        <textarea class="aisr-output" id="aisr-locator-output" readonly placeholder="Selected locator will appear here..."></textarea>

        <div class="aisr-label">Recorder</div>
        <div class="aisr-row">
          <button class="aisr-button aisr-button-success" id="aisr-start-record-btn">Start Recording</button>
          <button class="aisr-button aisr-button-danger" id="aisr-stop-record-btn">Stop Recording</button>
        </div>

        <div class="aisr-row">
          <button class="aisr-button aisr-button-primary" id="aisr-generate-script-btn">Generate Script</button>
          <button class="aisr-button aisr-button-success" id="aisr-copy-script-btn">Copy Script</button>
        </div>

        <div class="aisr-label">Recorded Script</div>
        <textarea class="aisr-output aisr-script-output" id="aisr-script-output" readonly placeholder="Generated Playwright script will appear here..."></textarea>
      </div>
    `;

    document.body.appendChild(root);

    const highlight = document.createElement("div");
    highlight.id = HIGHLIGHT_ID;
    document.body.appendChild(highlight);

    return root;
  }

  function setStatus(message) {
    const el = document.getElementById("aisr-status");
    if (el) el.textContent = message;
  }

  function isRecorderElement(element) {
    return Boolean(element && element.closest && element.closest(`#${APP_ID}`));
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }

    return String(value).replace(/["\\#.;:[\],>+~*^$|=(){}]/g, "\\$&");
  }

  function escapeSingleQuote(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }

  function getElementName(element) {
    return element.tagName ? element.tagName.toLowerCase() : "element";
  }

  function getCleanText(element) {
    return (element.innerText || element.textContent || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
  }

  function isUniqueCss(selector) {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch {
      return false;
    }
  }

  function isUniqueXPath(xpath) {
    try {
      const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      return result.snapshotLength === 1;
    } catch {
      return false;
    }
  }

  function getCssSelector(element) {
    const tag = getElementName(element);
    const candidates = [];

    if (element.id) {
      candidates.push(`#${cssEscape(element.id)}`);
      candidates.push(`${tag}#${cssEscape(element.id)}`);
    }

    const attrs = [
      "data-testid",
      "data-test",
      "data-cy",
      "name",
      "aria-label",
      "placeholder",
      "title",
      "alt",
      "type"
    ];

    attrs.forEach((attr) => {
      const value = element.getAttribute(attr);
      if (value) {
        const safeValue = value.replace(/"/g, '\\"');
        candidates.push(`${tag}[${attr}="${safeValue}"]`);
        candidates.push(`[${attr}="${safeValue}"]`);
      }
    });

    if (element.classList && element.classList.length > 0) {
      const classSelector = Array.from(element.classList)
        .filter(Boolean)
        .slice(0, 3)
        .map((cls) => `.${cssEscape(cls)}`)
        .join("");

      if (classSelector) {
        candidates.push(`${tag}${classSelector}`);
      }
    }

    for (const candidate of candidates) {
      if (isUniqueCss(candidate)) return candidate;
    }

    let current = element;
    const parts = [];

    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
      let part = getElementName(current);

      if (current.id) {
        part += `#${cssEscape(current.id)}`;
        parts.unshift(part);

        const selector = parts.join(" > ");
        if (isUniqueCss(selector)) return selector;

        break;
      }

      const dataTestId =
        current.getAttribute("data-testid") ||
        current.getAttribute("data-test") ||
        current.getAttribute("data-cy");

      if (dataTestId) {
        part += `[data-testid="${dataTestId.replace(/"/g, '\\"')}"]`;
      } else {
        const parent = current.parentElement;
        if (parent) {
          const sameTagSiblings = Array.from(parent.children).filter(
            (child) => getElementName(child) === getElementName(current)
          );

          if (sameTagSiblings.length > 1) {
            const index = sameTagSiblings.indexOf(current) + 1;
            part += `:nth-of-type(${index})`;
          }
        }
      }

      parts.unshift(part);

      const selector = parts.join(" > ");
      if (isUniqueCss(selector)) return selector;

      current = current.parentElement;
    }

    return parts.join(" > ") || tag;
  }

  function getXPathSelector(element) {
    const tag = getElementName(element);
    const text = getCleanText(element);
    const candidates = [];

    const attrs = [
      "id",
      "data-testid",
      "data-test",
      "data-cy",
      "name",
      "aria-label",
      "placeholder",
      "title",
      "alt",
      "type"
    ];

    attrs.forEach((attr) => {
      const value = element.getAttribute(attr);
      if (value) {
        const safeValue = value.replace(/'/g, `"`);
        candidates.push(`//${tag}[@${attr}='${safeValue}']`);
        candidates.push(`//*[@${attr}='${safeValue}']`);
      }
    });

    if (text && text.length <= 50) {
      const safeText = text.replace(/'/g, `"`);
      candidates.push(`//${tag}[normalize-space()='${safeText}']`);
      candidates.push(`//*[normalize-space()='${safeText}']`);
      candidates.push(`//${tag}[contains(normalize-space(),'${safeText.slice(0, 30)}')]`);
    }

    for (const candidate of candidates) {
      if (isUniqueXPath(candidate)) return candidate;
    }

    let current = element;
    const parts = [];

    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
      const currentTag = getElementName(current);
      const parent = current.parentElement;

      if (parent) {
        const sameTagSiblings = Array.from(parent.children).filter(
          (child) => getElementName(child) === currentTag
        );

        if (sameTagSiblings.length > 1) {
          const index = sameTagSiblings.indexOf(current) + 1;
          parts.unshift(`${currentTag}[${index}]`);
        } else {
          parts.unshift(currentTag);
        }
      } else {
        parts.unshift(currentTag);
      }

      const xpath = `//${parts.join("/")}`;
      if (isUniqueXPath(xpath)) return xpath;

      current = current.parentElement;
    }

    return `//${parts.join("/")}`;
  }

  function getSuggestedRole(element) {
    const explicitRole = element.getAttribute("role");
    if (explicitRole) return explicitRole;

    const tag = getElementName(element);
    const type = (element.getAttribute("type") || "").toLowerCase();

    if (tag === "button") return "button";
    if (tag === "a" && element.getAttribute("href")) return "link";
    if (tag === "select") return "combobox";
    if (tag === "textarea") return "textbox";

    if (tag === "input") {
      if (["button", "submit", "reset"].includes(type)) return "button";
      if (type === "checkbox") return "checkbox";
      if (type === "radio") return "radio";
      if (type === "search") return "searchbox";
      return "textbox";
    }

    return "";
  }

  function getAccessibleName(element) {
    const ariaLabel = element.getAttribute("aria-label");
    if (ariaLabel) return ariaLabel.trim();

    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy) {
      const labelElement = document.getElementById(labelledBy);
      if (labelElement) return getCleanText(labelElement);
    }

    if (element.id) {
      const label = document.querySelector(`label[for="${cssEscape(element.id)}"]`);
      if (label) return getCleanText(label);
    }

    const wrappedLabel = element.closest("label");
    if (wrappedLabel) return getCleanText(wrappedLabel);

    const value = element.getAttribute("value");
    const type = (element.getAttribute("type") || "").toLowerCase();

    if (value && ["button", "submit", "reset"].includes(type)) {
      return value;
    }

    return getCleanText(element);
  }

  function getPlaywrightLocator(element) {
    const dataTestId =
      element.getAttribute("data-testid") ||
      element.getAttribute("data-test") ||
      element.getAttribute("data-cy");

    if (dataTestId) {
      return `page.getByTestId('${escapeSingleQuote(dataTestId)}')`;
    }

    const ariaLabel = element.getAttribute("aria-label");
    if (ariaLabel) {
      return `page.getByLabel('${escapeSingleQuote(ariaLabel)}')`;
    }

    const placeholder = element.getAttribute("placeholder");
    if (placeholder) {
      return `page.getByPlaceholder('${escapeSingleQuote(placeholder)}')`;
    }

    const alt = element.getAttribute("alt");
    if (alt) {
      return `page.getByAltText('${escapeSingleQuote(alt)}')`;
    }

    const title = element.getAttribute("title");
    if (title) {
      return `page.getByTitle('${escapeSingleQuote(title)}')`;
    }

    const role = getSuggestedRole(element);
    const accessibleName = getAccessibleName(element);

    if (role && accessibleName) {
      return `page.getByRole('${role}', { name: '${escapeSingleQuote(accessibleName)}' })`;
    }

    const text = getCleanText(element);
    if (text && text.length <= 60) {
      return `page.getByText('${escapeSingleQuote(text)}')`;
    }

    const css = getCssSelector(element);
    return `page.locator('${escapeSingleQuote(css)}')`;
  }

  function getBestLocator(element) {
    if (state.mode === "css") return getCssSelector(element);
    if (state.mode === "xpath") return getXPathSelector(element);
    return getPlaywrightLocator(element);
  }

  function setMode(mode) {
    state.mode = mode;

    ["playwright", "css", "xpath"].forEach((item) => {
      const btn = document.getElementById(`aisr-mode-${item}`);
      if (btn) {
        btn.classList.toggle("aisr-button-active", item === mode);
      }
    });

    setStatus(`Locator mode changed to ${mode.toUpperCase()}.`);
  }

  function showHighlight(element) {
    const highlight = document.getElementById(HIGHLIGHT_ID);
    if (!highlight || !element || isRecorderElement(element)) return;

    const rect = element.getBoundingClientRect();

    highlight.style.display = "block";
    highlight.style.left = `${rect.left}px`;
    highlight.style.top = `${rect.top}px`;
    highlight.style.width = `${rect.width}px`;
    highlight.style.height = `${rect.height}px`;
  }

  function hideHighlight() {
    const highlight = document.getElementById(HIGHLIGHT_ID);
    if (highlight) highlight.style.display = "none";
  }

  function selectElement(element) {
    const locator = getBestLocator(element);
    const output = document.getElementById("aisr-locator-output");

    state.lastLocator = locator;

    if (output) {
      output.value = locator;
    }

    setStatus(`Locator captured in ${state.mode.toUpperCase()} mode. Element Pick is still ON.`);
  }

  function addOrReplaceFillAction(element, value) {
    const locator = getPlaywrightLocator(element);

    const existingIndex = state.actions.findIndex(
      (action) => action.type === "fill" && action.locator === locator
    );

    const action = {
      type: "fill",
      locator,
      value: value || ""
    };

    if (existingIndex >= 0) {
      state.actions[existingIndex] = action;
    } else {
      state.actions.push(action);
    }

    setStatus(`Recording ON. Captured ${state.actions.length} action(s).`);
  }

  function recordAction(type, element, value) {
    const locator = getPlaywrightLocator(element);

    state.actions.push({
      type,
      locator,
      value: value || ""
    });

    setStatus(`Recording ON. Captured ${state.actions.length} action(s).`);
  }

  function generateScript() {
    const lines = [];

    lines.push("import { test, expect } from '@playwright/test';");
    lines.push("");
    lines.push("test('recorded test', async ({ page }) => {");
    lines.push(`  await page.goto('${escapeSingleQuote(location.href)}');`);

    state.actions.forEach((action) => {
      if (action.type === "click") {
        lines.push(`  await ${action.locator}.click();`);
      }

      if (action.type === "fill") {
        lines.push(`  await ${action.locator}.fill('${escapeSingleQuote(action.value)}');`);
      }

      if (action.type === "select") {
        lines.push(`  await ${action.locator}.selectOption('${escapeSingleQuote(action.value)}');`);
      }

      if (action.type === "check") {
        lines.push(`  await ${action.locator}.check();`);
      }

      if (action.type === "uncheck") {
        lines.push(`  await ${action.locator}.uncheck();`);
      }
    });

    lines.push("});");

    state.lastScript = lines.join("\n");

    const output = document.getElementById("aisr-script-output");
    if (output) output.value = state.lastScript;

    setStatus(`Script generated with ${state.actions.length} recorded action(s).`);
  }

  async function copyText(text, successMessage) {
    if (!text) {
      setStatus("Nothing to copy.");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setStatus(successMessage);
    } catch {
      const temp = document.createElement("textarea");
      temp.value = text;
      document.body.appendChild(temp);
      temp.select();
      document.execCommand("copy");
      document.body.removeChild(temp);
      setStatus(successMessage);
    }
  }

  function makeDraggable(root) {
    const header = document.getElementById("aisr-drag-header");
    if (!header) return;

    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let dragging = false;

    header.addEventListener("mousedown", (event) => {
      dragging = true;

      const rect = root.getBoundingClientRect();

      startX = event.clientX;
      startY = event.clientY;
      startLeft = rect.left;
      startTop = rect.top;

      root.style.left = `${startLeft}px`;
      root.style.top = `${startTop}px`;
      root.style.right = "auto";

      event.preventDefault();
    });

    document.addEventListener("mousemove", (event) => {
      if (!dragging) return;

      const dx = event.clientX - startX;
      const dy = event.clientY - startY;

      root.style.left = `${Math.max(0, startLeft + dx)}px`;
      root.style.top = `${Math.max(0, startTop + dy)}px`;
    });

    document.addEventListener("mouseup", () => {
      dragging = false;
    });
  }

  function attachEvents(root) {
    document.getElementById("aisr-hide-btn").addEventListener("click", () => {
      root.style.display = "none";
      hideHighlight();
    });

    document.getElementById("aisr-mode-playwright").addEventListener("click", () => setMode("playwright"));
    document.getElementById("aisr-mode-css").addEventListener("click", () => setMode("css"));
    document.getElementById("aisr-mode-xpath").addEventListener("click", () => setMode("xpath"));

    document.getElementById("aisr-pick-btn").addEventListener("click", () => {
      state.pickEnabled = !state.pickEnabled;

      const btn = document.getElementById("aisr-pick-btn");

      if (state.pickEnabled) {
        btn.textContent = "Disable Element Pick";
        btn.classList.remove("aisr-button-primary");
        btn.classList.add("aisr-button-danger");
        setStatus("Element Pick is ON. It will stay ON until you disable it manually.");
      } else {
        btn.textContent = "Enable Element Pick";
        btn.classList.remove("aisr-button-danger");
        btn.classList.add("aisr-button-primary");
        hideHighlight();
        setStatus("Element Pick is OFF.");
      }
    });

    document.getElementById("aisr-copy-locator-btn").addEventListener("click", () => {
      copyText(state.lastLocator, "Locator copied successfully.");
    });

    document.getElementById("aisr-start-record-btn").addEventListener("click", () => {
      state.recording = true;
      state.actions = [];
      state.lastScript = "";

      const output = document.getElementById("aisr-script-output");
      if (output) output.value = "";

      setStatus("Recording started. Perform click, type, select, checkbox, or radio actions.");
    });

    document.getElementById("aisr-stop-record-btn").addEventListener("click", () => {
      state.recording = false;
      setStatus(`Recording stopped. Total actions: ${state.actions.length}.`);
    });

    document.getElementById("aisr-generate-script-btn").addEventListener("click", () => {
      generateScript();
    });

    document.getElementById("aisr-copy-script-btn").addEventListener("click", () => {
      copyText(state.lastScript, "Recorded script copied successfully.");
    });

    document.addEventListener(
      "mouseover",
      (event) => {
        if (!state.pickEnabled) return;

        const target = event.target;
        if (isRecorderElement(target)) return;

        showHighlight(target);
      },
      true
    );

    document.addEventListener(
      "click",
      (event) => {
        const target = event.target;

        if (isRecorderElement(target)) return;

        if (state.pickEnabled) {
          event.preventDefault();
          event.stopPropagation();
          selectElement(target);
          return;
        }

        if (state.recording) {
          recordAction("click", target);
        }
      },
      true
    );

    document.addEventListener(
      "input",
      (event) => {
        const target = event.target;

        if (isRecorderElement(target)) return;
        if (!state.recording) return;

        const tag = getElementName(target);
        const type = (target.getAttribute("type") || "").toLowerCase();

        if (tag === "input" || tag === "textarea") {
          if (type === "checkbox") {
            recordAction(target.checked ? "check" : "uncheck", target);
            return;
          }

          if (type === "radio") {
            return;
          }

          const oldTimer = state.inputTimers.get(target);
          if (oldTimer) {
            clearTimeout(oldTimer);
          }

          const timer = setTimeout(() => {
            addOrReplaceFillAction(target, target.value);
          }, 500);

          state.inputTimers.set(target, timer);
        }
      },
      true
    );

    document.addEventListener(
      "change",
      (event) => {
        const target = event.target;

        if (isRecorderElement(target)) return;
        if (!state.recording) return;

        const tag = getElementName(target);
        const type = (target.getAttribute("type") || "").toLowerCase();

        if (tag === "select") {
          recordAction("select", target, target.value);
        }

        if (tag === "input" && type === "radio") {
          recordAction("check", target);
        }
      },
      true
    );
  }

  injectStyle();

  const root = createPanel();

  makeDraggable(root);
  attachEvents(root);

  window.__AI_PLAYWRIGHT_SMART_RECORDER__ = {
    version: "bookmarklet-v2",
    state
  };

  setStatus("Smart Recorder loaded. No backend required.");
})();