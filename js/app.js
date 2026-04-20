// ==========================================================
// app.js — Homepage Logic
// ==========================================================

let allArticles = [];
let filteredArticles = [];
let allShorts = [];
let allWriters = [];
let currentPage = 1;
const PER_PAGE = 6;
let activeCategory = 'All';

// ── Preloader State ────────────────────────────────────
const loadingState = { articles: false, shorts: false, writers: false };
let preloaderTimeout;

function checkPreloader(key) {
  loadingState[key] = true;
  if (loadingState.articles && loadingState.shorts && loadingState.writers) {
    const preloader = document.getElementById('global-preloader');
    if (preloader) preloader.classList.add('hidden');
    clearTimeout(preloaderTimeout);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  preloaderTimeout = setTimeout(() => {
    const preloader = document.getElementById('global-preloader');
    if (preloader && !preloader.classList.contains('hidden')) {
      const text = document.getElementById('preloader-text');
      const retryBtn = document.getElementById('preloader-retry');
      const spinner = document.querySelector('.spinner');

      if (text) {
        text.textContent = "Network seems slow. Please check your connection.";
        text.classList.add('error');
      }
      if (spinner) spinner.style.animationDuration = '3s';
      if (retryBtn) retryBtn.style.display = 'inline-block';
    }
  }, 8000);
});

// ── Theme ──────────────────────────────────────────────
const root = document.documentElement;
const themeBtn = document.getElementById('theme-toggle');
const savedTheme = localStorage.getItem('theme') || 'light';
root.setAttribute('data-theme', savedTheme);
themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

themeBtn.addEventListener('click', () => {
  const current = root.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  themeBtn.textContent = next === 'dark' ? '☀️' : '🌙';
});

// ── Scroll Progress ────────────────────────────────────
const bar = document.getElementById('progress-bar');
window.addEventListener('scroll', () => {
  const h = document.documentElement.scrollHeight - window.innerHeight;
  bar.style.width = h > 0 ? (window.scrollY / h * 100) + '%' : '0%';
});

// ── Toast ──────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Format Date ────────────────────────────────────────
function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ── Reading Time ───────────────────────────────────────
function readingTime(content) {
  const words = content ? content.replace(/<[^>]+>/g, '').split(/\s+/).length : 0;
  return Math.max(1, Math.ceil(words / 200));
}

// ── Bookmarks (Firestore-only, auth-required) ─────────
let userBookmarkIds = new Set(); // live set of bookmarked article IDs
let _bookmarkUnsub = null;       // Firestore listener cleanup

// Listen for auth changes to load/unload user bookmarks
auth.onAuthStateChanged(function(user) {
  if (_bookmarkUnsub) { _bookmarkUnsub(); _bookmarkUnsub = null; }
  userBookmarkIds.clear();

  if (user) {
    // Real-time listener on this user's bookmarks
    _bookmarkUnsub = db.collection('bookmarks')
      .where('userId', '==', user.uid)
      .onSnapshot(function(snap) {
        userBookmarkIds.clear();
        snap.docs.forEach(function(doc) {
          userBookmarkIds.add(doc.data().articleId);
        });
        // Re-render article grids so bookmark icons update
        if (typeof applyFilter === 'function') applyFilter();
        if (typeof renderFeaturedGrid === 'function') renderFeaturedGrid(allArticles);
      }, function(err) {
        console.error('Bookmarks listener error:', err);
      });
  } else {
    // Not logged in — re-render to clear bookmark icons
    if (typeof applyFilter === 'function') applyFilter();
    if (typeof renderFeaturedGrid === 'function') renderFeaturedGrid(allArticles);
  }
});

function isBookmarked(id) { return userBookmarkIds.has(id); }

