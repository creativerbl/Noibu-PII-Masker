const entriesDiv = document.getElementById('entries');
const addEntryBtn = document.getElementById('addEntry');
const statusEl = document.getElementById('status');
const toggleOn = document.getElementById('toggleOn');
const toggleOff = document.getElementById('toggleOff');
const modeInputs = document.querySelectorAll('input[name="mode"]');
const urlInput = document.getElementById('urlInput');
const addUrlBtn = document.getElementById('addUrl');
const urlList = document.getElementById('urlList');
const urlError = document.getElementById('urlError');
const urlHint = document.getElementById('urlHint');

let currentActive = false;
let currentMode = 'mask';
let savedUrls = [];

function updateStatus() {
  const activeIcon = currentActive ? '🟢' : '🔴';
  const activeLabel = currentActive ? 'Protection Active' : 'Protection Inactive';
  const modeLabel = currentMode === 'replace' ? 'Replacement Mode' : 'Masking Mode';
  statusEl.textContent = `${activeIcon} ${activeLabel} • ${modeLabel}`;
}

/** ---------- Save / Load ---------- **/

function saveEntries(overrides = {}) {
  if (typeof overrides.active === 'boolean') {
    currentActive = overrides.active;
  }
  if (overrides.mode) {
    currentMode = overrides.mode;
  }

  const entries = Array.from(entriesDiv.querySelectorAll('.entry')).map(div => {
    const type = div.querySelector('select').value;
    const value = div.querySelector('.value').value;   // DO NOT trim; preserve quotes
    const replacementInput = div.querySelector('.replacement');
    const replacement = replacementInput ? replacementInput.value : '';
    return { type, value, replacement };
  }).filter(e => e.value !== ""); // keep empty rows out but don't alter content

  const update = { entries, active: currentActive, mode: currentMode, urls: savedUrls };

  chrome.storage.sync.set(update, updateStatus);
}

function loadEntries() {
  chrome.storage.sync.get(['entries', 'active', 'mode', 'urls'], (data) => {
    entriesDiv.innerHTML = '';

    currentActive = Boolean(data.active);
    currentMode = data.mode === 'replace' ? 'replace' : 'mask';
    savedUrls = Array.isArray(data.urls) ? data.urls.filter(Boolean) : [];
    setUrlError('');

    modeInputs.forEach((input) => {
      input.checked = input.value === currentMode;
    });

    (data.entries || []).forEach(e => createEntry(e.type, e.value, e.replacement));

    renderUrlList();
    updateAddEntryState();

    updateStatus();
    refreshReplacementVisibility();
  });
}

/** ---------- UI Row Builder (safe; no interpolation of value) ---------- **/

