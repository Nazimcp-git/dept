// ==========================================================
// bookmarks.js — Bookmarks Page Logic
// Auth-required. Firestore-only. No localStorage.
// ==========================================================

// ── Theme ──────────────────────────────────────────────
var root = document.documentElement;
var themeBtn = document.getElementById('theme-toggle');
var savedTheme = localStorage.getItem('theme') || 'light';
root.setAttribute('data-theme', savedTheme);
themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
themeBtn.addEventListener('click', function() {
  var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  themeBtn.textContent = next === 'dark' ? '☀️' : '🌙';
});

// ── Scroll Progress ────────────────────────────────────
var progressBar = document.getElementById('progress-bar');
window.addEventListener('scroll', function() {
  var h = document.documentElement.scrollHeight - window.innerHeight;
  progressBar.style.width = h > 0 ? (window.scrollY / h * 100) + '%' : '0%';
});

// ── Toast ──────────────────────────────────────────────
function showToast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, 2800);
}

// ── Helpers ────────────────────────────────────────────
function formatDate(ts) {
  if (!ts) return '';
  var d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function readingTime(content) {
  var words = content ? content.replace(/<[^>]+>/g, '').split(/\s+/).length : 0;
  return Math.max(1, Math.ceil(words / 200));
}

function timeAgo(ts) {
  if (!ts) return '';
  var d = ts.toDate ? ts.toDate() : new Date(ts);
  var diff = Date.now() - d.getTime();
  var mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  var hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  var days = Math.floor(hrs / 24);
  if (days < 30) return days + 'd ago';
  return formatDate(ts);
}

// ── State ──────────────────────────────────────────────
var bookmarkedArticles = [];
var filteredBookmarks = [];
var currentView = localStorage.getItem('bm-view') || 'grid';
var currentSort = localStorage.getItem('bm-sort') || 'newest';
var activeCategory = 'All';
var searchQuery = '';
var isLoading = true;
var _bmUnsub = null;

// ── Initialize ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  setView(currentView, false);
  document.getElementById('bm-sort').value = currentSort;

  // Search
  var searchTimeout;
  document.getElementById('bm-search').addEventListener('input', function(e) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(function() {
      searchQuery = e.target.value.trim();
      applyFilters();
    }, 250);
  });

  // Sort
  document.getElementById('bm-sort').addEventListener('change', function(e) {
    currentSort = e.target.value;
    localStorage.setItem('bm-sort', currentSort);
    applyFilters();
  });

  // Auth state — this is the main entry point
  auth.onAuthStateChanged(function(user) {
    // Clean up previous listener
    if (_bmUnsub) { _bmUnsub(); _bmUnsub = null; }

    if (user) {
      // User is logged in — load their bookmarks from Firestore
      hideAllEmptyStates();
      document.getElementById('bookmarks-toolbar').style.display = '';
      loadBookmarksRealtime(user.uid);
    } else {
      // Not logged in — show sign-in prompt
      bookmarkedArticles = [];
      filteredBookmarks = [];
      isLoading = false;
      showAuthRequired();
    }
  });
});

// ── Load Bookmarks in Real-time from Firestore ────────
function loadBookmarksRealtime(uid) {
  isLoading = true;

  _bmUnsub = db.collection('bookmarks')
    .where('userId', '==', uid)
    .onSnapshot(function(snapshot) {
      var bookmarkDocs = [];
      snapshot.docs.forEach(function(doc) {
        bookmarkDocs.push({
          bookmarkId: doc.id,
          articleId: doc.data().articleId,
          savedAt: doc.data().savedAt
        });
      });

      if (bookmarkDocs.length === 0) {
        bookmarkedArticles = [];
        isLoading = false;
        showEmptyState('empty');
        updateStats();
        return;
      }

      // Fetch the actual article data
      var articleIds = bookmarkDocs.map(function(b) { return b.articleId; });
      fetchArticles(articleIds, bookmarkDocs);

    }, function(err) {
      console.error('Bookmarks listener error:', err);
      isLoading = false;
      showEmptyState('empty');
    });
}

