// Import authentication functions from the utility file
import { loginWithGoogle, checkLoginStatus, logoutUser } from './utils/auth.js';

// Tab management and UI functionality
let currentTabs = [];
let workspaceSearchResults = []; // Store search results for workspaces

// Initialize popup
document.addEventListener("DOMContentLoaded", async () => {
  setupTabNavigation();
  createToastContainer(); // Create toast container for notifications
  
  // Initialize authentication UI and check login status
  await initializeAuth();
  
  await loadCurrentTabs();
  await loadSavedWorkspaces();
  setupEventListeners();
  setupWorkspaceSearch();
});

// --- Authentication UI and Logic Integration ---

// Function to update the authentication UI state
function updateAuthUI(user) {
  const loginButton = document.getElementById("loginBtn");
  const logoutButton = document.getElementById("logoutBtn");
  const userAvatar = document.getElementById("userAvatar");
  const userInitials = document.getElementById("userInitials");
  
  if (!loginButton || !logoutButton) return; // Ensure elements exist

  if (user && (user.email || user.name || user.userId || user.id)) { // Check for valid user object
    // User is logged in - show logout button with avatar/initials
    loginButton.style.display = "none";
    logoutButton.style.display = "flex";
    
    // Handle user avatar or initials (only if elements exist)
    if (userAvatar && userInitials) {
      if (user.picture) {
        // Preload the image to avoid flickering
        const img = new Image();
        img.onload = () => {
          userAvatar.src = user.picture;
          userAvatar.style.display = "block";
          userInitials.style.display = "none";
        };
        img.onerror = () => {
          // Fallback to initials if image fails to load
          const name = user.name || user.email || "User";
          const initials = name.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase();
          userInitials.textContent = initials;
          userInitials.style.display = "flex";
          userAvatar.style.display = "none";
        };
        img.src = user.picture;
        
        // Show initials immediately as fallback while image loads
        const name = user.name || user.email || "User";
        const initials = name.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase();
        userInitials.textContent = initials;
        userInitials.style.display = "flex";
        userAvatar.style.display = "none";
      } else {
        // Show initials if no picture
        const name = user.name || user.email || "User";
        const initials = name.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase();
        userInitials.textContent = initials;
        userInitials.style.display = "flex";
        userAvatar.style.display = "none";
      }
    }
  } else {
    // User is not logged in - show login button
    loginButton.style.display = "flex";
    logoutButton.style.display = "none";
    
    // Hide avatar/initials if elements exist
    if (userAvatar) userAvatar.style.display = "none";
    if (userInitials) userInitials.style.display = "none";
  }
}

// Initial check for login status when the popup opens
async function checkAndDisplayLoginStatus() {
  const user = await checkLoginStatus();
  updateAuthUI(user);
}

// Initialize authentication
async function initializeAuth() {
  console.log("TabRecall Popup: Initializing authentication...");

  // Get references to auth UI elements
  const loginButton = document.getElementById("loginBtn");
  const logoutButton = document.getElementById("logoutBtn");

  // Add event listeners for auth buttons
  if (loginButton) {
    loginButton.addEventListener("click", async () => {
      loginButton.disabled = true; // Disable button during login
      const originalHTML = loginButton.innerHTML;
      loginButton.innerHTML = "Logging in...";
      try {
        const user = await loginWithGoogle();
        updateAuthUI(user);
        console.log("Login successful in TabRecall popup!");
        showToast("Successfully logged in!", "success");
        // Optionally trigger a refresh of TabRecall's main UI if it depends on login status
        // e.g., updateWorkspaceDisplay();
      } catch (error) {
        console.error("TabRecall Login failed:", error);
        showToast(`Login failed: ${error.message}`, "error");
        updateAuthUI(null); // Show logged out state on error
      } finally {
        loginButton.disabled = false;
        loginButton.innerHTML = originalHTML;
      }
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      logoutButton.disabled = true; // Disable button during logout
      const originalHTML = logoutButton.innerHTML;
      logoutButton.innerHTML = "Logging out...";
      try {
        await logoutUser();
        updateAuthUI(null); // Set to logged out state
        console.log("Logout successful in TabRecall popup!");
        showToast("Successfully logged out!", "success");
        // Optionally trigger a refresh of TabRecall's main UI
        // e.g., updateWorkspaceDisplay();
      } catch (error) {
        console.error("TabRecall Logout failed:", error);
        showToast(`Logout failed: ${error.message}`, "error");
        // If logout failed, user might still be logged in, so re-check status
        checkAndDisplayLoginStatus();
      } finally {
        logoutButton.disabled = false;
        logoutButton.innerHTML = originalHTML;
      }
    });
  }

  // Check and display initial login status
  await checkAndDisplayLoginStatus();
}

