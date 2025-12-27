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
const clearCompletedBtn = document.getElementById("clearCompletedBtn");

const importFile = document.getElementById("importFile");
const importMode = document.getElementById("importMode");

const manualHint = document.getElementById("manualHint");

let tasks = [];

let currentFilter = "all";
let currentSearch = "";

let editingTaskId = null;

let currentSort = "newest";

let editingDraft = null;

let draggingId = null;

function renumberManualOrder() {
    for (let i = 0; i < tasks.length; i++) {
        tasks[i].order = (i + 1) * 1000;
    }
}

const STORAGE_KEY = "four_big_guys";

function saveTasksToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function loadTasksFromStorage() {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) return;

    try {
        const parsed = JSON.parse(saved);

        if (!Array.isArray(parsed)) {
            tasks = [];
            saveTasksToStorage();
            return;
        }

        tasks = parsed.map((task) => normalizeTask(task));
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

    switch (currentSort) {
        case "manual":
            visible.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            break;

        case "newest":
            visible.sort((a, b) => b.createdAt - a.createdAt);
            break;

        case "oldest":
            visible.sort((a, b) => a.createdAt - b.createdAt);
            break;

        case "priority":
            visible.sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority));
            break;

        case "dueSoon":
            visible.sort((a, b) => dueValue(a.dueDate) - dueValue(b.dueDate));
            break;

        case "overdue":
            visible.sort((a, b) => {
                const aOver = !a.completed && isOverdue(a.dueDate);
                const bOver = !b.completed && isOverdue(b.dueDate);

                if (aOver !== bOver) return bOver - aOver;

                const dueDiff = dueValue(a.dueDate) - dueValue(b.dueDate);
                if (dueDiff !== 0) return dueDiff;

                return b.createdAt - a.createdAt;
            });
            break;

        default:
            break;
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
        createdAt: Date.now(),
        order: Date.now()
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
    const task = tasks.find((task) => task.id === taskId);
    if (!task) return;

    const ok = confirmDeleteTask(task);
    if (!ok) return;

    if (editingTaskId === taskId) {
        editingTaskId = null;
    }

    tasks = tasks.filter((task) => task.id !== taskId);

    saveTasksToStorage();
    render();
}

function confirmDeleteTask(task) {
    const title = (task.title || "").trim();
    const label = title.length > 0 ? `"${title}"` : "this task";
    return confirm(`Delete ${label}? This cannot be undone.`);
}

function startEditing(taskId) {
    editingTaskId = taskId;
    editingDraft = null;
    render();
}

function cancelEditing() {
    editingTaskId = null;
    editingDraft = null;
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
    editingDraft = null;
    saveTasksToStorage();
    render();
}

function clearCompleted() {
    const completedCount = tasks.filter((task) => task.completed).length;

    if (completedCount === 0 ) return;

    const ok = confirm(`Delete ${completedCount} completed task(s)? This cannot be undone.`);
    if (!ok) return;

    tasks = tasks.filter((task) => task.completed === false);

    if (editingTaskId) {
        const stillExists = tasks.some((task) => task.id === editingTaskId);
        if (!stillExists) editingTaskId = null;
    }

    saveTasksToStorage();
    render();
}

function isOverdue(dueDateStr) {
    if (!dueDateStr) return false;

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const today = `${year}-${month}-${day}`;

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
        id: typeof task.id === "string" ? task.id : makeId(),
        title: typeof task.title === "string" ? task.title : "Untitled task",
        notes: typeof task.notes === "string" ? task.notes : "",
        priority: typeof task.priority === "string" ? task.priority : "medium",
        dueDate: typeof task.dueDate === "string" ? task.dueDate : "",
        completed: typeof task.completed === "boolean" ? task.completed : false,
        createdAt: typeof task.createdAt === "number" ? task.createdAt : Date.now(),
        order: typeof task.order === "number" ? task.order : Date.now(),
    };
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

function isMac() {
    return navigator.platform.toLowerCase().includes("mac");
}

