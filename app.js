const addForm = document.getElementById("addForm");
const taskInput = document.getElementById("taskInput");
const notesInput = document.getElementById("notesInput");

const priorityInput = document.getElementById("priorityInput");
const dueDateInput = document.getElementById("dueDateInput");
const sortSelect = document.getElementById("sortSelect");

const searchInput = document.getElementById("searchInput");
const filterButtons = document.querySelectorAll(".btn-filter");

const taskList = document.getElementById("taskList");
const taskCounter = document.getElementById("taskCounter");
const emptyState = document.getElementById("emptyState");

const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");
const importMode = document.getElementById("importMode");

let tasks = [];

let currentFilter = "all";
let currentSearch = "";

let editingTaskId = null;

let currentSort = "newest";

const STORAGE_KEY = "four_big_guys";

function saveTasksToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function loadTasksFromStorage() {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) return;

    try {
        tasks = JSON.parse(saved);

        tasks.forEach((task) => {
            if (typeof task.notes !== "string") task.notes = "";
        });

        tasks.forEach((task) => {
            if (typeof task.priority !== "string") task.priority = "medium";
        });

        tasks.forEach((task) => {
            if (typeof task.dueDate !== "string") task.dueDate = "";
        });
    } catch (err) {
        console.log("Could not read saved tasks. Resetting storage");
        tasks = [];
        saveTasksToStorage();
    }
}

