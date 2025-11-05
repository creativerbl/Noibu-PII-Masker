// ---------- Helpers ----------

// Safely query DOM elements, ignoring invalid CSS selectors
function safeQuerySelectorAll(root, selector) {
  try {
    return root.querySelectorAll(selector);
  } catch (err) {
    console.warn("Invalid selector skipped:", selector);
    return [];
  }
}

// Replace or mask matching text in a text node
function applyToTextNode(node, targets, mode) {
  if (!node || node.nodeType !== Node.TEXT_NODE) return;

  const original = node.textContent;
  if (!original) return;

  let text = original;

  for (const t of targets) {
    if (t.type !== "Text" || !t.value) continue;

    try {
      const regex = new RegExp(t.value, "gi"); // partial, case-insensitive
      if (mode === "replace") {
        const replacement = typeof t.replacement === "string" ? t.replacement : "";
        text = text.replace(regex, replacement);
      } else {
        text = text.replace(regex, (match) => "*".repeat(match.length));
      }
    } catch (err) {
      console.warn("Invalid text pattern skipped:", t.value);
    }
  }

  if (text !== original) {
    node.textContent = text;
  }
}

function maskElement(el) {
  if (!el) return;

  // 1) Mask form fields (value) if visible and not password
  const isFormField = el.tagName === "INPUT" || el.tagName === "TEXTAREA";
  if (isFormField) {
    if (el.type !== "password" && typeof el.value === "string" && el.value.length > 0) {
      el.setAttribute("data-pii-masked", "true");
      el.value = "*".repeat(el.value.length);
    }
    // Mask any visible text content in case the field mirrors value elsewhere
    if (typeof el.innerText === "string" && el.innerText.trim().length > 0) {
      el.innerText = "*".repeat(el.innerText.length);
    }
    return;
  }

  // 2) Mask media (img, video, canvas, or background-image)
  const style = getComputedStyle(el);
  const isMedia =
    el.tagName === "IMG" ||
    el.tagName === "VIDEO" ||
    el.tagName === "CANVAS" ||
    style.backgroundImage !== "none";

  if (isMedia) {
    // Preserve layout but obscure content
    el.style.filter = "blur(18px)";
    el.style.opacity = "0.15";
    el.style.pointerEvents = "none";
    if (el.tagName === "IMG") el.setAttribute("alt", ""); // avoid alt leaks
    return;
  }

  // 3) If it has visible text, mask by same-length asterisks
  const hasText = typeof el.innerText === "string" && el.innerText.trim().length > 0;
  if (hasText) {
    el.innerText = "*".repeat(el.innerText.length);
    return;
  }

  // 4) Fallback: add a dark overlay to cover any remaining visible content
  const rect = el.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0 && style.position === "static") {
    el.style.position = "relative";
  }
  if (!el.querySelector(":scope > .__pii_mask_overlay__")) {
    const overlay = document.createElement("div");
    overlay.className = "__pii_mask_overlay__";
    Object.assign(overlay.style, {
      position: "absolute",
      inset: "0",
      background: "rgba(0,0,0,0.6)",
      zIndex: "99999",
      pointerEvents: "none",
    });
    el.appendChild(overlay);
  }
}

function replaceElement(el, replacement) {
  if (!el) return;

  const replacementText = typeof replacement === "string" ? replacement : "";
  const isFormField = el.tagName === "INPUT" || el.tagName === "TEXTAREA";

  if (isFormField) {
    if (el.type !== "password") {
      el.value = replacementText;
      el.removeAttribute("data-pii-masked");
    }
    if (typeof el.innerText === "string") {
      el.innerText = replacementText;
    }
    return;
  }

  const overlay = el.querySelector(":scope > .__pii_mask_overlay__");
  if (overlay) overlay.remove();

  el.style.filter = "";
  el.style.opacity = "";
  el.style.pointerEvents = "";

  if (el.tagName === "IMG") {
    el.setAttribute("alt", replacementText || "");
  }

  if (typeof el.innerText === "string" && el.innerText.trim().length > 0) {
    el.innerText = replacementText;
  } else if (replacementText) {
    el.textContent = replacementText;
  }
}