function isTypingInInput(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

function focusSearch() {
    if (!searchInput) return;
    searchInput.focus();
    searchInput.select?.();
}

function focusNewTask() {
    if (!taskInput) return;
    taskInput.focus();
    taskInput.select?.();
}

function moveTaskById(taskId, beforeTaskId) {
    tasks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const fromIndex = tasks.findIndex((task) => task.id === taskId);
    if (fromIndex === -1) return;

    const [moved] = tasks.splice(fromIndex, 1);

    if (!beforeTaskId) {
        tasks.push(moved);
    } else {
        const toIndex = tasks.findIndex((task) => task.id === beforeTaskId);
        if (toIndex === -1) {
            tasks.push(moved);
        } else {
            tasks.splice(toIndex, 0, moved);
        }
    }

    renumberManualOrder();
    saveTasksToStorage();
    render();
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

        checkbox.setAttribute("aria-label", `Mark "${task.title}" as ${task.completed ? "not completed" : "completed"}`);
        
        li.appendChild(checkbox);

        if (editingTaskId === task.id) {
            const editInput = document.createElement("input");
            editInput.type = "text";
            editInput.className = "input task-edit-input"
            editInput.value = task.title;

            editInput.setAttribute("aria-label", "Edit task title");

            const saveBtn = document.createElement("button");
            saveBtn.type = "button";
            saveBtn.className = "task-action task-save";
            saveBtn.textContent = "Save";

            saveBtn.setAttribute("aria-label", `Save changes for "${task.title}"`);

            const cancelBtn = document.createElement("button");
            cancelBtn.type = "button";
            cancelBtn.className = "task-action task-cancel"
            cancelBtn.textContent = "Cancel";

            cancelBtn.setAttribute("aria-label", `Cancel editing "${task.title}"`);

            const notesEdit = document.createElement("textarea");
            notesEdit.className = "input textarea";
            notesEdit.rows = 3;
            notesEdit.value = task.notes || "";

            notesEdit.setAttribute("aria-label", "Edit task notes");

            const prioritySelect = document.createElement("select");
            prioritySelect.className = "input";
            prioritySelect.innerHTML = `
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            `;
            prioritySelect.value = task.priority || "medium";

            prioritySelect.setAttribute("aria-label", "Edit task priority");

            const dueEdit = document.createElement("input");
            dueEdit.type = "date";
            dueEdit.className = "input";
            dueEdit.value = task.dueDate || "";

            dueEdit.setAttribute("aria-label", "Edit task due date");

            editingDraft = {
                title: editInput.value,
                notes: notesEdit.value,
                priority: prioritySelect.value,
                dueDate: dueEdit.value
            };

            const actions = document.createElement("div");
            actions.className = "task-actions";
            actions.appendChild(saveBtn);
            actions.appendChild(cancelBtn);

            saveBtn.addEventListener("click", () => {
                saveEdit(task.id, editInput.value, notesEdit.value, prioritySelect.value, dueEdit.value);
            });

            cancelBtn.addEventListener("click", () => {
                cancelEditing();
            });

            editInput.addEventListener("input", () => {
                if (!editingDraft) editingDraft = {};
                editingDraft.title = editInput.value;
            });

            notesEdit.addEventListener("input", () => {
                if (!editingDraft) editingDraft = {};
                editingDraft.notes = notesEdit.value;
            });

            prioritySelect.addEventListener("change", () => {
                if (!editingDraft) editingDraft = {};
                editingDraft.priority = prioritySelect.value;
            });

            dueEdit.addEventListener("change", () => {
                if (!editingDraft) editingDraft = {};
                editingDraft.dueDate = dueEdit.value;
            });

            const panel = document.createElement("div");
            panel.className = "task-edit-panel";

            const row = document.createElement("div");
            row.className = "task-edit-row";

            row.appendChild(prioritySelect);
            row.appendChild(dueEdit);

            panel.appendChild(editInput);
            panel.appendChild(notesEdit);
            panel.appendChild(row);

            li.appendChild(panel);
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

            editBtn.setAttribute("aria-label", `Edit "${task.title}"`);

            const delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.className = "task-action task-delete";
            delBtn.textContent = "Delete";

            delBtn.setAttribute("aria-label", `Delete "${task.title}"`);

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

            const manualMode = currentSort === "manual";
            li.draggable = manualMode && editingTaskId !== task.id;
            li.classList.toggle("is-draggable", li.draggable);

            if (li.draggable) {
                li.addEventListener("dragstart", (e) => {
                    e.dataTransfer.setData("text/plain", task.id);
                    e.dataTransfer.effectAllowed = "move";
                    li.classList.add("is-dragging");
                });

                li.addEventListener("dragend", () => {
                    li.classList.remove("is-dragging");
                    document.querySelectorAll(".task-item.is-drop-target")
                        .forEach((el) => el.classList.remove("is-drop-target"));
                });

                li.addEventListener("dragover", (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";

                    li.classList.add("is-drop-target");
                });

                li.addEventListener("dragleave", () => {
                    li.classList.remove("is-drop-target");
                });

                li.addEventListener("drop", (e) => {
                    e.preventDefault();
                    li.classList.remove("is-drop-target");

                    const draggedId = e.dataTransfer.getData("text/plain");
                    if (!draggedId || draggedId === task.id) return;

                    moveTaskById(draggedId, task.id);
                });
            }
        }

        taskList.appendChild(li);
    }

    const total = tasks.length;
    taskCounter.textContent = total === 1 ? "1 task" : `${total} tasks`;

    if (clearCompletedBtn) {
        const hasCompleted = tasks.some((task) => task.completed);
        clearCompletedBtn.style.display = hasCompleted ? "inline-flex" : "none";
    }

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

taskList.addEventListener("dragover", (e) => {
    if (currentSort !== "manual") return;
    e.preventDefault();
});

taskList.addEventListener("drop", (e) => {
    if (currentSort !== "manual") return;
    e.preventDefault();

    const draggedId = e.dataTransfer.getData("text/plain");
    if (!draggedId) return;

    const droppedOnTask = e.target.closest(".task-item");
    if (!droppedOnTask) {
        moveTaskById(draggedId, null);
    }
});

function wireEvents() {
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
            importFile.value = "";
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

    if (sortSelect) {
        sortSelect.value = currentSort;

        function updateManualHint() {
            if (!manualHint) return;
            manualHint.hidden = currentSort !== "manual";
        }

        sortSelect.addEventListener("change", () => {
            currentSort = sortSelect.value;
            updateManualHint();
            render();
        });

        updateManualHint();
    }

    if (clearCompletedBtn) {
        clearCompletedBtn.addEventListener("click", () => {
            clearCompleted();
        });
    }

    document.addEventListener("keydown", (e) => {
        const mac = isMac();
        const cmdOrCtrl = mac ? e.metaKey : e.ctrlKey;

        // Ctrl/⌘ + K => focus search (override browser find ONLY if you want)
        if (cmdOrCtrl && e.key.toLowerCase() === "k") {
            e.preventDefault();
            focusSearch();
            return;
        }

        // Alt + N => focus new task title
        if (e.altKey && e.key.toLowerCase() === "n") {
            e.preventDefault();
            focusNewTask();
            return;
        }

        // "/" => focus search (only if you're not typing already)
        if (e.key === "/" && !isTypingInInput(document.activeElement)) {
            e.preventDefault();
            focusSearch();
            return;
        }

        // Ctrl/⌘ + Enter => save while editing
        if (cmdOrCtrl && e.key === "Enter" && editingTaskId) {
            e.preventDefault();

            if (editingDraft) {
                saveEdit(
                    editingTaskId,
                    editingDraft.title,
                    editingDraft.notes,
                    editingDraft.priority,
                    editingDraft.dueDate
                );
            }
        }
    });
}

loadTasksFromStorage();

wireEvents();
render();