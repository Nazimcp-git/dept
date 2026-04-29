// ==========================================================
// cognitive.js — Cognitive State Detection (Scroll, hesitation)
// ==========================================================

const CognitiveState = {
  state: {
    lastScrollY: 0,
    lastScrollTime: Date.now(),
    mouseLastMove: Date.now(),
    readStartTime: Date.now(),
    isReading: true,
    hasShownQuickSummary: false,
    hasShownSimpler: false,
    hasShownAdvanced: false,
  },

  init: function () {
    this.bindEvents();
    this.startTimers();
    this.injectUI();
  },

  injectUI: function () {
    const ui = document.createElement('div');
    ui.id = 'cognitive-ui-container';
    ui.innerHTML = `
      <div id="cog-toast" class="cognitive-toast hidden">
        <div class="cog-icon">💡</div>
        <div class="cog-content">
          <h4 id="cog-title">Suggestion</h4>
          <p id="cog-desc">...</p>
        </div>
        <button id="cog-action" class="btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">Show Me</button>
        <button id="cog-close" class="btn-icon" style="margin-left: 0.5rem; color: #888;">✕</button>
      </div>
    `;
    document.body.appendChild(ui);

    document.getElementById('cog-close').addEventListener('click', () => {
      document.getElementById('cog-toast').classList.add('hidden');
    });
  },

  showToast: function (title, desc, btnText, actionCallback) {
    const toast = document.getElementById('cog-toast');
    if (!toast) return;

    document.getElementById('cog-title').textContent = title;
    document.getElementById('cog-desc').textContent = desc;

    const actionBtn = document.getElementById('cog-action');
    actionBtn.textContent = btnText;

    // Clear old listeners
    const newBtn = actionBtn.cloneNode(true);
    actionBtn.parentNode.replaceChild(newBtn, actionBtn);

    newBtn.addEventListener('click', () => {
      toast.classList.add('hidden');
      if (actionCallback) actionCallback();
    });

    toast.classList.remove('hidden');

    // Auto hide after 8s
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 8000);
  },

  bindEvents: function () {
    // 1. Track scroll speed
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      const now = Date.now();
      const currentY = window.scrollY;

      if (now - this.state.lastScrollTime > 100) {
        const distance = Math.abs(currentY - this.state.lastScrollY);
        const timeDiff = (now - this.state.lastScrollTime) / 1000; // seconds
        const speed = distance / timeDiff; // pixels per second

        // If scrolling very fast (> 2500px/s)
        if (speed > 2500 && !this.state.hasShownQuickSummary) {
          this.state.hasShownQuickSummary = true;
          this.showToast(
            'In a hurry?',
            'Read the 1-minute version of this article.',
            '1-Min Read',
            () => {
              // Trigger AI Summary or 1-min read display
              const summaryBtn = document.getElementById('ai-summary-btn');
              if (summaryBtn) summaryBtn.click();
              else showToast('Try Ai Summury'),
                window.location.hash = "#ai-summary-container";
            }
          );
        }

        this.state.lastScrollY = currentY;
        this.state.lastScrollTime = now;
      }

      // Reset mouse idle timer on scroll
      this.state.mouseLastMove = Date.now();
    }, { passive: true });

    // 2. Track mouse movement for hesitation
    document.addEventListener('mousemove', () => {
      this.state.mouseLastMove = Date.now();
    });
  },

  startTimers: function () {
    setInterval(() => {
      const now = Date.now();

      // Check hesitation (No mouse movement for 15s)
      if (!this.state.hasShownSimpler && (now - this.state.mouseLastMove > 15000)) {
        // Only trigger if they are somewhat into the article (scrolled down)
        if (window.scrollY > 300) {
          this.state.hasShownSimpler = true;
          this.showToast(
            'Need a simpler explanation?',
            'We can break down this concept for you.',
            'Simplify',
            () => showToast('Simpler version activated (Mock)')
          );
        }
      }

      // Check deep engagement (Reading for > 2 mins without fast scrolling)
      if (!this.state.hasShownAdvanced && (now - this.state.readStartTime > 120000)) {
        this.state.hasShownAdvanced = true;
        this.showToast(
          'Deep Dive',
          'You seem very interested in this. Want to explore advanced Tafsir?',
          'Explore',
          () => window.location.href = 'articles.html?category=Tafsir'
        );
      }

    }, 5000);
  }
};

window.addEventListener('DOMContentLoaded', () => {
  // Only init on article pages
  if (document.querySelector('.article-body')) {
    CognitiveState.init();
  }
});
