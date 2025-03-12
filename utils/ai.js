// This module will handle AI summarization
// We'll use the Hugging Face Inference API with the DistilBART model

const HUGGING_FACE_API_URL = 'https://api-inference.huggingface.co/models/gemini2.0';
// New optimized endpoint for summary with keywords
const HUGGING_FACE_OPTIMIZED_URL = 'https://api-inference.huggingface.co/models/gemini2.0-keywords';

const API_KEY = import.meta.env.VITE_HUGGINGFACE_API_KEY;

export async function generateSummary(tabs) {
  try {
    // Prepare the input text from tab titles and URLs
    const input = tabs
      .map(tab => `${tab.title} (${tab.url})`)
      .join('\n');

    // Make the API request
    const response = await fetch(HUGGING_FACE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: In production, you'd want to handle the API key securely
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        inputs: input,
        parameters: {
          max_length: 500,
          min_length: 30,
          do_sample: false
        }
      })
    });

    if (!response.ok) {
      throw new Error('AI API request failed');
    }

    const data = await response.json();
    return data[0].summary_text;
  } catch (error) {
    console.error('Error generating summary:', error);
    // Fallback to a basic summary if AI fails
    return `Workspace with ${tabs.length} tabs related to ${tabs[0].title}`;
  }
}

// New function to generate optimized summary and keywords
export async function generateSummaryAndKeywords(tabs) {
  try {
    // Prepare the input text from tab titles and URLs
    const input = tabs.map(tab => `${tab.title} (${tab.url})`).join('\n');
    // Make the API request to the optimized endpoint
    const response = await fetch(HUGGING_FACE_OPTIMIZED_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: Handle the API key securely in production
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        inputs: input,
        parameters: {
          max_length: 300, // Lightweight summary
          min_length: 30,
          do_sample: false,
          include_keywords: true // Custom flag to request optimized keywords
        }
      })
    });
    if (!response.ok) {
      throw new Error('Optimized AI API request failed');
    }
    const data = await response.json();
    return {
      summary: data[0].summary_text,
      keywords: data[0].keywords // Assumes API returns a list of keywords
    };
  } catch (error) {
    console.error('Error generating optimized summary and keywords:', error);
    // Fallback to a basic summary and simple keyword extraction
    return {
      summary: `Workspace with ${tabs.length} tabs related to ${tabs[0].title}`,
      keywords: [tabs[0].title.split(' ')[0]] // Use the first word of the first title as a keyword
    };
  }
}