function handleBookmark(id, btn) {
  // Must be logged in
  if (!auth.currentUser) {
    showAuthModal('login');
    return;
  }
  var uid = auth.currentUser.uid;
  var docId = uid + '_' + id;
  var span = btn.querySelector('span');

  if (userBookmarkIds.has(id)) {
    // Remove bookmark
    db.collection('bookmarks').doc(docId).delete()
      .then(function() { showToast('Bookmark removed'); })
      .catch(function(e) { console.error(e); showToast('Error removing bookmark'); });
    // Optimistic UI
    userBookmarkIds.delete(id);
    if (span) { span.textContent = '🏷️'; span.className = ''; }
  } else {
    // Add bookmark
    db.collection('bookmarks').doc(docId).set({
      userId: uid,
      articleId: id,
      savedAt: firebase.firestore.FieldValue.serverTimestamp()
    })
      .then(function() { showToast('Article bookmarked ✓'); })
      .catch(function(e) { console.error(e); showToast('Error bookmarking'); });
    // Optimistic UI
    userBookmarkIds.add(id);
    if (span) { span.textContent = '🔖'; span.className = 'bookmarked'; }
  }
}
window.handleBookmark = handleBookmark;

// ── Article Card HTML ──────────────────────────────────
function cardHTML(art, featured) {
  if (featured === undefined) featured = false;
  var bm = isBookmarked(art.id);
  var rt = readingTime(art.content);
  var imgSrc = art.image || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format';
  if (featured) {
    return '<div class="article-card card-featured" id="card-' + art.id + '">' +
      '<img class="card-img" src="' + imgSrc + '" alt="' + art.title + '" loading="lazy">' +
      '<div class="card-body">' +
        '<div class="card-category">' + (art.category || 'General') + '</div>' +
        '<a class="card-title" href="pages/article.html?id=' + art.id + '">' + art.title + '</a>' +
        '<p class="card-excerpt">' + (art.excerpt || '') + '</p>' +
        '<div class="card-meta">' +
          '<span>' + formatDate(art.createdAt) + ' · ' + rt + ' min read</span>' +
          '<div class="card-actions">' +
            '<button onclick="handleBookmark(\'' + art.id + '\', this)" title="Bookmark">' +
              '<span class="' + (bm ? 'bookmarked' : '') + '">' + (bm ? '🔖' : '🏷️') + '</span>' +
            '</button>' +
            '<button>❤️ ' + (art.likes || 0) + '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }
  return '<div class="article-card fade-up" id="card-' + art.id + '">' +
    '<img class="card-img" src="' + imgSrc + '" alt="' + art.title + '" loading="lazy">' +
    '<div class="card-body">' +
      '<div class="card-category">' + (art.category || 'General') + '</div>' +
      '<a class="card-title" href="pages/article.html?id=' + art.id + '">' + art.title + '</a>' +
      '<p class="card-excerpt">' + (art.excerpt || '') + '</p>' +
      '<div class="card-meta">' +
        '<span>' + formatDate(art.createdAt) + ' · ' + rt + ' min read</span>' +
        '<div class="card-actions">' +
          '<button onclick="handleBookmark(\'' + art.id + '\', this)" title="Bookmark">' +
            '<span class="' + (bm ? 'bookmarked' : '') + '">' + (bm ? '🔖' : '🏷️') + '</span>' +
          '</button>' +
          '<button>❤️ ' + (art.likes || 0) + '</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

// ── Render Featured Carousel ───────────────────────────
let carouselInterval = null;
let currentSlide = 0;

function renderHeroCarousel(articles) {
  const track = document.getElementById('hero-carousel-track');
  const nav = document.getElementById('carousel-nav');
  if (!track) return;

  const featured = articles.filter(a => a.featured).slice(0, 5); // Up to 5 featured articles
  if (!featured.length) {
    track.innerHTML = '<div class="carousel-slide"><div class="carousel-card"><div class="carousel-content"><h2>Welcome to Noor Al-Quran</h2></div></div></div>';
    if (nav) nav.innerHTML = '';
    return;
  }

  track.innerHTML = featured.map((art, idx) => {
    const imgSrc = art.image || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&auto=format';
    return `
      <div class="carousel-slide" data-index="${idx}">
        <div class="carousel-card">
          <img src="${imgSrc}" alt="${art.title}">
          <div class="carousel-overlay"></div>
          <div class="carousel-content">
            <div class="carousel-category">${art.category || 'General'}</div>
            <a href="pages/article.html?id=${art.id}" class="carousel-title">${art.title}</a>
            <p class="carousel-excerpt">${art.excerpt || ''}</p>
            
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (featured.length > 1 && nav) {
    nav.innerHTML = featured.map((_, idx) => `
      <button class="carousel-dot ${idx === 0 ? 'active' : ''}" onclick="goToSlide(${idx})" aria-label="Go to slide ${idx + 1}"></button>
    `).join('');
    startCarousel();
  } else if (nav) {
    nav.innerHTML = '';
  }
}

function goToSlide(index) {
  const track = document.getElementById('hero-carousel-track');
  const dots = document.querySelectorAll('.carousel-dot');
  if (!track) return;

  currentSlide = index;
  track.style.transform = `translateX(-${index * 100}%)`;

  dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
  startCarousel(); // Reset interval when manually navigating
}
window.goToSlide = goToSlide;

function prevCarouselSlide() {
  const slidesCount = document.querySelectorAll('.carousel-slide').length;
  if (slidesCount <= 1) return;
  let prev = currentSlide - 1;
  if (prev < 0) prev = slidesCount - 1;
  goToSlide(prev);
}
window.prevCarouselSlide = prevCarouselSlide;

function nextCarouselSlide() {
  const slidesCount = document.querySelectorAll('.carousel-slide').length;
  if (slidesCount <= 1) return;
  let next = currentSlide + 1;
  if (next >= slidesCount) next = 0;
  goToSlide(next);
}
window.nextCarouselSlide = nextCarouselSlide;

function startCarousel() {
  if (carouselInterval) clearInterval(carouselInterval);
  const slidesCount = document.querySelectorAll('.carousel-slide').length;
  if (slidesCount <= 1) return;

  carouselInterval = setInterval(() => {
    let next = currentSlide + 1;
    if (next >= slidesCount) next = 0;
    goToSlide(next);
  }, 6000); // 6 seconds per slide
}

// ── Carousel Swipe Support ──────────────────────────────
let touchStartX = 0;
let touchEndX = 0;

function handleCarouselSwipe() {
  const swipeThreshold = 50;
  if (touchEndX < touchStartX - swipeThreshold) {
    nextCarouselSlide();
  }
  if (touchEndX > touchStartX + swipeThreshold) {
    prevCarouselSlide();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const carousel = document.querySelector('.hero-carousel');
  if (carousel) {
    carousel.addEventListener('touchstart', e => {
      touchStartX = e.changedTouches[0].screenX;
    }, {passive: true});
    
    carousel.addEventListener('touchend', e => {
      touchEndX = e.changedTouches[0].screenX;
      handleCarouselSwipe();
    }, {passive: true});
    
    // Mouse drag support
    let isDragging = false;
    carousel.addEventListener('mousedown', e => {
      isDragging = true;
      touchStartX = e.screenX;
    });
    
    carousel.addEventListener('mouseup', e => {
      if (!isDragging) return;
      isDragging = false;
      touchEndX = e.screenX;
      handleCarouselSwipe();
    });
    
    carousel.addEventListener('mouseleave', e => {
      if (!isDragging) return;
      isDragging = false;
    });
  }
});

// ── Render Featured Grid ───────────────────────────────
function renderFeaturedGrid(articles) {
  const grid = document.getElementById('featured-grid');
  if (!grid) return;
  const featured = articles.filter(a => a.featured).slice(0, 3);
  if (!featured.length) { grid.innerHTML = '<p style="color:var(--text-muted)">No featured articles yet.</p>'; return; }
  grid.innerHTML = featured.map((a, i) => i === 0 ? cardHTML(a, true) : cardHTML(a)).join('');
}

// ── Render Articles Grid ───────────────────────────────
function renderGrid(articles) {
  const grid = document.getElementById('articles-grid');
  if (!articles.length) {
    grid.innerHTML = '<div class="empty-state"><div class="icon">📜</div><p>No articles found.</p></div>';
    document.getElementById('pagination').innerHTML = '';
    return;
  }
  const start = (currentPage - 1) * PER_PAGE;
  const page = articles.slice(start, start + PER_PAGE);
  grid.innerHTML = page.map(a => cardHTML(a)).join('');
  renderPagination(articles.length);
}

// ── Pagination ─────────────────────────────────────────
function renderPagination(total) {
  const pages = Math.ceil(total / PER_PAGE);
  const p = document.getElementById('pagination');
  if (pages <= 1) { p.innerHTML = ''; return; }
  let html = '';
  for (let i = 1; i <= pages; i++) {
    html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
  }
  p.innerHTML = html;
}
function goPage(n) { currentPage = n; renderGrid(filteredArticles); window.scrollTo({ top: document.getElementById('articles').offsetTop - 80, behavior: 'smooth' }); }

// ── Category Filter (pills — secondary, synced) ───────
document.getElementById('categories').addEventListener('click', e => {
  if (!e.target.classList.contains('pill')) return;
  selectTopic(e.target.dataset.cat);
});

// ── selectTopic — single source of truth ──────────────
function selectTopic(cat) {
  activeCategory = cat;
  currentPage = 1;

  // Sync topic cards
  document.querySelectorAll('.topic-card').forEach(card => {
    card.classList.toggle('active', card.dataset.cat === cat);
  });

  // Sync pills
  document.querySelectorAll('.pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.cat === cat);
  });

  // Active filter bar (in articles section)
  const bar = document.getElementById('topic-active-bar');
  const label = document.getElementById('active-topic-label');
  const resetBtn = document.getElementById('reset-topic-btn');
  const heading = document.getElementById('articles-heading');
  const subtitle = document.getElementById('articles-subtitle');

  if (cat === 'All') {
    bar?.classList.remove('visible');
    resetBtn?.classList.add('hidden');
    if (heading) heading.textContent = 'All Articles';
    if (subtitle) subtitle.textContent = 'Browse all writings by category or search above.';
  } else {
    if (label) label.textContent = cat;
    bar?.classList.add('visible');
    resetBtn?.classList.remove('hidden');
    if (heading) heading.textContent = cat;
    const descs = {
      Tafsir: 'Verse-by-verse analysis and scholarly interpretation.',
      Reflection: 'Personal and thematic reflections on Qur\'anic themes.',
      Stories: 'Narratives of prophets and Qur\'anic parables.',
      Lessons: 'Practical spiritual guidance drawn from the Qur\'an.'
    };
    if (subtitle) subtitle.textContent = descs[cat] || '';
  }

  // Scroll to articles section smoothly
  if (cat !== 'All') {
    const articlesEl = document.getElementById('articles');
    if (articlesEl) setTimeout(() => articlesEl.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  applyFilter();
}
window.selectTopic = selectTopic;

// ── Search ─────────────────────────────────────────────
let searchTimeout;
document.getElementById('search-input').addEventListener('input', e => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => { currentPage = 1; applyFilter(e.target.value.trim()); }, 280);
});

function applyFilter(query = document.getElementById('search-input').value.trim()) {
  let results = [...allArticles];
  if (activeCategory !== 'All') results = results.filter(a => a.category === activeCategory);
  if (query) {
    const q = query.toLowerCase();
    results = results.filter(a =>
      (a.title || '').toLowerCase().includes(q) ||
      (a.excerpt || '').toLowerCase().includes(q) ||
      (a.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }
  filteredArticles = results;
  renderGrid(filteredArticles);
}

// ── Update Topic Card Counts ───────────────────────────
function updateTopicCounts(articles) {
  const cats = ['Tafsir', 'Reflection', 'Stories', 'Lessons'];
  cats.forEach(cat => {
    const count = articles.filter(a => a.category === cat).length;
    const el = document.getElementById('count-' + cat);
    if (el) el.textContent = count + (count === 1 ? ' article' : ' articles');
  });
}

// ── Load Articles from Firestore ───────────────────────
function loadArticles() {
  db.collection('articles')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      allArticles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      filteredArticles = [...allArticles];
      renderHeroCarousel(allArticles);
      renderFeaturedGrid(allArticles);
      updateTopicCounts(allArticles);
      applyFilter();
      checkPreloader('articles');
    }, err => {
      console.error('Firestore error:', err);
      document.getElementById('articles-grid').innerHTML =
        '<div class="empty-state"><div class="icon">⚠️</div><p>Could not load articles. Check Firebase config.</p></div>';
      checkPreloader('articles');
    });
}

// ── Spiritual Shorts ───────────────────────────────────
function loadShorts() {
  db.collection('shorts')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      allShorts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderShorts();
      showVerseOfTheDay();
      checkPreloader('shorts');
    }, err => {
      console.error('Shorts error:', err);
      checkPreloader('shorts');
    });
}

function renderShorts() {
  const track = document.getElementById('shorts-track');
  if (!track) return;

  if (!allShorts.length) {
    track.innerHTML = '<div class="empty-state" style="width:100%;"><p>No shorts added yet.</p></div>';
    return;
  }

  track.innerHTML = allShorts.map((short, index) => {
    // If arabic text exists, display it prominently
    const arabicHtml = short.arabic ? `<div class="short-arabic">${short.arabic}</div>` : '';
    return `
    <div class="short-card" data-theme="${short.theme || 'emerald'}" onclick="openStory(${index})">
      
      <div class="short-content">
        ${arabicHtml}
        <div>${short.content}</div>
        ${short.source ? `<div class="short-source">${short.source}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function scrollShorts(direction) {
  const wrapper = document.getElementById('shorts-wrapper');
  if (!wrapper) return;
  // Scroll by the width of one card + gap
  const scrollAmount = 320 + 24;
  wrapper.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
}
window.scrollShorts = scrollShorts;

// ── Verse of the Day ───────────────────────────────────
function showVerseOfTheDay() {
  if (!allShorts.length) return;

  const today = new Date().toDateString();
  const lastVotdDate = localStorage.getItem('lastVotdDate');

  if (lastVotdDate === today) return; // Already seen today

  // Pick a random short that has arabic text
  const shortsWithArabic = allShorts.filter(s => s.arabic);
  const pool = shortsWithArabic.length ? shortsWithArabic : allShorts;
  const randomShort = pool[Math.floor(Math.random() * pool.length)];

  if (!randomShort) return;

  // Inject HTML if not exists
  if (!document.getElementById('votd-overlay')) {
    const html = `
    <div class="votd-overlay" id="votd-overlay">
      <div class="votd-modal">
        <button class="votd-close" onclick="closeVerseOfTheDay()" aria-label="Close">✕</button>
        <div class="votd-badge">Verse of the Day</div>
        ${randomShort.arabic ? `<div class="votd-arabic">${randomShort.arabic}</div>` : ''}
        <div class="votd-translation">"${randomShort.content}"</div>
        ${randomShort.source ? `<div class="votd-source">— ${randomShort.source}</div>` : ''}
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    // Close on backdrop click
    document.getElementById('votd-overlay').addEventListener('click', e => {
      if (e.target.id === 'votd-overlay') closeVerseOfTheDay();
    });
  }

  // Show modal
  setTimeout(() => {
    document.getElementById('votd-overlay').classList.add('visible');
  }, 1000); // slight delay after page load for dramatic effect

  // Set local storage so it doesn't show again today
  localStorage.setItem('lastVotdDate', today);
}

function closeVerseOfTheDay() {
  const overlay = document.getElementById('votd-overlay');
  if (overlay) {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 400); // clean up DOM after transition
  }
}
window.closeVerseOfTheDay = closeVerseOfTheDay;

// ── Writers on Homepage ────────────────────────────────
function loadWriters() {
  db.collection('writers')
    .orderBy('followerCount', 'desc')
    .onSnapshot(snapshot => {
      allWriters = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderWriters();
      checkPreloader('writers');
    }, err => {
      console.error('Writers error:', err);
      checkPreloader('writers');
    });
}

function renderWriters() {
  const track = document.getElementById('writers-track');
  if (!track) return;

  if (!allWriters.length) {
    track.innerHTML = '<div class="empty-state" style="width:100%;"><p>No writers yet.</p></div>';
    return;
  }

  track.innerHTML = allWriters.map(w => {
    const avatarContent = w.avatar
      ? `<img src="${w.avatar}" alt="${w.name}" style="width:100%;height:100%;object-fit:cover">`
      : w.name[0].toUpperCase();
    // Dynamically calculate the accurate article count
    const articleCount = allArticles.filter(a => a.writerId === w.id).length;

    return `
    <a href="pages/profile.html?id=${w.id}" class="writer-card">
      <div class="wc-avatar">${avatarContent}</div>
      <div class="wc-name">${w.name}</div>
      <div class="wc-title">${w.title || ''}</div>
      <div class="wc-stats">
        <span>📝 ${articleCount} ${articleCount === 1 ? 'article' : 'articles'}</span>
        <span>👥 ${w.followerCount || 0} followers</span>
      </div>
    </a>`;
  }).join('');
}

function scrollWriters(direction) {
  const wrapper = document.getElementById('writers-wrapper');
  if (!wrapper) return;
  const scrollAmount = 320 + 24;
  wrapper.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
}
window.scrollWriters = scrollWriters;

loadArticles();
loadShorts();
loadWriters();

// ── Story Viewer (Mobile Only) ─────────────────────────
let currentStoryIndex = 0;
let storyTimer;
const STORY_DURATION = 12000; // 12 seconds
let storyStartTime;

function openStory(index) {
  // Only open on mobile
  if (window.innerWidth > 768) return;

  const overlay = document.getElementById('story-overlay');
  if (!overlay) return;
  
  currentStoryIndex = index;
  renderStory();
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden'; // prevent background scrolling
}
window.openStory = openStory;

function closeStory() {
  const overlay = document.getElementById('story-overlay');
  if (!overlay) return;

  clearTimeout(storyTimer);
  overlay.classList.add('hidden');
  document.body.style.overflow = '';
}
window.closeStory = closeStory;

function nextStory() {
  if (currentStoryIndex < allShorts.length - 1) {
    currentStoryIndex++;
    renderStory();
  } else {
    closeStory();
  }
}
window.nextStory = nextStory;

function prevStory() {
  if (currentStoryIndex > 0) {
    currentStoryIndex--;
    renderStory();
  } else {
    // Replay current if it's the first one
    renderStory();
  }
}
window.prevStory = prevStory;

function renderStory() {
  const short = allShorts[currentStoryIndex];
  if (!short) return;

  // Render progress bars
  const progressContainer = document.getElementById('story-progress-container');
  if (progressContainer) {
    progressContainer.innerHTML = allShorts.map((_, i) => {
      let fillClass = '';
      if (i < currentStoryIndex) fillClass = 'completed';
      else if (i === currentStoryIndex) fillClass = 'active';

      return `
        <div class="story-progress-segment">
          <div class="story-progress-fill ${fillClass}" id="story-progress-${i}"></div>
        </div>
      `;
    }).join('');
    
    // Force reflow to restart animation on the active segment if needed
    const activeFill = document.getElementById(`story-progress-${currentStoryIndex}`);
    if (activeFill) {
      activeFill.classList.remove('active');
      void activeFill.offsetWidth; // force reflow
      activeFill.classList.add('active');
    }
  }

  // Render content
  const contentWrapper = document.getElementById('story-content-wrapper');
  if (contentWrapper) {
    const arabicHtml = short.arabic ? `<div class="story-arabic">${short.arabic}</div>` : '';
    const theme = short.theme || 'emerald';
    
    // Set theme gradient
    let bgGradient = 'linear-gradient(135deg, #1B4332 0%, #0F1A14 100%)'; // default emerald
    if (theme === 'gold') bgGradient = 'linear-gradient(135deg, #D4A853 0%, #8C6A2E 100%)';
    if (theme === 'ocean') bgGradient = 'linear-gradient(135deg, #023E8A 0%, #001233 100%)';
    contentWrapper.style.background = bgGradient;

    contentWrapper.innerHTML = `
      <div class="story-card-content fade-up">
        ${arabicHtml}
        <div class="story-text">${short.content}</div>
        ${short.source ? `<div class="story-source">— ${short.source}</div>` : ''}
      </div>
    `;
  }

  // Set auto-advance timer
  clearTimeout(storyTimer);
  storyTimer = setTimeout(nextStory, STORY_DURATION);
}
