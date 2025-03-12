// Function to extract main content from the page
function extractPageContent() {
    // Remove unwanted elements
    const elementsToRemove = [
      'script',
      'style',
      'nav',
      'header',
      'footer',
      'iframe',
      'noscript'
    ];
  
    // Create a clone of the document body to avoid modifying the actual page
    const contentClone = document.body.cloneNode(true);
    
    // Remove unwanted elements from the clone
    elementsToRemove.forEach(tag => {
      const elements = contentClone.getElementsByTagName(tag);
      while (elements.length > 0) {
        elements[0].parentNode.removeChild(elements[0]);
      }
    });
  
    // Extract text content
    const textContent = contentClone.textContent || '';
    
    // Clean up the text
    const cleanText = textContent
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s.,!?-]/g, '')
      .trim();
  
    // Get meta description if available
    const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
  
    return {
      title: document.title,
      metaDescription,
      content: cleanText.slice(0, 1000), // Limit content length
      url: window.location.href
    };
  }
  
  // Listen for messages from the extension
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractContent') {
      const content = extractPageContent();
      sendResponse(content);
    }
    return true;
  });