// ── Fetch Article Data by IDs ─────────────────────────
function fetchArticles(articleIds, bookmarkDocs) {
  var articles = [];
  var batches = [];

  // Split into batches of 10 (Firestore 'in' limit)
  for (var i = 0; i < articleIds.length; i += 10) {
    batches.push(articleIds.slice(i, i + 10));
  }

  var completed = 0;
  if (batches.length === 0) {
    finishLoading([]);
    return;
  }

  batches.forEach(function(batchIds) {
    db.collection('articles')
      .where(firebase.firestore.FieldPath.documentId(), 'in', batchIds)
      .get()
      .then(function(snap) {
        snap.docs.forEach(function(doc) {
          var bmDoc = null;
          for (var j = 0; j < bookmarkDocs.length; j++) {
            if (bookmarkDocs[j].articleId === doc.id) {
              bmDoc = bookmarkDocs[j];
              break;
            }
          }
          var data = doc.data();
          data.id = doc.id;
          data.bookmarkId = bmDoc ? bmDoc.bookmarkId : doc.id;
          data.savedAt = bmDoc ? bmDoc.savedAt : null;
          articles.push(data);
        });
        completed++;
        if (completed === batches.length) {
          finishLoading(articles);
        }
      })
      .catch(function(e) {
        console.error('Article fetch error:', e);
        completed++;
        if (completed === batches.length) {
          finishLoading(articles);
        }
      });
  });
}

function finishLoading(articles) {
  bookmarkedArticles = articles;
  isLoading = false;

  if (articles.length === 0) {
    showEmptyState('empty');
  } else {
    hideAllEmptyStates();
    document.getElementById('bookmarks-toolbar').style.display = '';
    document.getElementById('bm-categories').style.display = '';
  }

  applyFilters();
  updateStats();
  renderCategoryPills();
}

// ── Apply Filters & Sort ──────────────────────────────
function applyFilters() {
  var results = bookmarkedArticles.slice();

  // Category filter
  if (activeCategory !== 'All') {
    results = results.filter(function(a) { return a.category === activeCategory; });
  }

  // Search filter
  if (searchQuery) {
    var q = searchQuery.toLowerCase();
    results = results.filter(function(a) {
      return (a.title || '').toLowerCase().indexOf(q) !== -1 ||
        (a.excerpt || '').toLowerCase().indexOf(q) !== -1 ||
        (a.category || '').toLowerCase().indexOf(q) !== -1 ||
        (a.author || '').toLowerCase().indexOf(q) !== -1;
    });
  }

  // Sort
  results.sort(function(a, b) {
    switch (currentSort) {
      case 'newest':
        return getTime(b.savedAt || b.createdAt) - getTime(a.savedAt || a.createdAt);
      case 'oldest':
        return getTime(a.savedAt || a.createdAt) - getTime(b.savedAt || b.createdAt);
      case 'az':
        return (a.title || '').localeCompare(b.title || '');
      case 'za':
        return (b.title || '').localeCompare(a.title || '');
      default:
        return 0;
    }
  });

  filteredBookmarks = results;
  renderBookmarks();
}

function getTime(ts) {
  if (!ts) return 0;
  if (ts.toMillis) return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  return new Date(ts).getTime();
}

// ── Render Bookmarks ──────────────────────────────────
function renderBookmarks() {
  var grid = document.getElementById('bookmarks-grid');
  hideAllEmptyStates();

  if (bookmarkedArticles.length === 0 && !isLoading) {
    grid.innerHTML = '';
    showEmptyState('empty');
    return;
  }

  if (filteredBookmarks.length === 0 && !isLoading) {
    grid.innerHTML = '';
    showEmptyState('search');
    return;
  }

  var html = '';
  if (currentView === 'grid') {
    grid.className = 'bookmarks-grid';
    for (var i = 0; i < filteredBookmarks.length; i++) {
      html += gridCardHTML(filteredBookmarks[i]);
    }
  } else {
    grid.className = 'bookmarks-list';
    for (var i = 0; i < filteredBookmarks.length; i++) {
      html += listCardHTML(filteredBookmarks[i]);
    }
  }
  grid.innerHTML = html;

  // Animate
  requestAnimationFrame(function() {
    var cards = grid.querySelectorAll('.bm-card, .bm-list-item');
    for (var i = 0; i < cards.length; i++) {
      cards[i].style.animationDelay = (i * 0.06) + 's';
      cards[i].classList.add('bm-animate-in');
    }
  });
}

