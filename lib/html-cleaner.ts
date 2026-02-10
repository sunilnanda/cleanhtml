// Australian phone patterns:
// Mobile: 04XX XXX XXX, Landline: (0X) XXXX XXXX or 0X XXXX XXXX
// 1300/1800: 1300 XXX XXX, 1800 XXX XXX
// International: +61 X XXXX XXXX
const PHONE_REGEX =
  /(?:\+61\s?\d[\s-]?\d{4}[\s-]?\d{4})|(?:\(0\d\)\s?\d{4}[\s-]?\d{4})|(?:0[2-478]\s?\d{4}[\s-]?\d{4})|(?:04\d{2}[\s-]?\d{3}[\s-]?\d{3})|(?:1[38]00[\s-]?\d{3}[\s-]?\d{3})/g;

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

function processNode(node: Node): void {
  const children = Array.from(node.childNodes);
  children.forEach((child) => {
    if (child.nodeType === Node.COMMENT_NODE) {
      child.parentNode?.removeChild(child);
      return;
    }
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

  // Convert bold/italic spans to semantic tags before unwrapping
  if (element.tagName === "SPAN") {
    const style = element.getAttribute("style") || "";
    const isBold = /font-weight:\s*(bold|700|800|900)/i.test(style);
    const isItalic = /font-style:\s*italic/i.test(style);

    if (isBold) {
      const strong = document.createElement("strong");
      while (element.firstChild) {
        strong.appendChild(element.firstChild);
      }
      element.parentNode?.replaceChild(strong, element);
      if (isItalic) {
        const em = document.createElement("em");
        while (strong.firstChild) {
          em.appendChild(strong.firstChild);
        }
        strong.appendChild(em);
      }
    } else if (isItalic) {
      const em = document.createElement("em");
      while (element.firstChild) {
        em.appendChild(element.firstChild);
      }
      element.parentNode?.replaceChild(em, element);
    } else {
      unwrapElement(element);
    }
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
  } else if (textContent.startsWith("H4:")) {
    headingLevel = "h4";
    prefix = "H4:";
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

function cleanListItems(root: Node): void {
  const doc = (root as Element).ownerDocument;
  if (!doc) return;

  const listItems = (root as Element).querySelectorAll("li");
  for (const li of Array.from(listItems)) {
    // Unwrap <p> tags inside <li> — move children out, remove the <p>
    const paragraphs = li.querySelectorAll("p");
    for (const p of Array.from(paragraphs)) {
      unwrapElement(p);
    }

    // Auto-bold "Label:" pattern in list items
    // Only if the <li> doesn't already start with a <strong>/<b>
    const firstChild = li.firstChild;
    if (firstChild && firstChild.nodeType === Node.ELEMENT_NODE) {
      const tag = (firstChild as Element).tagName;
      if (tag === "STRONG" || tag === "B") continue;
    }

    const textContent = li.textContent || "";
    const colonIndex = textContent.indexOf(":");
    if (colonIndex > 0 && colonIndex < 80) {
      // Find the colon in the actual DOM nodes and wrap everything before it in <strong>
      boldUpToColon(li, doc);
    }
  }
}

function boldUpToColon(li: Element, doc: Document): void {
  // Collect all child nodes, find the colon position, and wrap pre-colon content in <strong>
  const strong = doc.createElement("strong");
  const children = Array.from(li.childNodes);
  let found = false;

  for (const child of children) {
    if (found) break;

    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent || "";
      const colonIdx = text.indexOf(":");
      if (colonIdx !== -1) {
        // Text before colon (including colon) goes into <strong>
        const beforeColon = text.substring(0, colonIdx + 1);
        const afterColon = text.substring(colonIdx + 1);
        strong.appendChild(doc.createTextNode(beforeColon));
        // Replace this text node with the strong + remainder
        li.insertBefore(strong, child);
        if (afterColon) {
          child.textContent = afterColon;
        } else {
          li.removeChild(child);
        }
        found = true;
      } else {
        // Entire text node goes before the colon
        li.removeChild(child);
        strong.appendChild(child);
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      // If this element already contains bold formatting, skip auto-bolding entirely
      if (el.tagName === "STRONG" || el.tagName === "B") return;

      const text = el.textContent || "";
      const colonIdx = text.indexOf(":");
      if (colonIdx !== -1) {
        // The colon is inside this element — move the whole element into strong
        li.removeChild(child);
        strong.appendChild(child);
        // Insert strong and stop
        li.insertBefore(strong, li.firstChild);
        found = true;
      } else {
        li.removeChild(child);
        strong.appendChild(child);
      }
    }
  }

  // If we never found a colon (shouldn't happen), put everything back
  if (!found) {
    while (strong.firstChild) {
      li.appendChild(strong.firstChild);
    }
  }
}

function autoLinkEmailsAndPhones(root: Node): void {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  for (const textNode of textNodes) {
    // Skip if already inside a link
    if (textNode.parentElement?.closest("a")) continue;

    const text = textNode.textContent || "";
    // Build a combined regex to find all matches in order
    const combined = new RegExp(
      `(${PHONE_REGEX.source})|(${EMAIL_REGEX.source})`,
      "g"
    );
    const matches = [...text.matchAll(combined)];
    if (matches.length === 0) continue;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    for (const match of matches) {
      const matchText = match[0];
      const matchIndex = match.index!;

      // Add text before this match
      if (matchIndex > lastIndex) {
        fragment.appendChild(
          document.createTextNode(text.substring(lastIndex, matchIndex))
        );
      }

      const anchor = document.createElement("a");
      anchor.textContent = matchText;

      if (match[1]) {
        // Phone match — strip spaces/dashes for the tel: href
        const digits = matchText.replace(/[\s()-]/g, "");
        anchor.href = `tel:${digits}`;
      } else {
        // Email match
        anchor.href = `mailto:${matchText}`;
      }

      fragment.appendChild(anchor);
      lastIndex = matchIndex + matchText.length;
    }

    // Add remaining text after last match
    if (lastIndex < text.length) {
      fragment.appendChild(
        document.createTextNode(text.substring(lastIndex))
      );
    }

    textNode.parentNode?.replaceChild(fragment, textNode);
  }
}

export function cleanHTML(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const body = doc.body;

  processNode(body);
  cleanListItems(body);
  removeEmptyElements(body);
  autoLinkEmailsAndPhones(body);

  return body.innerHTML.trim();
}

export function beautifyHTML(html: string): string {
  // Normalize whitespace between tags
  const result = html.replace(/>\s+</g, "><");
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

export function minifyHTML(html: string): string {
  return html
    .replace(/\n\s*/g, "")
    .replace(/>\s+</g, "><")
    .trim();
}
