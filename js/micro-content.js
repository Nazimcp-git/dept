// ==========================================================
// micro-content.js — Extracts summaries, highlights, 1-min read
// ==========================================================

const MicroContent = {
  /**
   * Generates micro-content from raw HTML string
   * @param {string} htmlContent - The raw HTML of the article
   * @returns {Object} { summary, oneMinRead, highlights }
   */
  generate: function(htmlContent) {
    // Create a temporary DOM element to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    const paragraphs = Array.from(tempDiv.querySelectorAll('p')).map(p => p.textContent.trim()).filter(t => t.length > 20);
    const blockquotes = Array.from(tempDiv.querySelectorAll('blockquote')).map(bq => bq.textContent.trim().replace('Copy Verse', '').trim());

    // 1. Summary: First 2-3 lines (around 150-200 characters)
    let summary = '';
    if (paragraphs.length > 0) {
      summary = paragraphs[0].substring(0, 200);
      if (paragraphs[0].length > 200) summary += '...';
    }

    // 2. 1-Minute Read Version: First sentences of key paragraphs (max 150 words)
    let oneMinRead = '';
    let wordCount = 0;
    for (let p of paragraphs) {
      // Extract first sentence
      const firstSentence = p.split(/(?<=[.?!])\s+/)[0];
      const words = firstSentence.split(' ');
      if (wordCount + words.length < 130) {
        oneMinRead += firstSentence + ' ';
        wordCount += words.length;
      } else {
        break;
      }
    }
    oneMinRead = oneMinRead.trim();

    // 3. Highlight Quotes: Extract best quote or profound sentence
    let highlights = [];
    if (blockquotes.length > 0) {
      highlights.push(blockquotes[0]);
    } else if (paragraphs.length > 1) {
      // Find a short, punchy paragraph as a highlight
      const punchy = paragraphs.find(p => p.length > 40 && p.length < 120);
      highlights.push(punchy || paragraphs[1]);
    }

    return {
      summary,
      oneMinRead,
      highlights
    };
  },

  /**
   * Inject highlights dynamically into article body DOM
   * @param {HTMLElement} container - The article body container
   * @param {Array} highlights - Array of highlight strings
   */
  injectHighlights: function(container, highlights) {
    if (!container || !highlights || highlights.length === 0) return;
    
    const paragraphs = container.querySelectorAll('p');
    if (paragraphs.length >= 3) {
      const injectIndex = Math.floor(paragraphs.length / 2); // Middle of article
      
      const highlightBox = document.createElement('div');
      highlightBox.className = 'micro-highlight-box';
      highlightBox.innerHTML = `
        <div class="micro-highlight-icon">✨</div>
        <div class="micro-highlight-text">"${highlights[0]}"</div>
      `;
      
      paragraphs[injectIndex].parentNode.insertBefore(highlightBox, paragraphs[injectIndex]);
    }
  }
};

window.MicroContent = MicroContent;
