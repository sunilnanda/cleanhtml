"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import DOMPurify from "dompurify";
import { cleanHTML, beautifyHTML, minifyHTML } from "@/lib/html-cleaner";
import { useDebouncedCallback } from "@/lib/use-debounce";
import pkg from "@/package.json";

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
      outputEditorRef.current.innerHTML = DOMPurify.sanitize(output);
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

  const debouncedRunClean = useDebouncedCallback(runClean, 150);

  const handleEditorInput = useCallback(() => {
    if (editorRef.current) {
      debouncedRunClean(editorRef.current.innerHTML);
    }
  }, [debouncedRunClean]);

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
      div.innerHTML = DOMPurify.sanitize(htmlContent);
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
    let cleaned = output.replace(/<br\s*\/?>/gi, "");
    // Remove HTML comments (e.g. <!--StartFragment-->, <!--EndFragment-->)
    cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, "");
    // Remove empty paragraphs left behind
    cleaned = cleaned.replace(/<p>\s*<\/p>/gi, "");
    setOutput(cleaned);

    // Also strip <br> tags, comments, and blank lines from the input editor
    if (editorRef.current) {
      const inputHTML = editorRef.current.innerHTML;
      let cleanedInput = inputHTML.replace(/<br\s*\/?>/gi, "");
      cleanedInput = cleanedInput.replace(/<!--[\s\S]*?-->/g, "");
      cleanedInput = cleanedInput.replace(/<p>\s*<\/p>/gi, "");
      editorRef.current.innerHTML = cleanedInput;
    }

    showToast("Removed <br> tags, comments, and blank lines!");
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
          <div className="flex items-baseline gap-2">
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              ✨ HTML Cleaner
            </h1>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">v{pkg.version}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleClear}
              aria-label="Clear all content"
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
          <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between min-h-[52px]">
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
            role="textbox"
            aria-label="Rich text input editor"
            aria-multiline="true"
            data-placeholder="Paste your content from Word, Google Docs, or any rich text source..."
            className="wysiwyg-editor flex-1 w-full p-4 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 overflow-auto focus:outline-none"
            spellCheck={false}
          />
        </div>

        {/* Output Panel */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2 min-h-[52px]">
            <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400 shrink-0">
              🧼 Cleaned Output
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              {/* HTML / Preview toggle */}
              <div className="flex rounded-md overflow-hidden border border-zinc-300 dark:border-zinc-600 text-xs" role="group" aria-label="Output view mode">
                <button
                  onClick={() => setOutputMode("html")}
                  aria-label="Show HTML code"
                  aria-pressed={outputMode === "html"}
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
                  aria-label="Show formatted preview"
                  aria-pressed={outputMode === "preview"}
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
                <div className="flex rounded-md overflow-hidden border border-zinc-300 dark:border-zinc-600 text-xs" role="group" aria-label="HTML format mode">
                  <button
                    onClick={() => setHtmlFormat("beautify")}
                    aria-label="Beautify HTML output"
                    aria-pressed={htmlFormat === "beautify"}
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
                    aria-label="Minify HTML output"
                    aria-pressed={htmlFormat === "minify"}
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
                aria-label="Remove all line break tags"
                className="px-3 py-1 text-xs font-medium rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                title="Remove all <br> tags"
              >
                🧽 Remove &lt;br&gt;
              </button>
              {/* Copy buttons */}
              <button
                onClick={handleCopyHTML}
                aria-label="Copy raw HTML code"
                className="px-3 py-1 text-xs font-medium rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                title="Copy raw HTML code (selection or all)"
              >
                📋 Copy HTML
              </button>
              <button
                onClick={handleCopyFormatted}
                aria-label="Copy formatted content"
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
              aria-label="Cleaned HTML code output"
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
              role="textbox"
              aria-label="Cleaned output preview"
              aria-multiline="true"
              className="wysiwyg-editor flex-1 w-full p-6 bg-white dark:bg-zinc-900 overflow-auto prose dark:prose-invert max-w-none focus:outline-none"
              spellCheck={false}
            />
          )}
        </div>
      </main>

      {/* Toast */}
      <div
        role="status"
        aria-live="polite"
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 rounded-lg text-sm font-medium transition-all duration-300 ${
          toast ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        {toast}
      </div>
    </div>
  );
}
