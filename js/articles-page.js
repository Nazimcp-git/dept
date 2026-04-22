// ==========================================================
// articles-page.js — Logic for the Dedicated Articles Page
// ==========================================================

let allArticles = [];
let filteredArticles = [];
let allWriters = [];
let currentPage = 1;
const PER_PAGE = 9; // Display 9 articles per page on the dedicated page

// ── Preloader State ────────────────────────────────────
const loadingState = { articles: false, writers: false };
let preloaderTimeout;

function checkPreloader(key) {
  loadingState[key] = true;
  if (loadingState.articles && loadingState.writers) {
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

// ── Bookmarks ─────────────────────────────────────────
let userBookmarkIds = new Set();
let _bookmarkUnsub = null;

auth.onAuthStateChanged(function(user) {
  if (_bookmarkUnsub) { _bookmarkUnsub(); _bookmarkUnsub = null; }
  userBookmarkIds.clear();

  if (user) {
    _bookmarkUnsub = db.collection('bookmarks')
      .where('userId', '==', user.uid)
      .onSnapshot(function(snap) {
        userBookmarkIds.clear();
        snap.docs.forEach(function(doc) {
          userBookmarkIds.add(doc.data().articleId);
        });
        applyFilters(); // Re-render to update bookmark icons
      }, function(err) {
        console.error('Bookmarks listener error:', err);
      });
  } else {
    applyFilters();
  }
});

function isBookmarked(id) { return userBookmarkIds.has(id); }

function handleBookmark(id, btn) {
  if (!auth.currentUser) {
    showAuthModal('login');
    return;
  }
  var uid = auth.currentUser.uid;
  var docId = uid + '_' + id;
  var span = btn.querySelector('span');

  if (userBookmarkIds.has(id)) {
    db.collection('bookmarks').doc(docId).delete()
      .then(() => showToast('Bookmark removed'))
      .catch(e => { console.error(e); showToast('Error removing bookmark'); });
    userBookmarkIds.delete(id);
    if (span) { span.textContent = '🏷️'; span.className = ''; }
  } else {
    db.collection('bookmarks').doc(docId).set({
      userId: uid,
      articleId: id,
      savedAt: firebase.firestore.FieldValue.serverTimestamp()
    })
      .then(() => showToast('Article bookmarked ✓'))
      .catch(e => { console.error(e); showToast('Error bookmarking'); });
    userBookmarkIds.add(id);
    if (span) { span.textContent = '🔖'; span.className = 'bookmarked'; }
  }
}
window.handleBookmark = handleBookmark;

// ── Article Card HTML ──────────────────────────────────
function cardHTML(art) {
  var bm = isBookmarked(art.id);
  var rt = readingTime(art.content);
  var imgSrc = art.image || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format';
  
  return '<div class="article-card fade-up" id="card-' + art.id + '">' +
    '<img class="card-img" src="' + imgSrc + '" alt="' + art.title + '" loading="lazy">' +
    '<div class="card-body">' +
      '<div class="card-category">' + (art.category || 'General') + '</div>' +
      '<a class="card-title" href="article.html?id=' + art.id + '">' + art.title + '</a>' +
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

// ── Render Grid ────────────────────────────────────────
function renderGrid() {
  const grid = document.getElementById('all-articles-grid');
  if (!filteredArticles.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;"><div class="icon">📜</div><p>No articles found matching your criteria.</p></div>';
    document.getElementById('pagination').innerHTML = '';
    return;
  }
  
  const start = (currentPage - 1) * PER_PAGE;
  const page = filteredArticles.slice(start, start + PER_PAGE);
  grid.innerHTML = page.map(a => cardHTML(a)).join('');
  renderPagination(filteredArticles.length);
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

function goPage(n) { 
  currentPage = n; 
  renderGrid(); 
  window.scrollTo({ top: document.querySelector('.filter-container').offsetTop - 100, behavior: 'smooth' }); 
}
window.goPage = goPage;

// ── Filtering Logic ────────────────────────────────────
const searchInput = document.getElementById('article-search');
const categoryFilter = document.getElementById('category-filter');
const writerFilter = document.getElementById('writer-filter');
const activeFiltersBar = document.getElementById('active-filters-bar');
const activeFiltersLabel = document.getElementById('active-filters-label');
const resetFiltersBtn = document.getElementById('reset-filters-btn');

function applyFilters() {
  const query = searchInput.value.trim().toLowerCase();
  const category = categoryFilter.value;
  const writerId = writerFilter.value;

  filteredArticles = allArticles.filter(a => {
    // Search match
    const matchesSearch = !query || 
      (a.title || '').toLowerCase().includes(query) ||
      (a.excerpt || '').toLowerCase().includes(query) ||
      (a.tags || []).some(t => t.toLowerCase().includes(query));

    // Category match
    const matchesCategory = category === 'All' || a.category === category;

    // Writer match (using writerId or author field if we don't use referenced writers)
    // Some old articles have `author: "Editorial Team"`, new ones might use `writerId`
    let matchesWriter = true;
    if (writerId !== 'All') {
      matchesWriter = (a.writerId === writerId) || (a.author === writerId);
    }

    return matchesSearch && matchesCategory && matchesWriter;
  });

  // Update Summary Bar
  let filtersActive = false;
  let summaryText = [];
  
  if (category !== 'All') { summaryText.push(`in <strong>${category}</strong>`); filtersActive = true; }
  if (writerId !== 'All') { 
    const wName = writerFilter.options[writerFilter.selectedIndex].text;
    summaryText.push(`by <strong>${wName}</strong>`); 
    filtersActive = true; 
  }
  if (query) { summaryText.push(`matching "<strong>${query}</strong>"`); filtersActive = true; }

  if (filtersActive) {
    activeFiltersLabel.innerHTML = `Showing articles ${summaryText.join(' ')}`;
    resetFiltersBtn.style.display = 'inline-block';
  } else {
    activeFiltersLabel.innerHTML = `Showing all articles`;
    resetFiltersBtn.style.display = 'none';
  }

  currentPage = 1;
  renderGrid();
}

// Event Listeners for Filters
let searchTimeout;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(applyFilters, 300);
});

categoryFilter.addEventListener('change', applyFilters);
writerFilter.addEventListener('change', applyFilters);

resetFiltersBtn.addEventListener('click', () => {
  searchInput.value = '';
  categoryFilter.value = 'All';
  writerFilter.value = 'All';
  applyFilters();
});

// ── Load Data from Firestore ───────────────────────────

// Load Writers to populate filter
function loadWriters() {
  db.collection('writers')
    .orderBy('name')
    .get()
    .then(snapshot => {
      allWriters = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      let optionsHtml = '<option value="All">All Writers</option>';
      optionsHtml += '<option value="Editorial Team">Editorial Team</option>'; // For fallback
      
      allWriters.forEach(w => {
        optionsHtml += `<option value="${w.id}">${w.name}</option>`;
      });
      
      writerFilter.innerHTML = optionsHtml;
      
      // If a writer ID was passed in URL
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('writer')) {
        writerFilter.value = urlParams.get('writer');
      }

      checkPreloader('writers');
      // Re-apply filters just in case writer was passed via URL
      if (allArticles.length > 0) applyFilters();
    })
    .catch(err => {
      console.error('Error fetching writers:', err);
      checkPreloader('writers');
    });
}

function loadArticles() {
  db.collection('articles')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      allArticles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // If category passed in URL
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('category')) {
        categoryFilter.value = urlParams.get('category');
      }

      applyFilters();
      checkPreloader('articles');
    }, err => {
      console.error('Firestore error:', err);
      document.getElementById('all-articles-grid').innerHTML =
        '<div class="empty-state" style="grid-column: 1 / -1;"><div class="icon">⚠️</div><p>Could not load articles. Check Firebase connection.</p></div>';
      checkPreloader('articles');
    });
}

// Start loading
loadWriters();
loadArticles();