// Apply masking or replacement to elements that match CSS selectors
function applySelectors(targets, mode, root = document) {
  for (const t of targets) {
    if (t.type !== "CSS" || !t.value) continue;

    const elements = safeQuerySelectorAll(root, t.value);

    elements.forEach((el) => {
      if (mode === "replace") {
        replaceElement(el, t.replacement);
      } else {
        maskElement(el);
      }
    });
  }
}

// Walk DOM from a root and process text nodes + targeted selectors
function walkAndApply(targets, mode, root = document) {
  const base = root.body || root;
  if (!base) return;

  // Text nodes
  const walker = document.createTreeWalker(base, NodeFilter.SHOW_TEXT, null, false);
  let node;
  while ((node = walker.nextNode())) {
    applyToTextNode(node, targets, mode);
  }

  // CSS selector targets
  applySelectors(targets, mode, root);
}

// Observe DOM changes and re-apply logic
function observeMutations(targets, mode, root = document) {
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "childList") {
        // New nodes added to the DOM
        m.addedNodes.forEach((n) => {
          if (n.nodeType === Node.TEXT_NODE) {
            applyToTextNode(n, targets, mode);
          } else if (n.nodeType === Node.ELEMENT_NODE) {
            walkAndApply(targets, mode, n);
          }
        });
      } else if (m.type === "attributes") {
        // Attributes changed (e.g., src/class/style/value) — re-process this element
        const el = m.target;
        if (el) walkAndApply(targets, mode, el);
      }
    }
  });

  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "style", "class", "value"], // broad but safe
  });
}

// Recursively traverse shadow DOMs (common in modern frameworks)
function processShadowRoots(root, targets, mode) {
  if (!root) return;

  if (root.shadowRoot) {
    walkAndApply(targets, mode, root.shadowRoot);
    observeMutations(targets, mode, root.shadowRoot);
  }

  // Find nested shadow roots
  const all = root.querySelectorAll ? root.querySelectorAll("*") : [];
  all.forEach((el) => {
    if (el.shadowRoot) processShadowRoots(el, targets, mode);
  });
}

function normalizeUrlForMatch(raw) {
  if (!raw) return null;
  try {
    const parsed = new URL(raw, window.location.origin);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    let pathname = parsed.pathname || '/';
    if (pathname !== '/') {
      pathname = pathname.replace(/\/+$/, '');
    } else {
      pathname = '';
    }
    return `${parsed.origin}${pathname}`;
  } catch (err) {
    return null;
  }
}

function pageMatchesSavedUrls(urls) {
  if (!Array.isArray(urls) || urls.length === 0) return false;
  const current = normalizeUrlForMatch(window.location.href);
  if (!current) return false;

  return urls.some((stored) => {
    const normalized = normalizeUrlForMatch(stored);
    if (!normalized) return false;
    if (current === normalized) return true;
    return current.startsWith(`${normalized}/`);
  });
}

// Initialize: run on main doc, shadow DOMs, and iframes
chrome.storage.sync.get(["entries", "active", "mode", "urls"], (data) => {
  if (!data || !data.active || !data.entries || data.entries.length === 0) return;
  if (!pageMatchesSavedUrls(data.urls)) return;

  const mode = data.mode === "replace" ? "replace" : "mask";
  const targets = data.entries
    .filter((entry) => entry && entry.value)
    .map((entry) => ({
      type: entry.type === "CSS" ? "CSS" : "Text",
      value: entry.value,
      replacement: entry.replacement || "",
    }));

  if (targets.length === 0) return;

  // 1) Main document
  try {
    walkAndApply(targets, mode, document);
    observeMutations(targets, mode, document);
    processShadowRoots(document, targets, mode);
  } catch (e) {
    console.warn("Processing failed on main document:", e);
  }

  // 2) Same-origin iframes
  try {
    const iframes = document.querySelectorAll("iframe");
    iframes.forEach((iframe) => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          walkAndApply(targets, mode, doc);
          observeMutations(targets, mode, doc);
          processShadowRoots(doc, targets, mode);
        }
      } catch (err) {
        // Cross-origin iframes will throw; that's expected.
      }
    });
  } catch (e) {
    console.warn("Iframe processing error:", e);
  }
});