// Setup workspace search functionality
function setupWorkspaceSearch() {
  const workspaceNameInput = document.getElementById("workspace-name");
  const suggestionsContainer = document.getElementById("workspace-suggestions");
  const createNewBtn = document.getElementById("create-new-btn");
  let hoverTimeout; // Variable to store the timeout ID

  workspaceNameInput.addEventListener("input", async function () {
    const searchTerm = this.value.trim().toLowerCase();
    const { workspaces = [] } = await chrome.storage.local.get("workspaces");

    // Filter workspaces based on search term
    workspaceSearchResults =
      searchTerm.length > 0
        ? workspaces.filter((w) => w.name.toLowerCase().includes(searchTerm))
        : [];

    // Clear previous suggestions
    suggestionsContainer.innerHTML = "";

    // Add suggestions for matching workspaces
    workspaceSearchResults.forEach((workspace) => {
      const item = document.createElement("div");
      item.className = "autocomplete-item";
      item.textContent = workspace.name;

      item.addEventListener("click", () => {
        workspaceNameInput.value = workspace.name;
        suggestionsContainer.innerHTML = ""; // Clear suggestions after selection
        suggestionsContainer.style.display = "none";
        // Save to this workspace immediately
        saveToWorkspace(workspace.name, true);
      });

      // Add mouseenter event to show hint after a delay
      item.addEventListener("mouseenter", () => {
        // Clear any existing timeout
        clearTimeout(hoverTimeout);
        // Set a new timeout
        hoverTimeout = setTimeout(() => {
          // Show hint (tooltip)
          item.title = `Add current tabs to "${workspace.name}"`;
        }, 10); // 500ms delay
      });

      // Add mouseleave event to clear hint and timeout
      item.addEventListener("mouseleave", () => {
        clearTimeout(hoverTimeout);
        item.title = ""; // Clear the tooltip
      });

      suggestionsContainer.appendChild(item);
    });

    // Show/hide suggestions container
    if (workspaceSearchResults.length > 0 && searchTerm.length > 0) {
      suggestionsContainer.style.display = "block";
    } else {
      suggestionsContainer.style.display = "none";
    }
  });

  // Handle create new button click
  createNewBtn.addEventListener("click", () => {
    // Create a new workspace with the current input value
    const name =
      workspaceNameInput.value.trim() ||
      `Workspace ${new Date().toLocaleDateString()}`;
    saveToWorkspace(name, false);
  });

  // Hide suggestions when clicking outside
  document.addEventListener("click", (e) => {
    if (
      e.target !== workspaceNameInput &&
      !e.target.closest("#workspace-suggestions")
    ) {
      suggestionsContainer.style.display = "none";
    }
  });
}

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
  document.body.classList.remove("modal-open"); // Remove class from body
  setTimeout(() => {
    if (document.body.contains(dialogElement)) {
      document.body.removeChild(dialogElement);
    }
  }, 300); // Delay to allow fade-out animation
}

