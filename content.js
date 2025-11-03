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

// Replace matching text in a text node with same-length asterisks
function maskTextNode(node, targets) {
  if (!node || node.nodeType !== Node.TEXT_NODE) return;

  let text = node.textContent;
  if (!text) return;

  for (const t of targets) {
    if (t.type === "Text" && t.value) {
      try {
        const regex = new RegExp(t.value, "gi"); // partial, case-insensitive
        text = text.replace(regex, (match) => "*".repeat(match.length));
      } catch (err) {
        console.warn("Invalid text pattern skipped:", t.value);
      }
    }
  }

  if (text !== node.textContent) {
    node.textContent = text;
  }
}

// Apply masking to elements that match CSS selectors
function maskSelectors(targets, root = document) {
  for (const t of targets) {
    if (t.type !== "CSS" || !t.value) continue;

    const elements = safeQuerySelectorAll(root, t.value);

    elements.forEach((el) => {
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
    });
  }
}

// Walk DOM from a root and mask text nodes + targeted selectors
function walkAndMask(targets, root = document) {
  const base = root.body || root;
  if (!base) return;

  // Text nodes
  const walker = document.createTreeWalker(base, NodeFilter.SHOW_TEXT, null, false);
  let node;
  while ((node = walker.nextNode())) {
    maskTextNode(node, targets);
  }

  // CSS selector targets
  maskSelectors(targets, root);
}

// Observe DOM changes and re-apply masking
function observeMutations(targets, root = document) {
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "childList") {
        // New nodes added to the DOM
        m.addedNodes.forEach((n) => {
          if (n.nodeType === Node.TEXT_NODE) {
            maskTextNode(n, targets);
          } else if (n.nodeType === Node.ELEMENT_NODE) {
            walkAndMask(targets, n);
          }
        });
      } else if (m.type === "attributes") {
        // Attributes changed (e.g., src/class/style/value) — re-mask this element
        const el = m.target;
        if (el) walkAndMask(targets, el);
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
function processShadowRoots(root, targets) {
  if (!root) return;

  if (root.shadowRoot) {
    walkAndMask(targets, root.shadowRoot);
    observeMutations(targets, root.shadowRoot);
  }

  // Find nested shadow roots
  const all = root.querySelectorAll ? root.querySelectorAll("*") : [];
  all.forEach((el) => {
    if (el.shadowRoot) processShadowRoots(el, targets);
  });
}

// Initialize: run on main doc, shadow DOMs, and iframes
chrome.storage.sync.get(["entries", "active"], (data) => {
  if (!data || !data.active || !data.entries || data.entries.length === 0) return;

  const targets = data.entries;

  // 1) Main document
  try {
    walkAndMask(targets, document);
    observeMutations(targets, document);
    processShadowRoots(document, targets);
  } catch (e) {
    console.warn("Masking failed on main document:", e);
  }

  // 2) Same-origin iframes
  try {
    const iframes = document.querySelectorAll("iframe");
    iframes.forEach((iframe) => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          walkAndMask(targets, doc);
          observeMutations(targets, doc);
          processShadowRoots(doc, targets);
        }
      } catch (err) {
        // Cross-origin iframes will throw; that's expected.
      }
    });
  } catch (e) {
    console.warn("Iframe processing error:", e);
  }
});
