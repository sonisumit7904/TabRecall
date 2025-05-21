// Tab management and UI functionality
let currentTabs = [];

// Initialize popup
document.addEventListener("DOMContentLoaded", async () => {
  setupTabNavigation();
  createToastContainer(); // Create toast container for notifications
  await loadCurrentTabs();
  await loadSavedWorkspaces();
  setupEventListeners();
});

// Setup tab navigation
function setupTabNavigation() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tabName = button.dataset.tab;

      // Update active tab button
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      // Update active content
      document.querySelectorAll(".tab-content").forEach((content) => {
        content.classList.remove("active");
      });
      document.getElementById(tabName).classList.add("active");
    });
  });
}

// Create toast container
function createToastContainer() {
  const container = document.createElement("div");
  container.className = "toast-container";
  document.body.appendChild(container);
}

// Show toast notification
function showToast(message, type = "default", duration = 3000) {
  const container = document.querySelector(".toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  // Trigger reflow for animation
  setTimeout(() => {
    toast.classList.add("show");
  }, 10);

  // Remove toast after duration
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      container.removeChild(toast);
    }, 300); // Wait for fade out animation
  }, duration);
}

// Helper function to close the confirm dialog
function closeConfirmDialog(dialogElement) {
  dialogElement.classList.remove("active");
  document.body.classList.remove('modal-open'); // Remove class from body
  setTimeout(() => {
    if (document.body.contains(dialogElement)) {
      document.body.removeChild(dialogElement);
    }
  }, 300); // Delay to allow fade-out animation
}

// Show confirmation dialog
function showConfirmDialog(title, message, onConfirm) {
  const dialog = document.createElement("div");
  dialog.className = "modal-overlay";

  const content = document.createElement("div");
  content.className = "modal confirm-dialog-content";

  const titleEl = document.createElement("div");
  titleEl.className = "confirm-dialog-title";
  titleEl.textContent = title;

  const messageEl = document.createElement("div");
  messageEl.className = "confirm-dialog-message";
  messageEl.textContent = message;

  const actions = document.createElement("div");
  actions.className = "confirm-dialog-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "confirm-btn cancel";
  cancelBtn.textContent = "Cancel";
  cancelBtn.onclick = () => {
    closeConfirmDialog(dialog); // Use helper
  };

  const confirmBtn = document.createElement("button");
  confirmBtn.className = "confirm-btn confirm";
  confirmBtn.textContent = "Delete"; // Or make this configurable
  confirmBtn.onclick = () => {
    onConfirm();
    closeConfirmDialog(dialog); // Use helper
  };

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);

  content.appendChild(titleEl);
  content.appendChild(messageEl);
  content.appendChild(actions);

  dialog.appendChild(content);
  document.body.appendChild(dialog);
  document.body.classList.add('modal-open'); // Add class to body

  // Trigger the animation by adding 'active' class after a brief delay
  setTimeout(() => {
    dialog.classList.add("active");
  }, 10);

  // Close on background click
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      closeConfirmDialog(dialog); // Use helper
    }
  });
}

// Load current tabs
async function loadCurrentTabs() {
  const tabsList = document.getElementById("tabs-list");
  tabsList.innerHTML =
    '<div class="empty-state"><div class="loading"></div><div>Loading tabs...</div></div>';

  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    currentTabs = tabs;
    // Clear the loading UI before appending tabs
    tabsList.innerHTML = "";

    for (const tab of tabs) {
      let tabData;
      try {
        tabData = await chrome.runtime.sendMessage({
          action: "summarizeTab",
          tab,
        });
      } catch (error) {
        console.warn(
          "No summary available for tab, using default tab info:",
          error
        );
        tabData = tab;
      }
      const tabElement = createTabElement(tabData);
      tabsList.appendChild(tabElement);
    }
  } catch (error) {
    console.error("Error loading tabs:", error);
    tabsList.innerHTML =
      '<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">Error Loading Tabs</div><div class="empty-state-message">Please try again later</div></div>';
  }
}

// Create tab element
function createTabElement(tab) {
  const div = document.createElement("div");
  div.className = "tab-item";

  const favicon = document.createElement("img");
  favicon.className = "tab-favicon";
  favicon.src = tab.favIconUrl || "icons/default-favicon.png";
  favicon.alt = "";

  const content = document.createElement("div");
  content.className = "tab-details";

  const title = document.createElement("div");
  title.className = "tab-title";
  title.textContent = tab.title;

  const summary = document.createElement("div");
  summary.className = "tab-summary";
  summary.textContent = tab.summary || "";

  content.appendChild(title);
  // if (tab.summary) {
  //  content.appendChild(summary);
  // }

  div.appendChild(favicon);
  div.appendChild(content);

  return div;
}

