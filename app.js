const TRACKS = [
  {
    title: "Ghost - Mary On A Cross",
    src: "audio/Ghost - Mary On A Cross.mp3",
  },
  {
    title: "Leonard Cohen - Famous Blue Raincoat",
    src: "audio/Leonard Cohen - Famous Blue Raincoat.mp3",
  },
  {
    title: "Yes - It Can Happen",
    src: "audio/Yes - It Can Happen.mp3",
  },
  {
    title: "The Cure - Lullaby",
    src: "audio/The Cure - Lullaby.mp3",
  },
];

const TASKS_KEY = "malu.todo.tasks.v3";
const FILTER_KEY = "malu.todo.filter.v3";
const SELECTED_DATE_KEY = "malu.todo.selectedDate.v1";
const AUDIO_KEY = "malu.todo.audio.v3";
const DELETED_DEFAULT_TASKS_KEY = "malu.todo.deletedDefaultTasks.v1";
const CLIMBING_TITLE = "Escalar com o Gabriel";
const CLIMBING_KIND = "climbing";
const CLIMBING_ICON_SRC = "assets/climbing-gabriel.png";

const memoryStore = new Map();

const store = {
  get(key, fallback = null) {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return memoryStore.get(key) ?? fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      memoryStore.set(key, value);
      announce(
        "Não consegui salvar no navegador; mantive por enquanto nesta sessão.",
      );
    }
  },
};

const state = {
  tasks: [],
  filter: normalizeSavedFilter(store.get(FILTER_KEY, "all")),
  selectedDate: normalizeSelectedDate(
    store.get(SELECTED_DATE_KEY, todayString()),
  ),
  editingId: null,
  lastFocusedElement: null,
  currentTrackIndex: -1,
  trackQueue: [],
  waitingForAudioGesture: false,
};

const elements = {
  todayLabel: document.querySelector("#todayLabel"),
  statusLine: document.querySelector("#statusLine"),
  quickAddForm: document.querySelector("#quickAddForm"),
  taskTitle: document.querySelector("#taskTitle"),
  taskDueDate: document.querySelector("#taskDueDate"),
  taskTime: document.querySelector("#taskTime"),
  filterHint: document.querySelector("#filterHint"),
  dayStrip: document.querySelector("#dayStrip"),
  filterButtons: [...document.querySelectorAll(".filter-button")],
  clearDoneButton: document.querySelector("#clearDoneButton"),
  taskList: document.querySelector("#taskList"),
  emptyState: document.querySelector("#emptyState"),
  totalCount: document.querySelector("#totalCount"),
  pendingCount: document.querySelector("#pendingCount"),
  doneCount: document.querySelector("#doneCount"),
  dailyNote: document.querySelector("#dailyNote"),
  audioPlayer: document.querySelector("#audioPlayer"),
  nowPlaying: document.querySelector("#nowPlaying"),
  editDialog: document.querySelector("#editDialog"),
  editForm: document.querySelector("#editForm"),
  editTitle: document.querySelector("#editTitle"),
  editDueDate: document.querySelector("#editDueDate"),
  editTime: document.querySelector("#editTime"),
  editCategory: document.querySelector("#editCategory"),
  editNotes: document.querySelector("#editNotes"),
  closeDialogButton: document.querySelector("#closeDialogButton"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  petalLayer: document.querySelector("#petalLayer"),
};

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const notes = [
  "Sem pressa, mas com carinho.",
  "Uma coisa pequena tambem conta.",
  "Feito e melhor que perfeito.",
  "Vai no seu ritmo.",
];

function normalizeSavedFilter(filter) {
  return ["all", "pending", "done"].includes(filter) ? filter : "all";
}

function normalizeSelectedDate(dateString) {
  if (!isValidDateString(dateString)) {
    return todayString();
  }

  const today = todayString();
  const firstDate = addDays(today, -1);
  const lastDate = addDays(today, 5);
  return dateString >= firstDate && dateString <= lastDate ? dateString : today;
}

function isValidDateString(dateString) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(dateString || ""));
}

function todayString() {
  return localDateString(new Date());
}

function addDays(dateString, amount) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);
  return localDateString(date);
}

function localDateString(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function friendlyToday() {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());
}

function formatDate(dateString) {
  if (!dateString) {
    return "sem data";
  }

  const [year, month, day] = dateString.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(year, month - 1, day));
}

