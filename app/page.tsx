"use client";

import { useState, useRef, useCallback, useEffect } from "react";

function cleanHTML(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const body = doc.body;

  processNode(body);
  removeEmptyElements(body);

  return body.innerHTML.trim();
}

function processNode(node: Node): void {
  const children = Array.from(node.childNodes);
  children.forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      processNode(child);
    }
  });

  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const element = node as Element;

  // Strip unwanted attributes (class, style, dir, aria-level, role="presentation")
  const attrsToRemove = ["class", "style", "dir", "aria-level"];
  attrsToRemove.forEach((attr) => element.removeAttribute(attr));

  if (element.getAttribute("role") === "presentation") {
    element.removeAttribute("role");
  }

  // Remove empty attributes
  Array.from(element.attributes).forEach((attr) => {
    if (attr.value.trim() === "") {
      element.removeAttribute(attr.name);
    }
  });

  // Check for heading markers
  if (checkForHeadingMarker(element)) {
    return;
  }

  // Unwrap ALL span tags
  if (element.tagName === "SPAN") {
    unwrapElement(element);
  }
}

function checkForHeadingMarker(element: Element): boolean {
  if (element.tagName !== "P") return false;

  const textContent = element.textContent?.trim() || "";

  let headingLevel: string | null = null;
  let prefix: string | null = null;

  if (textContent.startsWith("H1:")) {
    headingLevel = "h1";
    prefix = "H1:";
  } else if (textContent.startsWith("H2:")) {
    headingLevel = "h2";
    prefix = "H2:";
  } else if (textContent.startsWith("H3:")) {
    headingLevel = "h3";
    prefix = "H3:";
  }

  if (!headingLevel || !prefix) return false;

  const headingText = textContent.substring(prefix.length).trim();
  const heading = document.createElement(headingLevel);
  heading.textContent = headingText;

  element.parentNode?.replaceChild(heading, element);
  return true;
}

function hasUsefulAttributes(element: Element): boolean {
  const usefulAttrs = ["href", "src", "alt", "title", "id", "name", "data-", "aria-", "role"];

  for (const attr of Array.from(element.attributes)) {
    if (usefulAttrs.some((useful) => attr.name.startsWith(useful))) {
      return true;
    }
  }
  return false;
}

function unwrapElement(element: Element): void {
  const parent = element.parentNode;
  if (!parent) return;

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }
  parent.removeChild(element);
}

function removeEmptyElements(node: Node): void {
  const children = Array.from(node.childNodes);
  children.forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      removeEmptyElements(child);
    }
  });

  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const element = node as Element;
  if (element === element.ownerDocument?.body) return;

  if (element.tagName === "P") {
    const innerHTML = element.innerHTML.trim();
    if (innerHTML === "" || innerHTML === "<br>" || innerHTML.toLowerCase() === "<br/>") {
      element.parentNode?.removeChild(element);
      return;
    }
  }

  const selfClosing = ["IMG", "BR", "HR", "INPUT", "META", "LINK"];
  if (!selfClosing.includes(element.tagName)) {
    if (element.innerHTML.trim() === "" && !hasUsefulAttributes(element)) {
      element.parentNode?.removeChild(element);
    }
  }
}

const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

function beautifyHTML(html: string): string {
  // Normalize whitespace between tags
  let result = html.replace(/>\s+</g, "><");
  const tokens: string[] = [];
  let i = 0;
  while (i < result.length) {
    if (result[i] === "<") {
      const end = result.indexOf(">", i);
      if (end === -1) {
        tokens.push(result.substring(i));
        break;
      }
      tokens.push(result.substring(i, end + 1));
      i = end + 1;
    } else {
      const end = result.indexOf("<", i);
      if (end === -1) {
        tokens.push(result.substring(i));
        break;
      }
      const text = result.substring(i, end);
      if (text.trim()) tokens.push(text);
      i = end;
    }
  }

  const lines: string[] = [];
  let indent = 0;
  for (const token of tokens) {
    if (token.startsWith("</")) {
      indent = Math.max(0, indent - 1);
      lines.push("  ".repeat(indent) + token);
    } else if (token.startsWith("<")) {
      const tagName = token.replace(/<\/?(\w+)[\s>].*/, "$1").toLowerCase();
      const isSelfClosing = token.endsWith("/>") || VOID_ELEMENTS.has(tagName);
      lines.push("  ".repeat(indent) + token);
      if (!isSelfClosing && !token.startsWith("<!")) {
        indent++;
      }
    } else {
      lines.push("  ".repeat(indent) + token);
    }
  }
  return lines.join("\n");
}