// Show confirmation dialog
function showConfirmDialog(title, message, onConfirm, onCancel = () => {}, confirmStyle = '', allowHTML = false) {
  const dialog = document.createElement("div");
  dialog.className = "modal-overlay";

  const content = document.createElement("div");
  content.className = "modal confirm-dialog-content";

  const titleEl = document.createElement("div");
  titleEl.className = "confirm-dialog-title";
  titleEl.textContent = title;

  const messageEl = document.createElement("div");
  messageEl.className = "confirm-dialog-message";
  
  if (allowHTML) {
    messageEl.innerHTML = message;
  } else {
    messageEl.textContent = message;
  }

  const actions = document.createElement("div");
  actions.className = "confirm-dialog-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "confirm-btn cancel";
  cancelBtn.textContent = "Cancel";
  cancelBtn.onclick = () => {
    onCancel();
    closeConfirmDialog(dialog);
  };

  const confirmBtn = document.createElement("button");
  confirmBtn.className = `confirm-btn confirm ${confirmStyle}`;
  confirmBtn.textContent = confirmStyle === 'primary' ? "Import" : "Delete";
  confirmBtn.onclick = () => {
    onConfirm();
    closeConfirmDialog(dialog);
  };

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);

  content.appendChild(titleEl);
  content.appendChild(messageEl);
  content.appendChild(actions);

  dialog.appendChild(content);
  document.body.appendChild(dialog);
  document.body.classList.add("modal-open");

  setTimeout(() => {
    dialog.classList.add("active");
  }, 10);

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      onCancel();
      closeConfirmDialog(dialog);
    }
  });
}