// ── Grid Card HTML ────────────────────────────────────
function gridCardHTML(art) {
  var rt = readingTime(art.content);
  var imgSrc = art.image || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format';
  var saved = art.savedAt ? timeAgo(art.savedAt) : '';

  return '<div class="bm-card" id="bm-card-' + art.id + '">' +
    '<div class="bm-card-img-wrap">' +
      '<img class="bm-card-img" src="' + imgSrc + '" alt="' + art.title + '" loading="lazy">' +
      '<div class="bm-card-overlay">' +
        '<a href="article?id=' + art.id + '" class="bm-read-btn">Read Article →</a>' +
      '</div>' +
      '<span class="bm-card-category">' + (art.category || 'General') + '</span>' +
      '<button class="bm-remove-btn" onclick="removeBookmark(\'' + art.id + '\')" title="Remove bookmark">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>' +
    '</div>' +
    '<div class="bm-card-body">' +
      '<a href="article?id=' + art.id + '" class="bm-card-title">' + art.title + '</a>' +
      '<p class="bm-card-excerpt">' + (art.excerpt || '') + '</p>' +
      '<div class="bm-card-footer">' +
        '<div class="bm-card-meta">' +
          '<span>✍️ ' + (art.author || 'Editorial Team') + '</span>' +
          '<span>·</span>' +
          '<span>' + rt + ' min read</span>' +
        '</div>' +
        (saved ? '<span class="bm-saved-time">Saved ' + saved + '</span>' : '') +
      '</div>' +
    '</div>' +
  '</div>';
}