function normalizeUrlInput(raw) {
  if (!raw) return null;
  let candidate = raw.trim();
  if (!candidate) return null;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  try {
    const parsed = new URL(candidate);
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

function setUrlError(message = '') {
  if (!urlError) return;
  urlError.textContent = message;
}

function renderUrlList() {
  if (!urlList) return;
  urlList.innerHTML = '';

  if (!savedUrls.length) {
    const empty = document.createElement('p');
    empty.className = 'url-empty';
    empty.textContent = 'No URLs added yet.';
    urlList.appendChild(empty);
    return;
  }

  savedUrls.forEach((url) => {
    const item = document.createElement('div');
    item.className = 'url-item';

    const label = document.createElement('span');
    label.textContent = url;
    label.title = url;
    item.appendChild(label);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'removeUrl';
    remove.setAttribute('aria-label', `Remove ${url}`);
    remove.textContent = '✕';
    remove.addEventListener('click', () => {
      savedUrls = savedUrls.filter((u) => u !== url);
      renderUrlList();
      updateAddEntryState();
      saveEntries();
    });

    item.appendChild(remove);
    urlList.appendChild(item);
  });
}

function updateAddEntryState() {
  const disabled = savedUrls.length === 0;
  addEntryBtn.disabled = disabled;
  addEntryBtn.classList.toggle('disabled', disabled);
  if (urlHint) {
    urlHint.style.color = disabled ? '#b45309' : '#475569';
    urlHint.style.fontWeight = disabled ? '600' : '400';
  }
}

function syncPlaceholders(selectEl, valueInput) {
  if (!selectEl || !valueInput) return;
  if (selectEl.value === 'CSS') {
    valueInput.placeholder = 'Enter CSS selector';
  } else if (currentMode === 'replace') {
    valueInput.placeholder = 'Text or pattern to replace';
  } else {
    valueInput.placeholder = 'Text or pattern to mask';
  }
}

function createEntry(type = 'Text', value = '', replacement = '') {
  const div = document.createElement('div');
  div.className = 'entry';

  // structure without inserting the value as HTML
  div.innerHTML = `
    <select>
      <option value="Text">Text</option>
      <option value="CSS">CSS</option>
    </select>
    <input class="value" type="text" placeholder="Enter text or selector">
    <input class="replacement" type="text" placeholder="Replacement text (optional)">
    <button class="removeBtn">–</button>
  `;

  const select = div.querySelector('select');
  const input = div.querySelector('.value');
  const removeBtn = div.querySelector('.removeBtn');
  const replacementInput = div.querySelector('.replacement');

  // set values programmatically (prevents truncation on quotes)
  select.value = (type === 'CSS' ? 'CSS' : 'Text');
  input.value = value || '';
  input.title = input.value; // tooltip shows full value
  if (replacementInput) {
    replacementInput.value = replacement || '';
    replacementInput.title = replacementInput.value;
  }

  syncPlaceholders(select, input);

  // autosave on edit
  select.addEventListener('change', () => {
    syncPlaceholders(select, input);
    refreshReplacementVisibility();
    saveEntries();
  });
  input.addEventListener('input', () => {
    input.title = input.value;
    saveEntries();
  });
  if (replacementInput) {
    replacementInput.addEventListener('input', () => {
      replacementInput.title = replacementInput.value;
      saveEntries();
    });
  }

  // remove & autosave
  removeBtn.addEventListener('click', () => {
    div.remove();
    saveEntries();
  });

  entriesDiv.appendChild(div);
  refreshReplacementVisibility();
}

function refreshReplacementVisibility() {
  const showReplacement = currentMode === 'replace';
  entriesDiv.querySelectorAll('.entry').forEach((entry) => {
    const select = entry.querySelector('select');
    const replacementInput = entry.querySelector('.replacement');
    const valueInput = entry.querySelector('.value');
    if (select && valueInput) {
      syncPlaceholders(select, valueInput);
    }
    if (!replacementInput || !select) return;
    const shouldShow = showReplacement && select.value === 'Text';
    replacementInput.classList.toggle('hidden', !shouldShow);
    replacementInput.disabled = !shouldShow;
  });
}

/** ---------- Events ---------- **/

addEntryBtn.addEventListener('click', () => {
  createEntry();
  saveEntries();
});

addUrlBtn.addEventListener('click', () => {
  const normalized = normalizeUrlInput(urlInput.value);
  if (!normalized) {
    setUrlError('Enter a valid http(s) URL.');
    return;
  }
  if (savedUrls.includes(normalized)) {
    setUrlError('URL already added.');
    return;
  }
  savedUrls.push(normalized);
  urlInput.value = '';
  setUrlError('');
  renderUrlList();
  updateAddEntryState();
  saveEntries();
});

urlInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    addUrlBtn.click();
  }
});

toggleOn.addEventListener('click', () => saveEntries({ active: true }));
toggleOff.addEventListener('click', () => saveEntries({ active: false }));

modeInputs.forEach((input) => {
  input.addEventListener('change', () => {
    if (!input.checked) return;
    saveEntries({ mode: input.value });
    refreshReplacementVisibility();
  });
});

/** ---------- Init ---------- **/
loadEntries();
