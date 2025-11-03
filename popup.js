const entriesDiv = document.getElementById('entries');
const addEntryBtn = document.getElementById('addEntry');
const statusEl = document.getElementById('status');
const toggleOn = document.getElementById('toggleOn');
const toggleOff = document.getElementById('toggleOff');

/** ---------- Save / Load ---------- **/

function saveEntries(active = null) {
  const entries = Array.from(entriesDiv.querySelectorAll('.entry')).map(div => {
    const type = div.querySelector('select').value;
    const value = div.querySelector('.value').value;   // DO NOT trim; preserve quotes
    return { type, value };
  }).filter(e => e.value !== ""); // keep empty rows out but don't alter content

  const update = { entries };
  if (active !== null) update.active = active;

  chrome.storage.sync.set(update, () => {
    if (active !== null) {
      statusEl.textContent = active ? '🟢 Masking Active' : '🔴 Masking Inactive';
    }
  });
}

function loadEntries() {
  chrome.storage.sync.get(['entries', 'active'], (data) => {
    entriesDiv.innerHTML = '';
    (data.entries || []).forEach(e => createEntry(e.type, e.value));
    statusEl.textContent = data.active ? '🟢 Masking Active' : '🔴 Masking Inactive';
  });
}

/** ---------- UI Row Builder (safe; no interpolation of value) ---------- **/

function createEntry(type = 'Text', value = '') {
  const div = document.createElement('div');
  div.className = 'entry';

  // structure without inserting the value as HTML
  div.innerHTML = `
    <select>
      <option value="Text">Text</option>
      <option value="CSS">CSS</option>
    </select>
    <input class="value" type="text" placeholder="Enter text or selector">
    <button class="removeBtn">–</button>
  `;

  const select = div.querySelector('select');
  const input = div.querySelector('.value');
  const removeBtn = div.querySelector('.removeBtn');

  // set values programmatically (prevents truncation on quotes)
  select.value = (type === 'CSS' ? 'CSS' : 'Text');
  input.value = value || '';
  input.title = input.value; // tooltip shows full value

  // autosave on edit
  select.addEventListener('change', () => saveEntries());
  input.addEventListener('input', () => {
    input.title = input.value;
    saveEntries();
  });

  // remove & autosave
  removeBtn.addEventListener('click', () => {
    div.remove();
    saveEntries();
  });

  entriesDiv.appendChild(div);
}

/** ---------- Events ---------- **/

addEntryBtn.addEventListener('click', () => {
  createEntry();
  saveEntries();
});

toggleOn.addEventListener('click', () => saveEntries(true));
toggleOff.addEventListener('click', () => saveEntries(false));

/** ---------- Init ---------- **/
loadEntries();
