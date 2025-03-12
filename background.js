// Handle omnibox suggestions
chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  if (!text.trim()) {
    suggest([{
      content: 'help',
      description: 'Type to search your workspaces and tabs - <match>example: "react hooks"</match>'
    }]);
    return;
  }

  const { workspaces = [] } = await chrome.storage.local.get('workspaces');
  const searchTerms = text.toLowerCase().trim().split(/\s+/);
  const suggestions = [];
  
  // Search through workspaces
  workspaces.forEach(workspace => {
    const workspaceNameMatch = searchTerms.every(term => 
      workspace.name.toLowerCase().includes(term)
    );
    
    const workspaceSummaryMatch = searchTerms.every(term => 
      workspace.summary.toLowerCase().includes(term)
    );

    // Find matching tabs within the workspace
    const matchingTabs = workspace.tabs.filter(tab => {
      return searchTerms.every(term => 
        tab.title.toLowerCase().includes(term) || 
        (tab.summary && tab.summary.toLowerCase().includes(term)) ||
        tab.url.toLowerCase().includes(term) // Include URL in search criteria
      );
    });

    // Add workspace as a suggestion if its name/summary matches or it has matching tabs
    if (workspaceNameMatch || workspaceSummaryMatch || matchingTabs.length > 0) {
      suggestions.push({
        content: `ws:${workspace.id}`,
        description: `<url>📁 Workspace</url>: <match>${escapeXml(workspace.name)}</match> (${workspace.tabs.length} tabs) - ${escapeXml(workspace.summary.slice(0, 70))}${workspace.summary.length > 70 ? '...' : ''}`
      });
    }
    
    // Add individual matching tabs as suggestions
    if (matchingTabs.length > 0) {
      matchingTabs.slice(0, 3).forEach(tab => { // Limit to top 3 matching tabs per workspace
        const hostname = new URL(tab.url).hostname;
        suggestions.push({
          content: `tab:${workspace.id}:${tab.url}`,
          description: `<url>🔖 Tab</url>: <match>${escapeXml(tab.title)}</match> - <dim>(${escapeXml(workspace.name)} / ${hostname})</dim>`
        });
      });
      
      // If there are more matching tabs, add a "see more" option
      if (matchingTabs.length > 3) {
        suggestions.push({
          content: `ws:${workspace.id}`,
          description: `<url>➕</url> See ${matchingTabs.length - 3} more matching tabs in <match>${escapeXml(workspace.name)}</match>...`
        });
      }
    }
  });
  
  // Add a help suggestion if no results
  if (suggestions.length === 0) {
    suggestions.push({
      content: 'noresults',
      description: 'No matching workspaces or tabs found. Try different keywords.'
    });
  }
  
  suggest(suggestions);
});

// Handle omnibox selection
chrome.omnibox.onInputEntered.addListener(async (text) => {
  if (text === 'help' || text === 'noresults') {
    // Show the extension popup instead
    chrome.action.openPopup();
    return;
  }
  
  if (text.startsWith('ws:')) {
    // Open entire workspace
    const workspaceId = text.substring(3);
    const { workspaces = [] } = await chrome.storage.local.get('workspaces');
    const workspace = workspaces.find(w => w.id === workspaceId);
    
    if (workspace) {
      chrome.windows.create({
        url: workspace.tabs.map(tab => tab.url)
      });
    }
  } else if (text.startsWith('tab:')) {
    // Open individual tab
    const parts = text.split(':');
    if (parts.length >= 3) {
      const tabUrl = parts.slice(2).join(':'); // Rejoin in case URL contains colons
      chrome.tabs.create({ url: tabUrl });
    }
  } else {
    // Fallback: treat as a direct workspace ID for backward compatibility
    const { workspaces = [] } = await chrome.storage.local.get('workspaces');
    const workspace = workspaces.find(w => w.id === text);
    
    if (workspace) {
      chrome.windows.create({
        url: workspace.tabs.map(tab => tab.url)
      });
    }
  }
});

// Helper function to escape XML special characters for omnibox formatting
function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
    return c;
  });
}

// Updated getTabContent function
async function getTabContent(tab) {
  // Only attempt extraction for http(s) pages.
  if (!/^https?:\/\//.test(tab.url)) {
    return null;
  }
  try {
    // Ask the content script to extract full page content
    const content = await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });
    return content;
  } catch (error) {
    // Suppress logging if error indicates no receiver; otherwise log error.
    if (!error.message.includes("Receiving end does not exist")) {
      console.error('Error extracting content via sendMessage:', error);
    }
    // Attempt fallback injection
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Extraction logic in the injected script
          const elementsToRemove = ['script', 'style', 'nav', 'header', 'footer', 'iframe', 'noscript'];
          const contentClone = document.body.cloneNode(true);
          elementsToRemove.forEach(tag => {
            const elements = contentClone.getElementsByTagName(tag);
            while (elements.length > 0) {
              elements[0].parentNode.removeChild(elements[0]);
            }
          });
          const textContent = contentClone.textContent || '';
          const cleanText = textContent.replace(/\s+/g, ' ').replace(/[^\w\s.,!?-]/g, '').trim();
          const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
          return {
            title: document.title,
            metaDescription: metaDescription,
            content: cleanText.slice(0, 1000),
            url: window.location.href
          };
        }
      });
      return result;
    } catch (fallbackError) {
      console.error('Error extracting content via executeScript:', fallbackError);
      return null;
    }
  }
}

// summarizeTab uses the full page content for generating a summary.
export async function summarizeTab(tab) {
  const content = await getTabContent(tab);
  if (!content) {
    return {
      title: tab.title,
      url: tab.url,
      favIconUrl: tab.favIconUrl,
      summary: tab.title
    };
  }

  const pageText = content.content || '';
  // Use the full summary without slicing text.
  const summaryText = pageText || content.metaDescription || 'No summary available';

  return {
    title: content.title,
    url: content.url,
    favIconUrl: tab.favIconUrl,
    summary: summaryText
  };
}

// Listen for messages to perform tab summarization
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "summarizeTab" && message.tab) {
    summarizeTab(message.tab).then(result => sendResponse(result));
    return true; // Indicates asynchronous response.
  }
});