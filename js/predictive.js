// ==========================================================
// predictive.js — Predictive Content Engine
// ==========================================================

const PredictiveEngine = {
  HISTORY_KEY: 'noor_reading_history',

  // Log a category view
  logView: function(category) {
    if (!category) return;
    let history = JSON.parse(localStorage.getItem(this.HISTORY_KEY) || '[]');
    history.push({ category, timestamp: Date.now() });
    
    // Keep only last 50 entries
    if (history.length > 50) history = history.slice(-50);
    localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
  },

  // Analyze history and return predicted categories
  getPredictedCategories: function() {
    let history = JSON.parse(localStorage.getItem(this.HISTORY_KEY) || '[]');
    if (history.length === 0) return ['Tafsir', 'Stories']; // Defaults
    
    // Count frequencies
    const counts = {};
    history.forEach(item => {
      counts[item.category] = (counts[item.category] || 0) + 1;
    });

    // Sort by most viewed
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    
    // Time of day modifier
    const hour = new Date().getHours();
    let timeSuggestion = null;
    if (hour >= 5 && hour < 10) timeSuggestion = 'Reflection'; // Morning
    if (hour >= 20 || hour < 2) timeSuggestion = 'Stories';    // Night

    let predictions = sorted.map(k => k[0]);
    if (timeSuggestion && !predictions.includes(timeSuggestion)) {
      predictions.unshift(timeSuggestion);
    }
    
    return predictions.slice(0, 3);
  },

  // Inject recommendation UI under a search bar
  injectSearchSuggestions: function(searchInputId, allArticles) {
    const input = document.getElementById(searchInputId);
    if (!input || !allArticles || allArticles.length === 0) return;

    // Create wrapper if not exists
    let wrapper = document.getElementById('predictive-suggestions-wrapper');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = 'predictive-suggestions-wrapper';
      wrapper.className = 'predictive-suggestions hidden';
      input.parentNode.style.position = 'relative';
      input.parentNode.appendChild(wrapper);
    }

    input.addEventListener('focus', () => {
      if (input.value.trim() === '') {
        this.renderSuggestions(wrapper, allArticles);
      }
    });

    input.addEventListener('input', () => {
      if (input.value.trim() !== '') {
        wrapper.classList.add('hidden');
      } else {
        this.renderSuggestions(wrapper, allArticles);
      }
    });

    // Hide when clicking outside
    document.addEventListener('click', (e) => {
      if (e.target !== input && !wrapper.contains(e.target)) {
        wrapper.classList.add('hidden');
      }
    });
  },

  renderSuggestions: function(wrapper, allArticles) {
    const categories = this.getPredictedCategories();
    
    // Find one article for each predicted category
    const suggestions = [];
    for (let cat of categories) {
      const art = allArticles.find(a => a.category === cat);
      if (art && !suggestions.find(s => s.id === art.id)) {
        suggestions.push(art);
      }
    }
    
    if (suggestions.length === 0) {
      // Fallback
      suggestions.push(...allArticles.slice(0, 3));
    }

    wrapper.innerHTML = `
      <div class="predictive-header">🔮 You might need this next...</div>
      <div class="predictive-list">
        ${suggestions.map(s => `
          <a href="article.html?id=${s.id}" class="predictive-item">
            <span class="pred-cat">${s.category || 'Read'}</span>
            <span class="pred-title">${s.title}</span>
          </a>
        `).join('')}
      </div>
    `;
    
    wrapper.classList.remove('hidden');
  }
};

window.PredictiveEngine = PredictiveEngine;