// ── List Card HTML ────────────────────────────────────
function listCardHTML(art) {
  var rt = readingTime(art.content);
  var imgSrc = art.image || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format';
  var saved = art.savedAt ? timeAgo(art.savedAt) : '';

  return '<div class="bm-list-item" id="bm-list-' + art.id + '">' +
    '<a href="article?id=' + art.id + '" class="bm-list-img-wrap">' +
      '<img src="' + imgSrc + '" alt="' + art.title + '" loading="lazy">' +
    '</a>' +
    '<div class="bm-list-content">' +
      '<span class="bm-list-category">' + (art.category || 'General') + '</span>' +
      '<a href="article?id=' + art.id + '" class="bm-list-title">' + art.title + '</a>' +
      '<p class="bm-list-excerpt">' + (art.excerpt || '') + '</p>' +
      '<div class="bm-list-footer">' +
        '<span class="bm-list-meta">✍️ ' + (art.author || 'Editorial Team') + ' · ' + rt + ' min' + (saved ? ' · Saved ' + saved : '') + '</span>' +
        '<button class="bm-list-remove" onclick="removeBookmark(\'' + art.id + '\')" title="Remove">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
          ' Remove' +
        '</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

// ── Remove Bookmark ───────────────────────────────────
function removeBookmark(articleId) {
  if (!auth.currentUser) return;

  // Animate out
  var card = document.getElementById('bm-card-' + articleId) || document.getElementById('bm-list-' + articleId);
  if (card) {
    card.style.transition = 'all 0.4s cubic-bezier(0.55, 0, 0.1, 1)';
    card.style.transform = 'scale(0.8)';
    card.style.opacity = '0';
  }

  var docId = auth.currentUser.uid + '_' + articleId;
  db.collection('bookmarks').doc(docId).delete()
    .then(function() {
      showToast('Bookmark removed');
      // The onSnapshot listener will automatically update the list
    })
    .catch(function(e) {
      console.error('Remove error:', e);
      showToast('Could not remove bookmark');
      if (card) {
        card.style.transform = '';
        card.style.opacity = '';
      }
    });
}
window.removeBookmark = removeBookmark;

// ── Category Pills ────────────────────────────────────
function renderCategoryPills() {
  var container = document.getElementById('bm-categories');
  var catMap = {};
  for (var i = 0; i < bookmarkedArticles.length; i++) {
    var cat = bookmarkedArticles[i].category;
    if (cat) catMap[cat] = (catMap[cat] || 0) + 1;
  }

  var html = '<button class="bm-pill ' + (activeCategory === 'All' ? 'active' : '') + '" onclick="filterBookmarks(\'All\')">All · ' + bookmarkedArticles.length + '</button>';

  var icons = { Tafsir: '📖', Reflection: '💭', Stories: '📜', Lessons: '🌿' };
  for (var cat in catMap) {
    var icon = icons[cat] || '📄';
    html += '<button class="bm-pill ' + (activeCategory === cat ? 'active' : '') + '" onclick="filterBookmarks(\'' + cat + '\')">' + icon + ' ' + cat + ' · ' + catMap[cat] + '</button>';
  }

  container.innerHTML = html;
}

function filterBookmarks(cat) {
  activeCategory = cat;
  renderCategoryPills();
  applyFilters();
}
window.filterBookmarks = filterBookmarks;

// ── View Toggle ───────────────────────────────────────
function setView(view, doRender) {
  if (doRender === undefined) doRender = true;
  currentView = view;
  localStorage.setItem('bm-view', view);
  document.getElementById('bm-view-grid').classList.toggle('active', view === 'grid');
  document.getElementById('bm-view-list').classList.toggle('active', view === 'list');
  if (doRender) applyFilters();
}
window.setView = setView;

// ── Stats ─────────────────────────────────────────────
function updateStats() {
  document.getElementById('bm-total-count').textContent = bookmarkedArticles.length;

  var catSet = {};
  for (var i = 0; i < bookmarkedArticles.length; i++) {
    if (bookmarkedArticles[i].category) catSet[bookmarkedArticles[i].category] = true;
  }
  document.getElementById('bm-category-count').textContent = Object.keys(catSet).length;

  var totalRead = 0;
  for (var i = 0; i < bookmarkedArticles.length; i++) {
    totalRead += readingTime(bookmarkedArticles[i].content);
  }
  document.getElementById('bm-read-time').textContent = totalRead;
}

// ── Empty States ──────────────────────────────────────
function showAuthRequired() {
  hideAllEmptyStates();
  document.getElementById('bookmarks-grid').innerHTML = '';
  document.getElementById('bookmarks-toolbar').style.display = 'none';
  document.getElementById('bm-categories').style.display = 'none';
  document.getElementById('bm-auth-empty').style.display = 'flex';
  document.getElementById('bm-auth-empty').classList.remove('hidden');
}

function showEmptyState(type) {
  hideAllEmptyStates();
  document.getElementById('bookmarks-grid').innerHTML = '';

  if (type === 'empty') {
    document.getElementById('bookmarks-toolbar').style.display = 'none';
    document.getElementById('bm-categories').style.display = 'none';
    document.getElementById('bm-no-bookmarks').style.display = 'flex';
    document.getElementById('bm-no-bookmarks').classList.remove('hidden');
  } else if (type === 'search') {
    document.getElementById('bm-no-results').style.display = 'flex';
    document.getElementById('bm-no-results').classList.remove('hidden');
  }
}

function hideAllEmptyStates() {
  document.getElementById('bm-auth-empty').classList.add('hidden');
  document.getElementById('bm-no-bookmarks').classList.add('hidden');
  document.getElementById('bm-no-results').classList.add('hidden');
  document.getElementById('bm-auth-empty').style.display = 'none';
  document.getElementById('bm-no-bookmarks').style.display = 'none';
  document.getElementById('bm-no-results').style.display = 'none';
}

// ── Clear Search ──────────────────────────────────────
function clearSearch() {
  document.getElementById('bm-search').value = '';
  searchQuery = '';
  activeCategory = 'All';
  applyFilters();
  renderCategoryPills();
}
window.clearSearch = clearSearch;
