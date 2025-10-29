function safeQuerySelectorAll(root, selector) {
  try {
    return root.querySelectorAll(selector);
  } catch (err) {
    console.warn('Invalid selector skipped:', selector);
    return [];
  }
}

function maskTextNode(node, targets) {
  let text = node.textContent;
  for (const t of targets) {
    if (t.type === "Text" && t.value) {
      const regex = new RegExp(t.value, "gi");
      text = text.replace(regex, (match) => "*".repeat(match.length));
    }
  }
  if (text !== node.textContent) {
    node.textContent = text;
  }
}

function maskSelectors(targets, root = document) {
  for (const t of targets) {
    if (t.type === "CSS" && t.value) {
      safeQuerySelectorAll(root, t.value).forEach((el) => {
        if (el && el.innerText) {
          el.innerText = "*".repeat(el.innerText.length);
        }
      });
    }
  }
}

function walkAndMask(targets, root = document) {
  const walker = document.createTreeWalker(root.body || root, NodeFilter.SHOW_TEXT, null, false);
  let node;
  while ((node = walker.nextNode())) {
    maskTextNode(node, targets);
  }
  maskSelectors(targets, root);
}

function observeMutations(targets, root = document) {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes) {
        mutation.addedNodes.forEach((n) => {
          if (n.nodeType === Node.TEXT_NODE) maskTextNode(n, targets);
          else if (n.nodeType === Node.ELEMENT_NODE) walkAndMask(targets, n);
        });
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true });
}

// Recursively traverse shadow DOMs
function processShadowRoots(root, targets) {
  if (root.shadowRoot) {
    walkAndMask(targets, root.shadowRoot);
    observeMutations(targets, root.shadowRoot);
  }
  root.querySelectorAll("*").forEach((el) => {
    if (el.shadowRoot) processShadowRoots(el, targets);
  });
}

chrome.storage.sync.get(["entries", "active"], (data) => {
  if (data.active && data.entries && data.entries.length > 0) {
    // Apply to main document
    walkAndMask(data.entries, document);
    observeMutations(data.entries, document);
    processShadowRoots(document, data.entries);

    // Apply inside iframes too
    document.querySelectorAll("iframe").forEach((iframe) => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        if (doc) {
          walkAndMask(data.entries, doc);
          observeMutations(data.entries, doc);
          processShadowRoots(doc, data.entries);
        }
      } catch (err) {
        // Ignore cross-origin iframes
      }
    });
  }
});
