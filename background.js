// Handle omnibox suggestions
chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const { workspaces = [] } = await chrome.storage.local.get('workspaces');
  
  const suggestions = workspaces.flatMap(workspace => {
    const matchingTabs = workspace.tabs.filter(tab => 
      tab.title.toLowerCase().includes(text.toLowerCase()) ||
      tab.summary.toLowerCase().includes(text.toLowerCase())
    );

    if (matchingTabs.length > 0) {
      return [{
        content: workspace.id,
        description: `${workspace.name} (${matchingTabs.length} matching tabs) - ${workspace.summary.slice(0, 50)}...`
      }];
    }
    return [];
  });

  suggest(suggestions);
});

// Handle omnibox selection
chrome.omnibox.onInputEntered.addListener(async (workspaceId) => {
  const { workspaces = [] } = await chrome.storage.local.get('workspaces');
  const workspace = workspaces.find(w => w.id === workspaceId);
  
  if (workspace) {
    chrome.windows.create({
      url: workspace.tabs.map(tab => tab.url)
    });
  }
});

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