function makeId() {
    return `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function cleanText(text) {
    return text.trim().replace(/\s+/g, " ");
}

function priorityRank(priority) {
    if (priority === "high") return 3;
    if (priority === "medium") return 2;
    return 1;
}

function dueValue(dueDateStr) {
    if (!dueDateStr) return Number.POSITIVE_INFINITY;
    return Number(dueDateStr.replaceAll("-", ""));
}

function getVisibleTasks() {
    let visible = [...tasks];

    if (currentFilter === "active") {
        visible = visible.filter((task) => task.completed === false);
    } else if (currentFilter === "completed") {
        visible = visible.filter((task) => task.completed === true);
    }

    if (currentSearch.length > 0) {
        const query = currentSearch.toLowerCase();
        visible = visible.filter((task) => 
            task.title.toLowerCase().includes(query) || 
            (task.notes || "").toLowerCase().includes(query));
    }

    if (currentSort === "newest") {
        visible.sort((a, b) => b.createdAt - a.createdAt);
    } else if (currentSort === "oldest") {
        visible.sort((a, b) => a.createdAt - b.createdAt);
    } else if (currentSort === "priority") {
        visible.sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority));
    } else if (currentSort === "dueSoon") {
        visible.sort((a, b) => dueValue(a.dueDate) - dueValue(b.dueDate));
    } else if (currentSort === "overdue") {
        visible.sort((a, b) => {
            const aOver = !a.completed && isOverdue(a.dueDate);
            const bOver = !b.completed && isOverdue(b.dueDate);

            if (aOver !== bOver) return bOver - aOver;

            const dueDiff = dueValue(a.dueDate) - dueValue(b.dueDate);
            if (dueDiff !== 0) return dueDiff;

            return b.createdAt - a.createdAt;
        });
    }

    return visible;
}

function addTask(titleText, notesText, priorityText, dueDateText) {
    const title = cleanText(titleText);
    const notes = (notesText || "").trim();
    const priority = (priorityText || "medium").trim().toLowerCase();
    const dueDate = (dueDateText || "").trim();

    if (title.length === 0) return;

    const newTask = {
        id: makeId(),
        title: title,
        notes: notes,
        priority: priority,
        dueDate: dueDate,
        completed: false,
        createdAt: Date.now()
    };

    tasks.unshift(newTask);
    saveTasksToStorage();
    render();
}

function toggleTaskCompleted(taskId) {
    const task = tasks.find((task) => task.id === taskId);
    if (!task) return;

    task.completed = !task.completed;

    saveTasksToStorage();
    render();
}

function deleteTask(taskId) {

    if (editingTaskId === taskId) {
        editingTaskId = null;
    }

    tasks = tasks.filter((task) => task.id !== taskId);

    saveTasksToStorage();
    render();
}

function startEditing(taskId) {
    editingTaskId = taskId;
    render();
}

function cancelEditing() {
    editingTaskId = null;
    render();
}

function saveEdit(taskId, newTitleText, newNotesText, newPriorityText, newDueDateText) {
    const newTitle = cleanText(newTitleText);
    const newNotes = (newNotesText || "").trim();
    const newPriority = (newPriorityText || "medium").trim().toLowerCase();
    const newDueDate = (newDueDateText || "").trim();

    if (newTitle.length === 0) return;

    const task = tasks.find((task) => task.id === taskId);
    if (!task) return;

    task.title = newTitle;
    task.notes = newNotes;
    task.priority = newPriority;
    task.dueDate = newDueDate;

    editingTaskId = null;
    saveTasksToStorage();
    render();
}

function isOverdue(dueDateStr) {
    if (!dueDateStr) return false;

    const today = new Date().toISOString().slice(0, 10);
    return dueDateStr < today;
}

function isValidTask(obj) {
    if (!obj || typeof obj !== "object") return false;

    if (typeof obj.id !== "string") return false;
    if (typeof obj.title !== "string") return false;

    if (obj.notes != null && typeof obj.notes !== "string") return false;
    if (obj.priority != null && typeof obj.priority !== "string") return false;
    if (obj.dueDate != null && typeof obj.dueDate !== "string") return false;
    if (obj.completed != null && typeof obj.completed !== "boolean") return false;

    return true;
}

function normalizeTask(task) {
    return {
        id: task.id,
        title: task.title,
        notes: typeof task.notes === "string" ? task.notes : "",
        priority: typeof task.priority === "string" ? task.priority : "medium",
        dueDate: typeof task.dueDate === "string" ? task.dueDate : "",
        completed: typeof task.completed === "boolean" ? task.completed : false,
        createdAt: typeof task.createdAt === "number" ? task.createdAt : Date.now(),
    }
}

function ensureUniqueIds(tasksToAdd, existingIds) {
    const result = [];

    for (const task of tasksToAdd) {
        let id = task.id;

        if (!id || existingIds.has(id)) {
            do {
                id = makeId();
            } while (existingIds.has(id));
        }

        existingIds.add(id);

        result.push({
            ...task,
            id: id
        });
    }

    return result;
}

function render() {
    const visibleTasks = getVisibleTasks();
    
    taskList.innerHTML = "";

    for (const task of visibleTasks) {
        const li = document.createElement("li");
        li.className = "task-item";
        li.dataset.id = task.id;

        if (task.completed) {
            li.classList.add("is-completed");
        }

        if (!task.completed && isOverdue(task.dueDate)) {
            li.classList.add("is-overdue");
        }

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = task.completed;

        checkbox.addEventListener("change", () => {
            toggleTaskCompleted(task.id);
        });
        
        li.appendChild(checkbox);

        if (editingTaskId === task.id) {
            const editInput = document.createElement("input");
            editInput.type = "text";
            editInput.className = "input task-edit-input"
            editInput.value = task.title;

            const saveBtn = document.createElement("button");
            saveBtn.type = "button";
            saveBtn.className = "task-action task-save";
            saveBtn.textContent = "Save";

            const cancelBtn = document.createElement("button");
            cancelBtn.type = "button";
            cancelBtn.className = "task-action task-cancel"
            cancelBtn.textContent = "Cancel";

            const notesEdit = document.createElement("textarea");
            notesEdit.className = "input textarea";
            notesEdit.rows = 3;
            notesEdit.value = task.notes || "";

            const prioritySelect = document.createElement("select");
            prioritySelect.className = "input";
            prioritySelect.innerHTML = `
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            `;
            prioritySelect.value = task.priority || "medium";

            const dueEdit = document.createElement("input");
            dueEdit.type = "date";
            dueEdit.className = "input";
            dueEdit.value = task.dueDate || "";

            saveBtn.addEventListener("click", () => {
                saveEdit(task.id, editInput.value, notesEdit.value, prioritySelect.value, dueEdit.value);
            });

            cancelBtn.addEventListener("click", () => {
                cancelEditing();
            });

            editInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    saveEdit(task.id, editInput.value, notesEdit.value, prioritySelect.value, dueEdit.value);
                } else if (e.key === "Escape") {
                    cancelEditing();
                }
            });

            notesEdit.addEventListener("keydown", (e) => {
                if (e.key === "Escape") {
                    cancelEditing();
                }
            });

            li.appendChild(editInput);
            li.appendChild(notesEdit);
            li.appendChild(prioritySelect);
            li.appendChild(dueEdit);

            const actions = document.createElement("div");
            actions.className = "task-actions";
            actions.appendChild(saveBtn);
            actions.appendChild(cancelBtn);
            li.appendChild(actions);

            setTimeout(() => editInput.focus(), 0);
        } else {
            const content = document.createElement("div");

            const title = document.createElement("span");
            title.className = "task-title";
            title.textContent = task.title;
            
            content.appendChild(title);

            if (task.notes && task.notes.trim().length > 0) {
                const notes = document.createElement("div");
                notes.className = "task-notes";
                notes.textContent = task.notes;
                content.appendChild(notes);
            }

            const meta = document.createElement("div");
            meta.className = "task-meta";

            const badge = document.createElement("span");
            badge.className = `priority-badge priority-${task.priority}`;
            badge.textContent = task.priority.toUpperCase();

            meta.appendChild(badge);
            content.appendChild(meta);

            if (task.dueDate) {
                const due = document.createElement("div");
                due.className = "due-date";
                due.textContent = `Due: ${task.dueDate}`;
                content.appendChild(due);
            }

            li.appendChild(content);

            const editBtn = document.createElement("button");
            editBtn.type = "button";
            editBtn.className = "task-action task-edit";
            editBtn.textContent = "Edit";

            const delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.className = "task-action task-delete";
            delBtn.textContent = "Delete";

            editBtn.addEventListener("click", () => {
                startEditing(task.id);
            });

            delBtn.addEventListener("click", () => {
                deleteTask(task.id);
            });

            const actions = document.createElement("div");
            actions.className = "task-actions";
            actions.appendChild(editBtn);
            actions.appendChild(delBtn);
            li.appendChild(actions);
        }

        taskList.appendChild(li);
    }

    const total = tasks.length;
    taskCounter.textContent = total === 1 ? "1 task" : `${total} tasks`;

    if (tasks.length === 0) {
        emptyState.style.display = "block";
        emptyState.innerHTML = `<p>No tasks yet. Add one above 👆</p>`;
    } else if (visibleTasks.length === 0) {
        emptyState.style.display = "block";
        emptyState.innerHTML = `<p>No tasks match your search/filter.</p>`;
    } else {
        emptyState.style.display = "none";
    }
}

addForm.addEventListener("submit", (e) => {
    e.preventDefault();

    addTask(taskInput.value, notesInput.value, priorityInput.value, dueDateInput.value);

    taskInput.value = "";
    notesInput.value = "";
    priorityInput.value = "medium";
    dueDateInput.value = "";
    taskInput.focus();
});

searchInput.addEventListener("input", () => {
    currentSearch = cleanText(searchInput.value);
    render();
});

for (const btn of filterButtons) {
    btn.addEventListener("click", () => {
        currentFilter = btn.dataset.filter;

        for (const other of filterButtons) {
            other.classList.remove("is-active");
        }
        btn.classList.add("is-active");

        render();
    });
}

if (sortSelect) {
    sortSelect.addEventListener("change", () => {
        currentSort = sortSelect.value;
        render();
    });
}
if (exportBtn) {
    exportBtn.addEventListener("click", () => {
        const data = JSON.stringify(tasks, null, 2);

        const blob = new Blob([data], {type: "application/json"});
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "taskhub-backup.json";
        a.click();

        URL.revokeObjectURL(url);
    }); 
}

if (importBtn && importFile) {
    importBtn.addEventListener("click", () => {
        importFile.click();
    });

    importFile.addEventListener("change", () => {
        const file = importFile.files[0]
        if (!file) return;

        const reader = new FileReader();

        reader.onload = () => {
            try {
                const parsed = JSON.parse(reader.result);

                if (!Array.isArray(parsed)) {
                    alert("Import failed: file must contain an array of tasks.");
                    return;
                }

                const cleaned = [];
                for (const task of parsed) {
                    if (!isValidTask(task)) {
                        alert("Import failed: invalid task format found.");
                        return;
                    }
                    cleaned.push(normalizeTask(task));
                }

                const mode = importMode ? importMode.value : "replace";

                if (mode === "replace" && tasks.length > 0) {
                    const ok = confirm("This will REPLACE ALL current tasks. Continue?");
                    if (!ok) return;
                }

                if (mode === "merge") {
                    const existingIds = new Set(tasks.map((task) => task.id));

                    const uniqueToAdd = ensureUniqueIds(cleaned, existingIds);

                    tasks = tasks.concat(uniqueToAdd);
                } else {
                    const existingIds = new Set();
                    const uniqueImported = ensureUniqueIds(cleaned, existingIds);

                    tasks = uniqueImported;
                }

                saveTasksToStorage();
                render();

                alert("Import successful!");
            } catch (err) {
                alert("Import failed: invalid JSON file.")
            } finally {
                importFile.value = "";
            }
        };

        reader.readAsText(file);
    });
}

loadTasksFromStorage();

if (sortSelect) {
    sortSelect.value = currentSort;
}

render();