// Add helper function to format summaries for better readability
function formatSummary(summary) {
  // Splits summary by sentence (assuming '. ') and reinserts HTML line breaks.
  return summary.split(". ").join(".<br/>");
}

// Updated function to display a modal popup with the full summary using formatting
function showFullSummary(tab) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const formattedSummary = formatSummary(tab.summary);
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <h2>${tab.title}</h2>
    <p>${formattedSummary}</p>
    <button class="close-modal">Close</button>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.body.classList.add('modal-open'); // Add class to body

  // Trigger the animation by adding 'active' class after a brief delay
  setTimeout(() => {
    overlay.classList.add("active");
  }, 10);

  const closeFullSummaryModal = () => {
    overlay.classList.remove("active");
    document.body.classList.remove('modal-open'); // Remove class from body
    setTimeout(() => {
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
    }, 300); // Delay for fade-out animation
  };

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeFullSummaryModal();
    }
  });

  modal.querySelector(".close-modal").addEventListener("click", () => {
    closeFullSummaryModal();
  });
}

// Add a function to display a modal popup with the full workspace summary
function showFullWorkspaceSummary(workspace) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const formattedSummary = formatSummary(workspace.summary);
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <h2>${workspace.name}</h2>
    <p>${formattedSummary}</p>
    <button class="close-modal">Close</button>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.body.classList.add('modal-open'); // Add class to body

  // Trigger the animation by adding 'active' class after a brief delay
  setTimeout(() => {
    overlay.classList.add("active");
  }, 10);

  const closeFullWorkspaceSummaryModal = () => {
    overlay.classList.remove("active");
    document.body.classList.remove('modal-open'); // Remove class from body
    setTimeout(() => {
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
    }, 300); // Delay for fade-out animation
  };

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeFullWorkspaceSummaryModal();
    }
  });

  modal.querySelector(".close-modal").addEventListener("click", () => {
    closeFullWorkspaceSummaryModal();
  });
}

