// Checklist tas siaga dengan progres tersimpan di localStorage.
const STORAGE_KEY = "firewatch:checklist:v1";

export function initChecklist() {
  const list = document.getElementById("checklist-list");
  if (!list) return;

  const boxes = [...list.querySelectorAll('input[type="checkbox"]')];
  const progress = document.getElementById("checklist-progress");
  const saved = read();

  boxes.forEach((box) => {
    box.checked = Boolean(saved[box.dataset.key]);
    box.addEventListener("change", () => {
      write(boxes);
      update(boxes, progress);
    });
  });

  document.getElementById("checklist-reset")?.addEventListener("click", () => {
    boxes.forEach((box) => {
      box.checked = false;
    });
    write(boxes);
    update(boxes, progress);
  });

  update(boxes, progress);
}

function update(boxes, progress) {
  if (!progress) return;
  const done = boxes.filter((box) => box.checked).length;
  progress.textContent = `${done}/${boxes.length} siap`;
}

function read() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function write(boxes) {
  try {
    const data = {};
    boxes.forEach((box) => {
      data[box.dataset.key] = box.checked;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Abaikan bila storage tidak tersedia.
  }
}