function shortWeekday(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
  })
    .format(new Date(year, month - 1, day))
    .replace(".", "");
}

function dayNumber(dateString) {
  return String(Number(dateString.slice(-2)));
}

function loadTasks() {
  try {
    const parsed = JSON.parse(store.get(TASKS_KEY, "[]"));
    state.tasks = Array.isArray(parsed) ? parsed.map(normalizeTask) : [];
  } catch {
    state.tasks = [];
  }
}

function normalizeTask(task) {
  return {
    id: task.id || createId(),
    title: String(task.title || "").trim(),
    dueDate: task.dueDate || "",
    time: normalizeTime(task.time),
    priority: task.priority || "normal",
    category: task.category || "",
    kind: task.kind || "",
    recurrenceKey: task.recurrenceKey || "",
    notes: task.notes || "",
    completed: Boolean(task.completed),
    createdAt: task.createdAt || new Date().toISOString(),
    completedAt: task.completedAt || null,
    updatedAt: task.updatedAt || new Date().toISOString(),
  };
}

function saveTasks() {
  store.set(TASKS_KEY, JSON.stringify(state.tasks));
}

function readDeletedDefaultTasks() {
  try {
    const parsed = JSON.parse(store.get(DELETED_DEFAULT_TASKS_KEY, "[]"));
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveDeletedDefaultTasks(deletedKeys) {
  store.set(DELETED_DEFAULT_TASKS_KEY, JSON.stringify([...deletedKeys]));
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createTask(formData) {
  return {
    id: createId(),
    title: formData.get("title").trim(),
    dueDate: formData.get("dueDate") || "",
    time: normalizeTime(formData.get("time")),
    priority: "normal",
    category: "",
    kind: "",
    recurrenceKey: "",
    notes: "",
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeTime(value) {
  const time = String(value || "").trim();
  return /^\d{2}:\d{2}$/.test(time) ? time : "";
}

function ensureDefaultTasks() {
  const deletedDefaultTasks = readDeletedDefaultTasks();
  let changed = false;

  weekWindowDates().forEach((dateString) => {
    const defaultTask = defaultTaskForDate(dateString);
    if (!defaultTask) {
      return;
    }

    const alreadyExists = state.tasks.some(
      (task) => task.recurrenceKey === defaultTask.recurrenceKey,
    );
    if (!alreadyExists && !deletedDefaultTasks.has(defaultTask.recurrenceKey)) {
      state.tasks.push(defaultTask);
      changed = true;
    }
  });

  if (changed) {
    saveTasks();
  }
}

function defaultTaskForDate(dateString) {
  const day = weekdayIndex(dateString);
  if (day === 3) {
    return createDefaultClimbingTask(dateString, "19:30");
  }

  if (day === 6) {
    return createDefaultClimbingTask(dateString, "09:00");
  }

  return null;
}

function createDefaultClimbingTask(dateString, time) {
  const createdAt = new Date(`${dateString}T00:00:00`).toISOString();
  return {
    id: `climbing-${dateString}`,
    title: CLIMBING_TITLE,
    dueDate: dateString,
    time,
    priority: "normal",
    category: "escalada",
    kind: CLIMBING_KIND,
    recurrenceKey: `${CLIMBING_KIND}-${dateString}`,
    notes: "",
    completed: false,
    createdAt,
    completedAt: null,
    updatedAt: createdAt,
  };
}

function weekdayIndex(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}

function isOverdue(task) {
  return Boolean(
    task.dueDate && task.dueDate < todayString() && !task.completed,
  );
}

function belongsToDate(task, dateString) {
  return (
    task.dueDate === dateString ||
    (!task.dueDate && localDateString(task.createdAt) === dateString)
  );
}

function visibleTasks() {
  const sorted = [...state.tasks].sort((first, second) => {
    if (first.completed !== second.completed) {
      return Number(first.completed) - Number(second.completed);
    }

    const firstTime = first.time || "99:99";
    const secondTime = second.time || "99:99";
    if (firstTime !== secondTime) {
      return firstTime.localeCompare(secondTime);
    }

    return first.createdAt.localeCompare(second.createdAt);
  });

  return sorted
    .filter((task) => belongsToDate(task, state.selectedDate))
    .filter((task) => {
      if (state.filter === "pending") {
        return !task.completed;
      }

      if (state.filter === "done") {
        return task.completed;
      }

      return true;
    });
}

function render() {
  const tasks = visibleTasks();
  elements.taskList.replaceChildren();
  elements.emptyState.hidden = tasks.length > 0;
  elements.filterHint.textContent = dayFilterHint(tasks);

  const fragment = document.createDocumentFragment();
  tasks.forEach((task) => fragment.append(createTaskElement(task)));
  elements.taskList.append(fragment);

  renderDayStrip();
  renderFilters();
  renderSummary();
}

function weekWindowDates() {
  const today = todayString();
  return [-1, 0, 1, 2, 3, 4, 5].map((offset) => addDays(today, offset));
}

function renderDayStrip() {
  elements.dayStrip.replaceChildren();

  const fragment = document.createDocumentFragment();
  weekWindowDates().forEach((dateString, index) => {
    const tasksForDay = state.tasks.filter((task) =>
      belongsToDate(task, dateString),
    );
    const pendingCount = tasksForDay.filter((task) => !task.completed).length;
    const doneCount = tasksForDay.length - pendingCount;
    const isSelected = dateString === state.selectedDate;
    const button = document.createElement("button");
    button.className = "day-note";
    button.type = "button";
    button.dataset.date = dateString;
    button.classList.toggle("is-selected", isSelected);
    button.classList.toggle("has-pending", pendingCount > 0);
    button.classList.toggle(
      "all-done",
      tasksForDay.length > 0 && pendingCount === 0,
    );
    button.setAttribute("aria-pressed", String(isSelected));
    button.setAttribute(
      "aria-label",
      dayButtonLabel(dateString, tasksForDay.length, pendingCount),
    );

    const label = document.createElement("span");
    label.className = "day-note-label";
    label.textContent = relativeDayLabel(dateString);

    const number = document.createElement("span");
    number.className = "day-note-number";
    number.textContent = dayNumber(dateString);

    const weekday = document.createElement("span");
    weekday.className = "day-note-weekday";
    weekday.textContent = shortWeekday(dateString);

    const count = document.createElement("span");
    count.className = "day-note-count";
    count.textContent = dayCountLabel(
      tasksForDay.length,
      pendingCount,
      doneCount,
    );

    button.append(label, number, weekday, count);
    button.addEventListener("click", () => {
      state.selectedDate = dateString;
      store.set(SELECTED_DATE_KEY, state.selectedDate);
      render();
    });
    fragment.append(button);
  });

  elements.dayStrip.append(fragment);
}

function dayButtonLabel(dateString, total, pending) {
  const base = `${relativeDayLabel(dateString)}, ${formatDate(dateString)}`;
  if (!total) {
    return `${base}, nenhuma tarefa`;
  }

  return `${base}, ${total} ${total === 1 ? "tarefa" : "tarefas"}, ${pending} ${pending === 1 ? "pendente" : "pendentes"}`;
}

function relativeDayLabel(dateString) {
  const today = todayString();
  if (dateString === addDays(today, -1)) {
    return "Ontem";
  }

  if (dateString === today) {
    return "Hoje";
  }

  return shortWeekday(dateString);
}

function dayCountLabel(total, pending, done) {
  if (!total) {
    return "vazio";
  }

  if (!pending) {
    return `${done} feita${done === 1 ? "" : "s"}`;
  }

  return `${pending} pendente${pending === 1 ? "" : "s"}`;
}

function dayFilterHint(tasks) {
  const label = relativeDayLabel(state.selectedDate).toLowerCase();
  const dayText =
    label === "hoje" || label === "ontem"
      ? label
      : formatDate(state.selectedDate);
  if (!tasks.length && state.selectedDate === addDays(todayString(), -1)) {
    return "Nada ficou para tras nesse dia.";
  }

  if (!tasks.length) {
    return `Nada anotado para ${dayText}.`;
  }

  if (state.filter === "pending") {
    return `Pendentes para ${dayText}.`;
  }

  if (state.filter === "done") {
    return `Feitas em ${dayText}.`;
  }

  return `Tudo que esta no papel para ${dayText}.`;
}

function createTaskElement(task) {
  const item = document.createElement("li");
  item.className = "task-item";
  item.dataset.id = task.id;
  item.classList.toggle("is-done", task.completed);
  item.classList.toggle("is-overdue", isOverdue(task));
  item.classList.toggle("is-climbing", task.kind === CLIMBING_KIND);

  const checkbox = document.createElement("button");
  checkbox.className = "complete-button";
  checkbox.type = "button";
  checkbox.textContent = task.completed ? "ok" : "";
  checkbox.setAttribute("role", "checkbox");
  checkbox.setAttribute("aria-checked", String(task.completed));
  checkbox.setAttribute(
    "aria-label",
    task.completed
      ? `Reabrir ${task.title}`
      : `Marcar ${task.title} como feita`,
  );

  const copy = document.createElement("div");
  copy.className = "task-copy";

  const titleRow = document.createElement("div");
  titleRow.className = "task-title-row";

  if (task.kind === CLIMBING_KIND) {
    const icon = document.createElement("img");
    icon.className = "task-icon";
    icon.src = CLIMBING_ICON_SRC;
    icon.alt = "";
    icon.loading = "lazy";
    titleRow.append(icon);
  }

  const title = document.createElement("p");
  title.className = "task-title";
  title.textContent = task.title;
  titleRow.append(title);

  const meta = document.createElement("p");
  meta.className = "task-meta";
  meta.textContent = taskMeta(task);

  const tags = document.createElement("div");
  tags.className = "task-tags";

  if (task.category) {
    tags.append(createTag(task.category));
  }

  if (isOverdue(task)) {
    tags.append(createTag("vencida"));
  }

  const stamp = document.createElement("span");
  stamp.className = "stamp";
  stamp.textContent = "feito";
  tags.append(stamp);

  copy.append(titleRow, meta);

  if (task.notes) {
    const notes = document.createElement("p");
    notes.className = "task-notes";
    notes.textContent = task.notes;
    copy.append(notes);
  }

  copy.append(tags);

  const actions = document.createElement("div");
  actions.className = "task-actions";

  const editButton = document.createElement("button");
  editButton.className = "task-action";
  editButton.type = "button";
  editButton.textContent = "Editar";

  const deleteButton = document.createElement("button");
  deleteButton.className = "task-action delete";
  deleteButton.type = "button";
  deleteButton.textContent = "Apagar";

  checkbox.addEventListener("click", () => toggleTask(task.id, item, checkbox));
  editButton.addEventListener("click", () =>
    openEditDialog(task.id, editButton),
  );
  deleteButton.addEventListener("click", () => deleteTask(task.id));

  actions.append(editButton, deleteButton);
  item.append(checkbox, copy, actions);
  return item;
}

function createTag(text) {
  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent = text;
  return tag;
}

function taskMeta(task) {
  const pieces = [`data: ${formatDate(task.dueDate)}`];
  if (task.time) {
    pieces.push(`horario: ${task.time}`);
  }

  if (task.completedAt) {
    pieces.push(`feito em ${formatDate(localDateString(task.completedAt))}`);
  }

  return pieces.join(" | ");
}

function renderFilters() {
  elements.filterButtons.forEach((button) => {
    const active = button.dataset.filter === state.filter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderSummary() {
  const total = state.tasks.length;
  const done = state.tasks.filter((task) => task.completed).length;
  const pending = total - done;
  elements.totalCount.textContent = String(total);
  elements.pendingCount.textContent = String(pending);
  elements.doneCount.textContent = String(done);
  elements.clearDoneButton.disabled = done === 0;
}

function announce(message) {
  elements.statusLine.textContent = message;
}

function toggleTask(id, item, checkbox) {
  const task = state.tasks.find((entry) => entry.id === id);
  if (!task) {
    return;
  }

  task.completed = !task.completed;
  task.completedAt = task.completed ? new Date().toISOString() : null;
  task.updatedAt = new Date().toISOString();
  saveTasks();

  if (task.completed) {
    item.classList.add("is-done", "did-pop");
    checkbox.textContent = "ok";
    checkbox.setAttribute("aria-checked", "true");
    checkbox.setAttribute("aria-label", `Reabrir ${task.title}`);
    renderSummary();
    celebrate(checkbox);
    announce("Feito. Um girassolzinho pra você.");
    window.setTimeout(render, 540);
  } else {
    announce("Tarefa voltou para o papelzinho.");
    render();
  }
}

function deleteTask(id) {
  const task = state.tasks.find((entry) => entry.id === id);
  if (!task) {
    return;
  }

  const confirmed = window.confirm(`Apagar "${task.title}"?`);
  if (!confirmed) {
    return;
  }

  state.tasks = state.tasks.filter((entry) => entry.id !== id);
  if (task.recurrenceKey) {
    const deletedDefaultTasks = readDeletedDefaultTasks();
    deletedDefaultTasks.add(task.recurrenceKey);
    saveDeletedDefaultTasks(deletedDefaultTasks);
  }
  saveTasks();
  announce("Tarefa apagada.");
  render();
}

function clearDone() {
  const count = state.tasks.filter((task) => task.completed).length;
  if (!count) {
    return;
  }

  const confirmed = window.confirm(
    `Limpar ${count} ${count === 1 ? "tarefa feita" : "tarefas feitas"}?`,
  );
  if (!confirmed) {
    return;
  }

  const deletedDefaultTasks = readDeletedDefaultTasks();
  state.tasks
    .filter((task) => task.completed && task.recurrenceKey)
    .forEach((task) => deletedDefaultTasks.add(task.recurrenceKey));
  saveDeletedDefaultTasks(deletedDefaultTasks);
  state.tasks = state.tasks.filter((task) => !task.completed);
  saveTasks();
  announce("Feitas limpas do papel.");
  render();
}

function openEditDialog(id, opener) {
  const task = state.tasks.find((entry) => entry.id === id);
  if (!task) {
    return;
  }

  state.editingId = id;
  state.lastFocusedElement = opener || document.activeElement;
  elements.editTitle.value = task.title;
  elements.editDueDate.value = task.dueDate;
  elements.editTime.value = task.time;
  elements.editCategory.value = task.category;
  elements.editNotes.value = task.notes;
  elements.editDialog.showModal();
  elements.editTitle.focus();
}

function closeEditDialog() {
  elements.editDialog.close();
  state.editingId = null;

  if (
    state.lastFocusedElement &&
    typeof state.lastFocusedElement.focus === "function"
  ) {
    state.lastFocusedElement.focus();
  }
}

function saveEditedTask() {
  const task = state.tasks.find((entry) => entry.id === state.editingId);
  if (!task) {
    closeEditDialog();
    return;
  }

  const title = elements.editTitle.value.trim();
  if (!title) {
    elements.editTitle.focus();
    return;
  }

  task.title = title;
  task.dueDate = elements.editDueDate.value;
  task.time = normalizeTime(elements.editTime.value);
  task.priority = "normal";
  task.category = elements.editCategory.value.trim();
  task.notes = elements.editNotes.value.trim();
  task.updatedAt = new Date().toISOString();
  saveTasks();
  closeEditDialog();
  announce("Tarefa atualizada.");
  render();
}

function trapDialogFocus(event) {
  if (event.key !== "Tab" || !elements.editDialog.open) {
    return;
  }

  const focusable = [
    ...elements.editDialog.querySelectorAll(focusableSelector),
  ];
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (!first || !last) {
    return;
  }

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function celebrate(origin) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const rect = origin.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  for (let index = 0; index < 9; index += 1) {
    const petal = document.createElement("span");
    const angle = (Math.PI * 2 * index) / 9;
    const distance = 28 + Math.random() * 34;
    petal.className = "petal";
    petal.style.left = `${centerX}px`;
    petal.style.top = `${centerY}px`;
    petal.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
    petal.style.setProperty("--y", `${Math.sin(angle) * distance}px`);
    petal.style.setProperty("--rotate", `${Math.random() * 180}deg`);
    elements.petalLayer.append(petal);
    window.setTimeout(() => petal.remove(), 760);
  }
}

function setupAudio() {
  const saved = readAudioSettings();
  if (typeof saved.volume === "number") {
    elements.audioPlayer.volume = saved.volume;
  }

  elements.audioPlayer.addEventListener("volumechange", persistAudioSettings);
  elements.audioPlayer.addEventListener("play", () => {
    const track = currentTrack();
    if (track) {
      elements.nowPlaying.textContent = `Tocando agora: ${track.title}`;
    }
  });
  elements.audioPlayer.addEventListener("pause", () => {
    const track = currentTrack();
    if (track) {
      elements.nowPlaying.textContent = `Pausada: ${track.title}`;
    }
  });
  elements.audioPlayer.addEventListener("ended", () => {
    playNextQueuedTrack({ announceChange: false });
  });
  elements.audioPlayer.addEventListener("error", () => {
    elements.nowPlaying.textContent = "Nao consegui tocar essa faixa.";
  });

  state.trackQueue = shuffledTrackIndexes();
  playNextQueuedTrack({ autoplay: true, announceChange: false });
  installAudioGestureFallback();
}

function currentTrack() {
  return TRACKS[state.currentTrackIndex] || null;
}

function shuffledTrackIndexes(avoidFirstIndex = -1) {
  const indexes = TRACKS.map((_, index) => index);

  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [indexes[index], indexes[swapIndex]] = [indexes[swapIndex], indexes[index]];
  }

  if (indexes.length > 1 && indexes[0] === avoidFirstIndex) {
    [indexes[0], indexes[1]] = [indexes[1], indexes[0]];
  }

  return indexes;
}

function playNextQueuedTrack({
  autoplay = true,
  announceChange = false,
} = {}) {
  if (!state.trackQueue.length) {
    state.trackQueue = shuffledTrackIndexes(state.currentTrackIndex);
  }

  const nextIndex = state.trackQueue.shift();
  selectTrack(nextIndex);

  if (announceChange) {
    announce("A vitrolinha sorteou outra faixa.");
  }

  if (autoplay) {
    attemptPlay();
  }
}

function selectTrack(index) {
  const track = TRACKS[index];
  if (!track) {
    elements.audioPlayer.removeAttribute("src");
    elements.nowPlaying.textContent =
      "Coloque arquivos mp3 na pasta audio e atualize a lista TRACKS.";
    return;
  }

  state.currentTrackIndex = index;
  elements.audioPlayer.src = track.src;
  elements.audioPlayer.load();
  elements.nowPlaying.textContent = `Sorteada agora: ${track.title}`;
  persistAudioSettings();
}

function attemptPlay() {
  const playPromise = elements.audioPlayer.play();
  if (!playPromise || typeof playPromise.catch !== "function") {
    return;
  }

  playPromise
    .then(() => {
      state.waitingForAudioGesture = false;
    })
    .catch(() => {
      state.waitingForAudioGesture = true;
      const track = currentTrack();
      elements.nowPlaying.textContent = track
        ? `Pronta para tocar: ${track.title}. Aperte play uma vez.`
        : "A vitrolinha esta pronta. Aperte play uma vez.";
    });
}

function installAudioGestureFallback() {
  const tryAfterGesture = () => {
    if (state.waitingForAudioGesture && elements.audioPlayer.paused) {
      attemptPlay();
    }
  };

  window.addEventListener("pointerdown", tryAfterGesture, { passive: true });
  window.addEventListener("keydown", tryAfterGesture);
}

function readAudioSettings() {
  try {
    return JSON.parse(store.get(AUDIO_KEY, "{}"));
  } catch {
    return {};
  }
}

function persistAudioSettings() {
  store.set(
    AUDIO_KEY,
    JSON.stringify({
      volume: elements.audioPlayer.volume,
    }),
  );
}

function setupDateAndNote() {
  const date = todayString();
  elements.todayLabel.dateTime = date;
  elements.todayLabel.textContent = friendlyToday();
  const daySeed = new Date().getDate() % notes.length;
  elements.dailyNote.textContent = notes[daySeed];
}

elements.quickAddForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(elements.quickAddForm);
  const title = String(formData.get("title") || "").trim();

  if (!title) {
    elements.taskTitle.focus();
    announce("Escreva uma tarefa primeiro.");
    return;
  }

  state.tasks.unshift(createTask(formData));
  saveTasks();
  elements.quickAddForm.reset();
  elements.taskTitle.focus();
  announce("Anotado no papelzinho.");
  render();
});

elements.filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    store.set(FILTER_KEY, state.filter);
    render();
  });
});

elements.clearDoneButton.addEventListener("click", clearDone);

elements.editForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveEditedTask();
});

elements.closeDialogButton.addEventListener("click", closeEditDialog);
elements.cancelEditButton.addEventListener("click", closeEditDialog);
elements.editDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeEditDialog();
});
elements.editDialog.addEventListener("keydown", trapDialogFocus);

setupDateAndNote();
loadTasks();
ensureDefaultTasks();
setupAudio();
render();
