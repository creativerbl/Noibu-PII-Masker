const entriesDiv = document.getElementById('entries');
const addEntryBtn = document.getElementById('addEntry');
const statusEl = document.getElementById('status');
const toggleOn = document.getElementById('toggleOn');
const toggleOff = document.getElementById('toggleOff');
const modeInputs = document.querySelectorAll('input[name="mode"]');

let currentActive = false;
let currentMode = 'mask';

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

  const update = { entries, active: currentActive, mode: currentMode };

  chrome.storage.sync.set(update, updateStatus);
}

function loadEntries() {
  chrome.storage.sync.get(['entries', 'active', 'mode'], (data) => {
    entriesDiv.innerHTML = '';

    currentActive = Boolean(data.active);
    currentMode = data.mode === 'replace' ? 'replace' : 'mask';

    modeInputs.forEach((input) => {
      input.checked = input.value === currentMode;
    });

    (data.entries || []).forEach(e => createEntry(e.type, e.value, e.replacement));

    updateStatus();
    refreshReplacementVisibility();
  });
}

/** ---------- UI Row Builder (safe; no interpolation of value) ---------- **/

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