function minifyHTML(html: string): string {
  return html
    .replace(/\n\s*/g, "")
    .replace(/>\s+</g, "><")
    .trim();
}

export default function Home() {
  const [output, setOutput] = useState("");
  const [toast, setToast] = useState("");
  const [outputMode, setOutputMode] = useState<"html" | "preview">("html");
  const [htmlFormat, setHtmlFormat] = useState<"beautify" | "minify">("beautify");
  const editorRef = useRef<HTMLDivElement>(null);
  const outputEditorRef = useRef<HTMLDivElement>(null);
  const outputCodeRef = useRef<HTMLTextAreaElement>(null);
  const isOutputInternalEdit = useRef(false);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 2000);
  };

  // The display value for the HTML code view
  const displayOutput = outputMode === "html"
    ? (htmlFormat === "beautify" ? beautifyHTML(output) : minifyHTML(output))
    : output;

  // Sync output to the active output view only for external changes (e.g. auto-clean)
  useEffect(() => {
    if (isOutputInternalEdit.current) {
      isOutputInternalEdit.current = false;
      return;
    }
    if (outputMode === "html" && outputCodeRef.current) {
      outputCodeRef.current.value = displayOutput;
    }
    if (outputMode === "preview" && outputEditorRef.current) {
      outputEditorRef.current.innerHTML = output;
    }
  }, [output, outputMode, displayOutput]);

  const runClean = useCallback((html: string) => {
    if (!html.trim()) {
      setOutput("");
      return;
    }
    const cleaned = cleanHTML(html);
    setOutput(cleaned);
  }, []);

  const handleEditorInput = useCallback(() => {
    if (editorRef.current) {
      runClean(editorRef.current.innerHTML);
    }
  }, [runClean]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");

    if (editorRef.current) {
      const content = html || text;
      document.execCommand("insertHTML", false, content);
      runClean(editorRef.current.innerHTML);
    }
  }, [runClean]);

  // Get the selected HTML from whichever output panel is active, or null if no selection
  const getSelectionHTML = useCallback((): string | null => {
    if (outputMode === "html" && outputCodeRef.current) {
      const { selectionStart, selectionEnd } = outputCodeRef.current;
      if (selectionStart !== selectionEnd) {
        return outputCodeRef.current.value.substring(selectionStart, selectionEnd);
      }
    } else if (outputMode === "preview" && outputEditorRef.current) {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && outputEditorRef.current.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        const fragment = range.cloneContents();
        const div = document.createElement("div");
        div.appendChild(fragment);
        return div.innerHTML;
      }
    }
    return null;
  }, [outputMode]);

  // Copy HTML: always copies raw HTML code (selected or full)
  const handleCopyHTML = async () => {
    if (!output.trim()) {
      showToast("Nothing to copy");
      return;
    }
    try {
      const selected = getSelectionHTML();
      await navigator.clipboard.writeText(selected ?? displayOutput);
      showToast(selected ? "Copied selected HTML!" : "Copied HTML code!");
    } catch {
      showToast("Failed to copy");
    }
  };

  // Copy: always copies formatted/rich content (selected or full)
  const handleCopyFormatted = async () => {
    if (!output.trim()) {
      showToast("Nothing to copy");
      return;
    }
    try {
      const selectedHTML = getSelectionHTML();
      const htmlContent = selectedHTML ?? output;

      // Get plain text version
      const div = document.createElement("div");
      div.innerHTML = htmlContent;
      const plainContent = selectedHTML
        ? div.innerText
        : (outputEditorRef.current?.innerText || div.innerText);

      const blob = new Blob([htmlContent], { type: "text/html" });
      const plainBlob = new Blob([plainContent], { type: "text/plain" });
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": blob,
          "text/plain": plainBlob,
        }),
      ]);
      showToast(selectedHTML ? "Copied selected content!" : "Copied formatted content!");
    } catch {
      showToast("Failed to copy");
    }
  };

  const handleRemoveBr = () => {
    if (!output.trim()) {
      showToast("Nothing to clean");
      return;
    }
    const cleaned = output.replace(/<br\s*\/?>/gi, "");
    setOutput(cleaned);
    showToast("Removed <br> tags!");
  };

  const handleClear = () => {
    setOutput("");
    if (editorRef.current) {
      editorRef.current.innerHTML = "";
    }
    if (outputCodeRef.current) {
      outputCodeRef.current.value = "";
    }
    showToast("Cleared");
  };

  const handleOutputHtmlEdit = useCallback(() => {
    if (outputCodeRef.current) {
      isOutputInternalEdit.current = true;
      setOutput(outputCodeRef.current.value);
    }
  }, []);

  const handleOutputPreviewEdit = useCallback(() => {
    if (outputEditorRef.current) {
      isOutputInternalEdit.current = true;
      setOutput(outputEditorRef.current.innerHTML);
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-3">
        <div className="max-w-full mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            ✨ HTML Cleaner
          </h1>
          <div className="flex gap-2">
            <button
              onClick={handleClear}
              className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg font-medium hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors flex items-center gap-2"
              title="Clear all"
            >
              🗑️ Clear
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-row min-h-0">
        {/* Input Panel - WYSIWYG Editor */}
        <div className="flex-1 flex flex-col border-r border-zinc-200 dark:border-zinc-800 min-w-0">
          <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              📝 Paste Content Here
            </h2>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Paste from Word, Google Docs, etc. — auto-cleans as you type
            </p>
          </div>
          <div
            ref={editorRef}
            contentEditable
            onInput={handleEditorInput}
            onPaste={handlePaste}
            data-placeholder="Paste your content from Word, Google Docs, or any rich text source..."
            className="wysiwyg-editor flex-1 w-full p-4 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 overflow-auto focus:outline-none"
            spellCheck={false}
          />
        </div>

        {/* Output Panel */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400 shrink-0">
              🧼 Cleaned Output
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              {/* HTML / Preview toggle */}
              <div className="flex rounded-md overflow-hidden border border-zinc-300 dark:border-zinc-600 text-xs">
                <button
                  onClick={() => setOutputMode("html")}
                  className={`px-3 py-1 font-medium transition-colors ${
                    outputMode === "html"
                      ? "bg-blue-600 text-white"
                      : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  }`}
                >
                  &lt;/&gt; HTML
                </button>
                <button
                  onClick={() => setOutputMode("preview")}
                  className={`px-3 py-1 font-medium transition-colors ${
                    outputMode === "preview"
                      ? "bg-blue-600 text-white"
                      : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  }`}
                >
                  👁️ Preview
                </button>
              </div>
              {/* Beautify / Minify toggle (only in HTML mode) */}
              {outputMode === "html" && (
                <div className="flex rounded-md overflow-hidden border border-zinc-300 dark:border-zinc-600 text-xs">
                  <button
                    onClick={() => setHtmlFormat("beautify")}
                    className={`px-3 py-1 font-medium transition-colors ${
                      htmlFormat === "beautify"
                        ? "bg-emerald-600 text-white"
                        : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    }`}
                  >
                    🎨 Beautify
                  </button>
                  <button
                    onClick={() => setHtmlFormat("minify")}
                    className={`px-3 py-1 font-medium transition-colors ${
                      htmlFormat === "minify"
                        ? "bg-emerald-600 text-white"
                        : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    }`}
                  >
                    📦 Minify
                  </button>
                </div>
              )}
              {/* Remove <br> */}
              <button
                onClick={handleRemoveBr}
                className="px-3 py-1 text-xs font-medium rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                title="Remove all <br> tags"
              >
                🧽 Remove &lt;br&gt;
              </button>
              {/* Copy buttons */}
              <button
                onClick={handleCopyHTML}
                className="px-3 py-1 text-xs font-medium rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                title="Copy raw HTML code (selection or all)"
              >
                📋 Copy HTML
              </button>
              <button
                onClick={handleCopyFormatted}
                className="px-3 py-1 text-xs font-medium rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                title="Copy formatted content (selection or all)"
              >
                📄 Copy
              </button>
            </div>
          </div>

          {/* HTML code view (editable, uncontrolled) */}
          {outputMode === "html" && (
            <textarea
              ref={outputCodeRef}
              defaultValue={displayOutput}
              onInput={handleOutputHtmlEdit}
              placeholder="Cleaned HTML will appear here..."
              className="flex-1 w-full p-4 font-mono text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 resize-none focus:outline-none"
              spellCheck={false}
            />
          )}

          {/* Preview view (editable, ref-managed) */}
          {outputMode === "preview" && (
            <div
              ref={outputEditorRef}
              contentEditable
              onInput={handleOutputPreviewEdit}
              className="wysiwyg-editor flex-1 w-full p-6 bg-white dark:bg-zinc-900 overflow-auto prose dark:prose-invert max-w-none focus:outline-none"
              spellCheck={false}
            />
          )}
        </div>
      </main>

      {/* Toast */}
      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 rounded-lg text-sm font-medium transition-all duration-300 ${
          toast ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        {toast}
      </div>
    </div>
  );
}