// Show a progress dialog with progress bar
function showProgressDialog(title, message) {
  const dialog = document.createElement('div');
  dialog.className = 'modal-overlay active';

  const content = document.createElement('div');
  content.className = 'modal confirm-dialog-content';

  const titleEl = document.createElement('div');
  titleEl.className = 'confirm-dialog-title';
  titleEl.textContent = title;

  const messageEl = document.createElement('div');
  messageEl.className = 'confirm-dialog-message';
  messageEl.textContent = message;

  // Progress bar container
  const progressContainer = document.createElement('div');
  progressContainer.className = 'progress-container';
  
  const progressBar = document.createElement('div');
  progressBar.className = 'progress-bar';
  progressBar.style.width = '0%';
  
  progressContainer.appendChild(progressBar);
  
  content.appendChild(titleEl);
  content.appendChild(messageEl);
  content.appendChild(progressContainer);
  
  dialog.appendChild(content);
  document.body.appendChild(dialog);
  document.body.classList.add('modal-open');

  let progress = 0;
  
  // Start animating progress
  const progressInterval = setInterval(() => {
    if (progress < 90) {
      progress += (90 - progress) / 10;
      progressBar.style.width = `${progress}%`;
    }
  }, 200);
  
  return {
    updateProgress: (percent) => {
      progress = percent;
      progressBar.style.width = `${percent}%`;
    },
    complete: () => {
      clearInterval(progressInterval);
      progressBar.style.width = '100%';
      
      // Remove dialog after a short delay
      setTimeout(() => {
        dialog.classList.remove('active');
        document.body.classList.remove('modal-open');
        setTimeout(() => {
          document.body.removeChild(dialog);
        }, 300);
      }, 500);
    }
  };
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

    // Add select all checkbox
    const selectAllContainer = document.createElement("div");
    selectAllContainer.className = "select-all-container";

    const selectAllCheckbox = document.createElement("input");
    selectAllCheckbox.type = "checkbox";
    selectAllCheckbox.id = "select-all-tabs";
    selectAllCheckbox.checked = true;

    const selectAllLabel = document.createElement("label");
    selectAllLabel.htmlFor = "select-all-tabs";
    selectAllLabel.textContent = "Select/Deselect All";

    selectAllContainer.appendChild(selectAllCheckbox);
    selectAllContainer.appendChild(selectAllLabel);
    tabsList.appendChild(selectAllContainer);

    // Add event listener for select all checkbox
    selectAllCheckbox.addEventListener("change", () => {
      const checkboxes = document.querySelectorAll(".tab-checkbox");
      checkboxes.forEach((checkbox) => {
        checkbox.checked = selectAllCheckbox.checked;
      });
    });

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

  // Add checkbox for tab selection
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "tab-checkbox";
  checkbox.checked = true;
  checkbox.dataset.tabUrl = tab.url;
  checkbox.dataset.tabId = tab.id;
  checkbox.dataset.tabTitle = tab.title;
  checkbox.dataset.tabFavIconUrl = tab.favIconUrl || "";

  const favicon = document.createElement("img");
  favicon.className = "tab-favicon";
  favicon.src = tab.favIconUrl || "icons/icon16.png";
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

  // Make the whole tab item clickable to toggle checkbox
  div.addEventListener("click", (e) => {
    // Don't toggle if clicking on the checkbox itself
    if (e.target !== checkbox) {
      checkbox.checked = !checkbox.checked;
    }
  });

  div.appendChild(checkbox);
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
  document.body.classList.add("modal-open"); // Add class to body

  // Trigger the animation by adding 'active' class after a brief delay
  setTimeout(() => {
    overlay.classList.add("active");
  }, 10);

  const closeFullSummaryModal = () => {
    overlay.classList.remove("active");
    document.body.classList.remove("modal-open"); // Remove class from body
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
  document.body.classList.add("modal-open"); // Add class to body

  // Trigger the animation by adding 'active' class after a brief delay
  setTimeout(() => {
    overlay.classList.add("active");
  }, 10);

  const closeFullWorkspaceSummaryModal = () => {
    overlay.classList.remove("active");
    document.body.classList.remove("modal-open"); // Remove class from body
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

  workspace.tabs.forEach((tab, tabIndex) => {
    const tabItem = document.createElement("div");
    tabItem.className = "workspace-tab-item";
    tabItem.innerHTML = `
      <img src="${
        tab.favIconUrl || "icons/icon16.png"
      }" alt="" class="tab-favicon">
      <div class="tab-details">
        <div class="tab-title">${tab.title}</div>
        <!-- you can add more info here -->
      </div>
      <button class="delete-tab" data-workspace-id="${
        workspace.id
      }" data-tab-index="${tabIndex}">✕</button>
    `;
    // make it look clickable
    tabItem.addEventListener("click", (e) => {
      // Don't open tab if clicking the delete button
      if (e.target.classList.contains("delete-tab")) return;

      showToast(`Opening tab "${tab.title}"…`, "default");
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

// Helper function to save tabs to workspace
async function saveToWorkspace(name, isAddingToExisting) {
  try {
    // Get all checked tabs
    const selectedCheckboxes = document.querySelectorAll(
      ".tab-checkbox:checked"
    );
    const selectedTabUrls = Array.from(selectedCheckboxes).map(
      (checkbox) => checkbox.dataset.tabUrl
    );

    // Filter currentTabs to include only selected tabs
    const selectedTabs = currentTabs.filter((tab) =>
      selectedTabUrls.includes(tab.url)
    );

    // Check if any tabs are selected
    if (selectedTabs.length === 0) {
      showToast("Please select at least one tab to save", "warning");
      return;
    }

    const summarizedTabs = await Promise.all(
      selectedTabs.map(async (tab) => {
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

    const { workspaces = [] } = await chrome.storage.local.get("workspaces");

    // Check if we're adding to an existing workspace
    if (isAddingToExisting) {
      // Find the existing workspace with the given name
      const existingWorkspaceIndex = workspaces.findIndex(
        (w) => w.name.toLowerCase() === name.toLowerCase()
      );

      if (existingWorkspaceIndex === -1) {
        showToast(
          `No workspace named "${name}" found. Creating new workspace instead.`,
          "warning"
        );
        // Create new workspace
        const newWorkspace = {
          id: Date.now().toString(),
          name,
          tabs: summarizedTabs,
          created: Date.now(),
          summary: summarizedTabs.map((tab) => tab.title).join(", "),
        };
        workspaces.push(newWorkspace);
        showToast(
          `New workspace "${name}" created with ${summarizedTabs.length} tabs!`,
          "success"
        );
      } else {
        // Add to existing workspace
        const existingWorkspace = workspaces[existingWorkspaceIndex];

        // Add unique tabs (avoid duplicates by URL)
        const existingUrls = new Set(
          existingWorkspace.tabs.map((tab) => tab.url)
        );
        const uniqueNewTabs = summarizedTabs.filter(
          (tab) => !existingUrls.has(tab.url)
        );

        existingWorkspace.tabs.push(...uniqueNewTabs);

        // Update the summary to include all tabs
        existingWorkspace.summary = existingWorkspace.tabs
          .map((tab) => tab.title)
          .join(", ");

        // Replace the workspace in the array
        workspaces[existingWorkspaceIndex] = existingWorkspace;

        showToast(
          `Added ${uniqueNewTabs.length} tabs to "${name}"!`,
          "success"
        );
      }
    } else {
      // Create new workspace
      const newWorkspace = {
        id: Date.now().toString(),
        name,
        tabs: summarizedTabs,
        created: Date.now(),
        summary: summarizedTabs.map((tab) => tab.title).join(", "),
      };
      workspaces.push(newWorkspace);
      showToast(
        `Workspace "${name}" saved with ${summarizedTabs.length} tabs!`,
        "success"
      );
    }

    // Save updated workspaces
    await chrome.storage.local.set({ workspaces });

    // Clear the input field and refresh workspaces list
    document.getElementById("workspace-name").value = "";
    await loadSavedWorkspaces();
  } catch (error) {
    console.error("Error saving workspace:", error);
    showToast("Failed to save workspace", "error");
  }
}

// Function to export workspaces to JSON file
async function exportWorkspaces() {
  try {
    const { workspaces = [] } = await chrome.storage.local.get('workspaces');
    
    if (workspaces.length === 0) {
      showToast('No workspaces to export', 'warning');
      return;
    }

    const exportData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      workspaceCount: workspaces.length,
      workspaces: workspaces
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tabrecall-workspaces-${new Date().toISOString().split('T')[0]}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
    showToast(`${workspaces.length} workspaces exported successfully!`, 'success');
  } catch (error) {
    console.error('Export failed:', error);
    showToast('Failed to export workspaces', 'error');
  }
}

// Function to import workspaces from JSON file
async function importWorkspaces(file) {
  try {
    if (!file) {
      showToast('No file selected', 'warning');
      return;
    }

    if (!file.name.endsWith('.json')) {
      showToast('Please select a valid JSON file', 'error');
      return;
    }

    const fileContent = await readFileAsText(file);
    const importData = JSON.parse(fileContent);
    
    // Validate import data structure
    if (!importData.workspaces || !Array.isArray(importData.workspaces)) {
      throw new Error('Invalid backup file format');
    }

    const { workspaces: existingWorkspaces = [] } = await chrome.storage.local.get('workspaces');
    const existingNames = new Set(existingWorkspaces.map(w => w.name.toLowerCase()));
    
    let importedCount = 0;
    let skippedCount = 0;
    const workspacesToAdd = [];

    // Process each workspace
    for (const workspace of importData.workspaces) {
      // Validate workspace structure
      if (!workspace.id || !workspace.name || !workspace.tabs) {
        console.warn('Skipping invalid workspace:', workspace);
        skippedCount++;
        continue;
      }

      // Handle duplicates
      if (existingNames.has(workspace.name.toLowerCase())) {
        // Rename duplicate
        let counter = 1;
        let newName = `${workspace.name} (${counter})`;
        while (existingNames.has(newName.toLowerCase())) {
          counter++;
          newName = `${workspace.name} (${counter})`;
        }
        workspace.name = newName;
        existingNames.add(newName.toLowerCase());
      }

      // Generate new ID to avoid conflicts
      workspace.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      workspacesToAdd.push(workspace);
      importedCount++;
    }

    if (workspacesToAdd.length === 0) {
      showToast('No valid workspaces found in file', 'warning');
      return;
    }

    // Show import preview and confirm
    const confirmed = await showImportPreview(importData);
    if (!confirmed) {
      showToast('Import cancelled', 'info');
      return;
    }

    // Show progress for large imports
    let progressDialog;
    if (workspacesToAdd.length > 10) {
      progressDialog = showProgressDialog('Importing workspaces...', 
        `Processing ${workspacesToAdd.length} workspaces`);
    }

    // Save imported workspaces
    const updatedWorkspaces = [...existingWorkspaces, ...workspacesToAdd];
    await chrome.storage.local.set({ workspaces: updatedWorkspaces });
    
    // Close progress dialog if it exists
    if (progressDialog) {
      progressDialog.complete();
    }
    
    // Refresh UI
    await loadSavedWorkspaces();
    
    const message = skippedCount > 0 
      ? `Imported ${importedCount} workspaces (${skippedCount} skipped)`
      : `Successfully imported ${importedCount} workspaces!`;
    
    showToast(message, 'success');
    
  } catch (error) {
    console.error('Import failed:', error);
    showToast(`Import failed: ${error.message}`, 'error');
  }
}

// Helper function to read file as text
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// Show a preview of the import data and ask for confirmation
async function showImportPreview(importData) {
  return new Promise((resolve) => {
    const workspaceCount = importData.workspaces.length;
    const exportDate = importData.exportDate ? 
      new Date(importData.exportDate).toLocaleDateString() : 
      'unknown date';
    
    // Calculate total tabs being imported
    const totalTabs = importData.workspaces.reduce((count, workspace) => 
      count + (workspace.tabs?.length || 0), 0);
    
    // Calculate unique domains
    const domains = new Set();
    const topWorkspaces = [];

    importData.workspaces.forEach(workspace => {
      // Collect top 3 workspaces info for preview
      if (topWorkspaces.length < 3) {
        topWorkspaces.push({
          name: workspace.name,
          tabCount: workspace.tabs?.length || 0
        });
      }
      
      workspace.tabs?.forEach(tab => {
        try {
          domains.add(new URL(tab.url).hostname);
        } catch {
          // Ignore invalid URLs
        }
      });
    });
    
    // Format workspace preview text
    const workspacePreview = topWorkspaces.map(w => 
      `• ${w.name} (${w.tabCount} tabs)`
    ).join('<br>');
    
    const previewMessage = `
      <div class="import-preview">
        <p>This will import <strong>${workspaceCount} workspaces</strong> containing <strong>${totalTabs} tabs</strong> across <strong>${domains.size} domains</strong> from ${exportDate}.</p>
        ${topWorkspaces.length > 0 ? `<p>Preview of workspaces:<br>${workspacePreview}${workspaceCount > 3 ? '<br>• ...' : ''}</p>` : ''}
        <p>Duplicates will be renamed automatically.</p>
      </div>
    `;
    
    // Use HTML in confirm dialog
    showConfirmDialog(
      'Import Workspaces',
      previewMessage,
      () => resolve(true),
      () => resolve(false),
      'primary', // Use primary style for the confirm button
      true // Enable HTML in the message
    );
  });
}

// The workspaces header is defined directly in the HTML

// Setup event listeners
function setupEventListeners() {
  // Import/Export dropdown functionality
  const backupBtn = document.getElementById('backup-btn');
  const backupDropdown = document.getElementById('backup-dropdown');
  const importBtn = document.getElementById('import-btn');
  const exportBtn = document.getElementById('export-btn');
  const fileInput = document.getElementById('import-file-input');
  
  // Toggle dropdown on click
  backupBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    backupDropdown.classList.toggle('show');
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.import-export-container')) {
      backupDropdown.classList.remove('show');
    }
  });

  // Import handler with focus management
  importBtn.addEventListener('click', () => {
    backupDropdown.classList.remove('show');
    fileInput.click();
  });

  // Export handler with loading state
  exportBtn.addEventListener('click', async () => {
    backupDropdown.classList.remove('show');
    
    // Show loading state
    const originalText = exportBtn.innerHTML;
    exportBtn.innerHTML = '<span class="loading-icon"></span> Exporting...';
    exportBtn.disabled = true;
    
    try {
      await exportWorkspaces();
    } finally {
      // Restore button state
      setTimeout(() => {
        exportBtn.innerHTML = originalText;
        exportBtn.disabled = false;
      }, 500); // Small delay to ensure user sees the completion
    }
  });

  // Enhanced file input handler with validation feedback and loading state
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Show loading indicator
      showToast('Processing import file...', 'default');
      
      // Show loading state on import button
      const originalText = importBtn.innerHTML;
      importBtn.innerHTML = '<span class="loading-icon"></span> Importing...';
      importBtn.disabled = true;
      
      try {
        await importWorkspaces(file);
      } catch (error) {
        showToast(`Import error: ${error.message}`, 'error');
      } finally {
        // Reset UI state
        setTimeout(() => {
          importBtn.innerHTML = originalText;
          importBtn.disabled = false;
        }, 500);
        e.target.value = ''; // Reset file input
      }
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
      const workspaceId = e.target.dataset.id || e.target.dataset.workspaceId;
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

      // Handle delete tab button click
      if (e.target.classList.contains("delete-tab")) {
        const tabIndex = e.target.dataset.tabIndex;
        const workspace = (
          await chrome.storage.local.get("workspaces")
        ).workspaces.find((w) => w.id === workspaceId);

        if (workspace && tabIndex !== undefined) {
          const tabToDelete = workspace.tabs[tabIndex];

          showConfirmDialog(
            "Delete Tab",
            `Are you sure you want to delete the tab "${tabToDelete.title}"? This action cannot be undone.`,
            async () => {
              // Update the workspace.tabs array
              workspace.tabs.splice(tabIndex, 1);

              // Update the workspace in storage
              const { workspaces = [] } = await chrome.storage.local.get(
                "workspaces"
              );
              const updatedWorkspaces = workspaces.map((w) =>
                w.id === workspaceId ? workspace : w
              );
              await chrome.storage.local.set({ workspaces: updatedWorkspaces });

              // Update the DOM directly
              const workspaceCardElement = e.target.closest(".workspace-card");
              if (workspaceCardElement) {
                const tabItemElement = e.target.closest(".workspace-tab-item");
                if (tabItemElement) {
                  tabItemElement.remove();
                }

                // Update tab count in stats
                const statsTabCountElement = workspaceCardElement.querySelector(
                  ".workspace-stats .workspace-stat-item:first-child"
                );
                if (statsTabCountElement) {
                  statsTabCountElement.innerHTML = `📄 ${workspace.tabs.length} tabs`;
                }

                // Update domain count in stats
                const uniqueDomains = new Set(
                  workspace.tabs.map((t) => {
                    try {
                      return new URL(t.url).hostname;
                    } catch {
                      return "unknown";
                    }
                  })
                );
                const statsDomainCountElement =
                  workspaceCardElement.querySelector(
                    ".workspace-stats .workspace-stat-item:nth-child(2)"
                  );
                if (statsDomainCountElement) {
                  statsDomainCountElement.innerHTML = `🌐 ${uniqueDomains.size} domains`;
                }

                // Update meta information
                const metaElement =
                  workspaceCardElement.querySelector(".workspace-meta");
                if (metaElement) {
                  metaElement.textContent = `${
                    workspace.tabs.length
                  } tabs • ${new Date(workspace.created).toLocaleDateString()}`;
                }

                // Handle toggle button and tabs list if workspace becomes empty
                const toggleButton =
                  workspaceCardElement.querySelector(".toggle-tabs");
                const tabsListElement =
                  workspaceCardElement.querySelector(".workspace-tabs");

                if (workspace.tabs.length === 0) {
                  if (toggleButton) {
                    toggleButton.style.display = "none";
                  }
                  if (tabsListElement) {
                    tabsListElement.classList.add("collapsed");
                    tabsListElement.innerHTML = ""; // Clear content
                  }
                } else {
                  if (toggleButton) {
                    toggleButton.style.display = "";
                  }
                }
                showToast("Tab deleted successfully!", "success");
              } else {
                // Fallback if DOM element not found
                await loadSavedWorkspaces();
                showToast("Tab deleted. Workspaces reloaded.", "success");
              }
            }
          );
        }
      }
    });
}

// The workspaces header is already defined in the HTML, no need to create it dynamically