// Load saved workspaces
async function loadSavedWorkspaces() {
  const container = document.getElementById("workspaces-container");
  container.innerHTML =
    '<div class="empty-state"><div class="loading"></div><div>Loading workspaces...</div></div>';

  try {
    const { workspaces = [] } = await chrome.storage.local.get("workspaces");

    if (workspaces.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-title">No Workspaces Yet</div>
          <div class="empty-state-message">Save your first workspace by clicking on "Save Workspace"</div>
        </div>
      `;
      return;
    }

    container.innerHTML = "";
    workspaces.forEach((workspace) => {
      const workspaceElement = createWorkspaceElement(workspace);
      container.appendChild(workspaceElement);
    });
  } catch (error) {
    console.error("Error loading workspaces:", error);
    container.innerHTML =
      '<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">Error Loading Workspaces</div><div class="empty-state-message">Please try again later</div></div>';
  }
}

// Create workspace element
function createWorkspaceElement(workspace) {
  const div = document.createElement("div");
  div.className = "workspace-card";

  const header = document.createElement("div");
  header.className = "workspace-header";
  header.innerHTML = `
    <h3 class="workspace-title">${workspace.name}</h3>
    <div class="workspace-actions">
      <button class="open-workspace" data-id="${workspace.id}">Open</button>
      <button class="delete-workspace" data-id="${workspace.id}">Delete</button>
    </div>
  `;

  const summary = document.createElement("p");
  summary.className = "workspace-summary";
  summary.textContent = workspace.summary; // Summary content remains for search

  const tabsList = document.createElement("div");
  tabsList.className = "workspace-tabs collapsed";

  workspace.tabs.forEach((tab) => {
    const tabItem = document.createElement("div");
    tabItem.className = "workspace-tab-item";
    tabItem.innerHTML = `
      <img src="${
        tab.favIconUrl || "icons/default-favicon.png"
      }" alt="" class="tab-favicon">
      <div class="tab-details">
        <div class="tab-title">${tab.title}</div>
        <!-- you can add more info here -->
      </div>
    `;
    // make it look clickable
    tabItem.style.cursor = "pointer";
    // add click handler to open just this tab
    tabItem.addEventListener("click", () => {
      showToast(`Opening tab “${tab.title}”…`, "default");
      chrome.tabs.create({ url: tab.url });
    });
    tabsList.appendChild(tabItem);
  });

  const toggleButton = document.createElement("button");
  toggleButton.className = "toggle-tabs";
  toggleButton.textContent = "Show tabs";
  toggleButton.onclick = () => {
    tabsList.classList.toggle("collapsed");
    toggleButton.textContent = tabsList.classList.contains("collapsed")
      ? "Show tabs"
      : "Hide tabs";
  };

  const meta = document.createElement("p");
  meta.className = "workspace-meta";
  meta.textContent = `${workspace.tabs.length} tabs • ${new Date(
    workspace.created
  ).toLocaleDateString()}`;

  // Calculate some quick stats
  const uniqueDomains = new Set(
    workspace.tabs.map((tab) => {
      try {
        return new URL(tab.url).hostname;
      } catch {
        return "unknown";
      }
    })
  );

  const stats = document.createElement("div");
  stats.className = "workspace-stats";
  stats.innerHTML = `
    <div class="workspace-stat-item">📄 ${workspace.tabs.length} tabs</div>
    <div class="workspace-stat-item">🌐 ${uniqueDomains.size} domains</div>
  `;

  div.appendChild(header);
  div.appendChild(toggleButton);
  div.appendChild(tabsList);
  div.appendChild(stats); // Add quick stats
  div.appendChild(meta);

  return div;
}

// Setup event listeners
function setupEventListeners() {
  // Save workspace with loading state and success notification
  document.getElementById("save-btn").addEventListener("click", async () => {
    const saveBtn = document.getElementById("save-btn");
    const originalText = saveBtn.textContent;

    // Show loading state
    saveBtn.classList.add("loading");
    saveBtn.disabled = true;

    try {
      const nameInput = document.getElementById("workspace-name");
      const name =
        nameInput.value.trim() ||
        `Workspace ${new Date().toLocaleDateString()}`;

      const summarizedTabs = await Promise.all(
        currentTabs.map(async (tab) => {
          try {
            const tabData = await chrome.runtime.sendMessage({
              action: "summarizeTab",
              tab,
            });
            return (
              tabData || {
                url: tab.url,
                title: tab.title,
                favIconUrl: tab.favIconUrl,
                summary: "No summary available",
              }
            );
          } catch (error) {
            console.warn(
              "No summary available for tab, using fallback info:",
              error
            );
            return {
              url: tab.url,
              title: tab.title,
              favIconUrl: tab.favIconUrl,
              summary: "No summary available",
            };
          }
        })
      );

      // Update workspace summary to list all tab names separated by commas.
      const workspace = {
        id: Date.now().toString(),
        name,
        tabs: summarizedTabs,
        created: Date.now(),
        summary: summarizedTabs.map((tab) => tab.title).join(", "),
      };

      const { workspaces = [] } = await chrome.storage.local.get("workspaces");
      workspaces.push(workspace);
      await chrome.storage.local.set({ workspaces });

      // Success notification
      showToast(`Workspace "${name}" saved successfully!`, "success");

      nameInput.value = "";
      await loadSavedWorkspaces();
    } catch (error) {
      console.error("Error saving workspace:", error);
      showToast("Failed to save workspace", "error");
    } finally {
      // Restore button state
      saveBtn.classList.remove("loading");
      saveBtn.disabled = false;
      saveBtn.textContent = originalText;
    }
  });

  // Search workspaces
  document
    .getElementById("search-workspaces")
    .addEventListener("input", async (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const { workspaces = [] } = await chrome.storage.local.get("workspaces");

      const filtered = workspaces.filter(
        (workspace) =>
          workspace.name.toLowerCase().includes(searchTerm) ||
          workspace.summary.toLowerCase().includes(searchTerm) ||
          workspace.tabs.some(
            (tab) =>
              tab.title.toLowerCase().includes(searchTerm) ||
              tab.summary?.toLowerCase().includes(searchTerm)
          )
      );

      const container = document.getElementById("workspaces-container");
      container.innerHTML = "";
      filtered.forEach((workspace) => {
        const workspaceElement = createWorkspaceElement(workspace);
        container.appendChild(workspaceElement);
      });
    });

  // Workspace actions with confirmation for delete
  document
    .getElementById("workspaces-container")
    .addEventListener("click", async (e) => {
      const workspaceId = e.target.dataset.id;
      if (!workspaceId) return;

      if (e.target.classList.contains("open-workspace")) {
        const { workspaces = [] } = await chrome.storage.local.get(
          "workspaces"
        );
        const workspace = workspaces.find((w) => w.id === workspaceId);

        if (workspace) {
          showToast(`Opening ${workspace.name}...`, "default");
          chrome.windows.create({
            url: workspace.tabs.map((tab) => tab.url),
          });
        }
      }

      if (e.target.classList.contains("delete-workspace")) {
        const { workspaces = [] } = await chrome.storage.local.get(
          "workspaces"
        );
        const workspace = workspaces.find((w) => w.id === workspaceId);

        if (workspace) {
          showConfirmDialog(
            "Delete Workspace",
            `Are you sure you want to delete "${workspace.name}"? This action cannot be undone.`,
            async () => {
              const updatedWorkspaces = workspaces.filter(
                (w) => w.id !== workspaceId
              );
              await chrome.storage.local.set({ workspaces: updatedWorkspaces });
              showToast(`Workspace "${workspace.name}" deleted`, "warning");
              await loadSavedWorkspaces();
            }
          );
        }
      }
    });
}
