import { useMemo, useState } from "react";
import "./App.css";

function App() {
  const [copied, setCopied] = useState(false);

  const recorderScriptUrl = useMemo(() => {
    const baseUrl = window.location.origin + window.location.pathname.replace(/\/$/, "");
    return `${baseUrl}/smart-recorder.js`;
  }, []);

  const bookmarkletCode = useMemo(() => {
    return `javascript:(function(){var s=document.createElement('script');s.src='${recorderScriptUrl}?v='+Date.now();s.onload=function(){console.log('AI Playwright Smart Recorder loaded');};s.onerror=function(){alert('Unable to load AI Playwright Smart Recorder script. Please check GitHub Pages URL.');};document.body.appendChild(s);})();`;
  }, [recorderScriptUrl]);

  const handleCopyBookmarklet = async () => {
    try {
      await navigator.clipboard.writeText(bookmarkletCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = bookmarkletCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleCopyScriptUrl = async () => {
    try {
      await navigator.clipboard.writeText(recorderScriptUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      alert("Copy failed. Please copy the URL manually.");
    }
  };

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div className="hero-badge">Zero Backend • GitHub Pages • Bookmarklet Mode</div>

        <h1>AI Playwright Smart Recorder</h1>

        <p className="hero-subtitle">
          Lightweight browser-based inspector and recorder for generating XPath, CSS, and Playwright locators.
        </p>

        <div className="status-box">
          <strong>Current Mode:</strong> No backend required. User can open any target website, run the bookmarklet,
          inspect elements, record actions, and copy the generated script.
        </div>

        <div className="action-grid">
          <button className="primary-button" onClick={handleCopyBookmarklet}>
            {copied ? "Copied Successfully" : "Copy Bookmarklet Code"}
          </button>

          <button className="secondary-button" onClick={handleCopyScriptUrl}>
            Copy Recorder Script URL
          </button>
        </div>

        <div className="bookmarklet-preview">
          <div className="section-title">Bookmarklet Code</div>
          <textarea value={bookmarkletCode} readOnly />
        </div>
      </section>

      <section className="content-grid">
        <div className="info-card">
          <h2>How to use</h2>

          <ol>
            <li>Click <strong>Copy Bookmarklet Code</strong>.</li>
            <li>Create a new browser bookmark.</li>
            <li>Name it <strong>AI Recorder</strong>.</li>
            <li>Paste copied code into the bookmark URL field.</li>
            <li>Open your target application.</li>
            <li>Click the <strong>AI Recorder</strong> bookmark.</li>
            <li>The floating recorder popup will open on the target page.</li>
          </ol>
        </div>

        <div className="info-card">
          <h2>Available features</h2>

          <ul>
            <li>Smart Inspector popup</li>
            <li>Draggable recorder panel</li>
            <li>XPath locator generation</li>
            <li>CSS selector generation</li>
            <li>Playwright locator generation</li>
            <li>Element Pick stays ON until manually disabled</li>
            <li>Record click, fill, select, check, and uncheck actions</li>
            <li>Copy generated Playwright script</li>
          </ul>
        </div>

        <div className="info-card warning-card">
          <h2>Important limitation</h2>

          <p>
            This bookmarklet runs inside the browser page. Some websites may block external script injection because
            of strict security policies. For those applications, the next stable option is a Chrome Extension.
          </p>
        </div>

        <div className="info-card">
          <h2>Cost</h2>

          <p>
            This version can run fully on GitHub Pages with no backend, no database, and no cloud VM.
          </p>

          <div className="cost-line">
            <span>GitHub Pages</span>
            <strong>₹0/year</strong>
          </div>

          <div className="cost-line">
            <span>Backend Server</span>
            <strong>Not Required</strong>
          </div>

          <div className="cost-line">
            <span>Domain</span>
            <strong>Optional</strong>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;