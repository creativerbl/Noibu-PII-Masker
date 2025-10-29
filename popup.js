const entriesDiv = document.getElementById('entries');
const addEntryBtn = document.getElementById('addEntry');
const statusEl = document.getElementById('status');
const toggleOn = document.getElementById('toggleOn');
const toggleOff = document.getElementById('toggleOff');

/** ---------- Helpers ---------- **/

function saveEntries(active = null) {
  const entries = Array.from(entriesDiv.querySelectorAll('.entry')).map(div => {
    const type = div.querySelector('select').value;
    const value = div.querySelector('input').value.trim();
    return { type, value };
  }).filter(e => e.value);

  const update = { entries };
  if (active !== null) update.active = active;

  chrome.storage.sync.set(update, () => {
    if (active !== null)
      statusEl.textContent = active ? '🟢 Masking Active' : '🔴 Masking Inactive';
  });
}

function createEntry(type = 'Text', value = '') {
  const div = document.createElement('div');
  div.className = 'entry';
  div.innerHTML = `
    <select>
      <option value="Text"${type === 'Text' ? ' selected' : ''}>Text</option>
      <option value="CSS"${type === 'CSS' ? ' selected' : ''}>CSS</option>
    </select>
    <input type="text" value="${value}" placeholder="Enter text or selector">
    <button class="removeBtn">–</button>
  `;

  const select = div.querySelector('select');
  const input = div.querySelector('input');
  const removeBtn = div.querySelector('.removeBtn');

  // Auto-save on type or value change
  select.addEventListener('change', () => saveEntries());
  input.addEventListener('input', () => saveEntries());

  // Remove entry and auto-save
  removeBtn.addEventListener('click', () => {
    div.remove();
    saveEntries();
  });

  entriesDiv.appendChild(div);
}

/** ---------- Event Handlers ---------- **/

addEntryBtn.addEventListener('click', () => {
  createEntry();
  saveEntries();
});

toggleOn.addEventListener('click', () => saveEntries(true));
toggleOff.addEventListener('click', () => saveEntries(false));

function loadEntries() {
  chrome.storage.sync.get(['entries', 'active'], (data) => {
    entriesDiv.innerHTML = '';
    (data.entries || []).forEach(e => createEntry(e.type, e.value));
    statusEl.textContent = data.active ? '🟢 Masking Active' : '🔴 Masking Inactive';
  });
}

/** ---------- Init ---------- **/
loadEntries();
