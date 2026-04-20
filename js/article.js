// ==========================================================
// article.js — Article Page Logic (with auth, comments, follow)
// ==========================================================

// ── Theme ──────────────────────────────────────────────
const root = document.documentElement;
const themeBtn = document.getElementById('theme-toggle');
const savedTheme = localStorage.getItem('theme') || 'light';
root.setAttribute('data-theme', savedTheme);
themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
themeBtn.addEventListener('click', () => {
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
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
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Helpers ────────────────────────────────────────────
function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
function readingTime(content) {
  const words = content ? content.replace(/<[^>]+>/g, '').split(/\s+/).length : 0;
  return Math.max(1, Math.ceil(words / 200));
}
function getBookmarks() { return []; } // legacy stub — no longer used

// ── State ──────────────────────────────────────────────
const params = new URLSearchParams(window.location.search);
const articleId = params.get('id');
let currentArticle = null;
let writerData = null;
let isFollowingWriter = false;

// ── Copy Verse ─────────────────────────────────────────
function copyVerse(btn) {
  const bq = btn.closest('blockquote');
  const arabic = bq.querySelector('.verse-arabic');
  const translation = bq.querySelector('.verse-translation');
  const text = (arabic ? arabic.textContent + '\n' : '') + (translation ? translation.textContent : '');
  navigator.clipboard.writeText(text).then(() => showToast('Verse copied ✓'));
}
window.copyVerse = copyVerse;

function copyLink() {
  navigator.clipboard.writeText(window.location.href).then(() => showToast('Link copied ✓'));
}
window.copyLink = copyLink;

// ── Like (auth-gated) ──────────────────────────────────
async function handleLike() {
  if (!auth.currentUser) { showAuthModal('login'); return; }
  if (!articleId) return;
  const likedKey = 'liked_' + articleId;
  if (localStorage.getItem(likedKey)) { showToast('You already liked this article.'); return; }
  try {
    await db.collection('articles').doc(articleId).update({
      likes: firebase.firestore.FieldValue.increment(1)
    });
    localStorage.setItem(likedKey, '1');
    document.getElementById('like-btn').classList.add('liked');
    const count = document.getElementById('like-count');
    count.textContent = parseInt(count.textContent || '0') + 1;
    showToast('Liked! JazakAllahu Khayran ❤️');
  } catch (e) { showToast('Could not register like.'); }
}
window.handleLike = handleLike;

// ── Bookmark State ────────────────────────────────────
let isArticleBookmarked = false;

function updateBookmarkUI() {
  var btn = document.getElementById('bookmark-btn');
  if (!btn) return;
  btn.textContent = isArticleBookmarked ? '🔖 Bookmarked' : '🏷️ Bookmark';
}

// Check bookmark state when auth loads
auth.onAuthStateChanged(function(user) {
  if (user && articleId) {
    var docId = user.uid + '_' + articleId;
    db.collection('bookmarks').doc(docId).onSnapshot(function(doc) {
      isArticleBookmarked = doc.exists;
      updateBookmarkUI();
    }, function(err) {
      console.error('Bookmark check error:', err);
    });
  } else {
    isArticleBookmarked = false;
    updateBookmarkUI();
  }
});

// ── Bookmark (auth-required, Firestore-only) ──────────
function handleBookmark() {
  if (!auth.currentUser) { showAuthModal('login'); return; }
  if (!articleId) return;

  var uid = auth.currentUser.uid;
  var docId = uid + '_' + articleId;

  if (isArticleBookmarked) {
    // Remove
    db.collection('bookmarks').doc(docId).delete()
      .then(function() { showToast('Bookmark removed'); })
      .catch(function(e) { console.error(e); showToast('Error removing bookmark'); });
    isArticleBookmarked = false;
    updateBookmarkUI();
  } else {
    // Add
    db.collection('bookmarks').doc(docId).set({
      userId: uid,
      articleId: articleId,
      savedAt: firebase.firestore.FieldValue.serverTimestamp()
    })
      .then(function() { showToast('Article bookmarked ✓'); })
      .catch(function(e) { console.error(e); showToast('Error bookmarking'); });
    isArticleBookmarked = true;
    updateBookmarkUI();
  }
}
window.handleBookmark = handleBookmark;

// ── Follow Writer ──────────────────────────────────────
async function handleFollowWriter() {
  if (!auth.currentUser) { showAuthModal('login'); return; }
  if (!writerData) return;
  const user = auth.currentUser;
  const followId = `${user.uid}_${writerData.id}`;
  const followRef = db.collection('follows').doc(followId);
  const writerRef = db.collection('writers').doc(writerData.id);
  const btn = document.getElementById('author-follow-btn');
  try {
    if (isFollowingWriter) {
      await followRef.delete();
      await writerRef.update({ followerCount: firebase.firestore.FieldValue.increment(-1) });
      isFollowingWriter = false;
      btn.textContent = 'Follow';
      btn.classList.remove('following');
      showToast('Unfollowed');
    } else {
      await followRef.set({ followerId: user.uid, writerId: writerData.id, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      await writerRef.update({ followerCount: firebase.firestore.FieldValue.increment(1) });
      isFollowingWriter = true;
      btn.textContent = '✓ Following';
      btn.classList.add('following');
      showToast('Following! JazakAllahu Khayran ✓');
    }
  } catch (e) { showToast('Action failed.'); }
}
window.handleFollowWriter = handleFollowWriter;

// ── Mini card for related ──────────────────────────────
function miniCard(art) {
  const imgSrc = art.image || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600';
  return `
  <div class="article-card fade-up">
    <img class="card-img" src="${imgSrc}" alt="${art.title}" loading="lazy">
    <div class="card-body">
      <div class="card-category">${art.category || ''}</div>
      <a class="card-title" href="article.html?id=${art.id}">${art.title}</a>
      <p class="card-excerpt">${art.excerpt || ''}</p>
      <div class="card-meta"><span>${readingTime(art.content)} min read</span></div>
    </div>
  </div>`;
}

// ── Load Article ───────────────────────────────────────
async function loadArticle() {
  if (!articleId) { document.getElementById('article-body').innerHTML = '<p>No article ID provided.</p>'; return; }
  try {
    const doc = await db.collection('articles').doc(articleId).get();
    if (!doc.exists) { document.getElementById('article-body').innerHTML = '<p>Article not found.</p>'; return; }
    currentArticle = { id: doc.id, ...doc.data() };
    renderArticle(currentArticle);
    loadRelated(currentArticle.category, currentArticle.id);
    loadComments(articleId);
    if (currentArticle.writerId) loadWriter(currentArticle.writerId);
  } catch (e) {
    console.error(e);
    document.getElementById('article-body').innerHTML = '<p>Error loading article.</p>';
  }
}

function renderArticle(art) {
  document.getElementById('page-title').textContent = art.title + ' — Noor Al-Quran';
  document.getElementById('page-desc').setAttribute('content', art.excerpt || '');

  const heroImg = document.getElementById('hero-img');
  heroImg.src = art.image || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200';
  heroImg.alt = art.title;
  document.getElementById('article-title').textContent = art.title;
  document.getElementById('article-category').textContent = art.category || '';
  document.getElementById('article-date').textContent = formatDate(art.createdAt);
  document.getElementById('article-read-time').textContent = readingTime(art.content) + ' min read';
  document.getElementById('article-likes-bar').textContent = '❤️ ' + (art.likes || 0) + ' likes';
  document.getElementById('article-body').innerHTML = art.content || '';

  // Author link
  const authorLink = document.getElementById('article-author-link');
  authorLink.textContent = '✍️ ' + (art.author || 'Editorial Team');
  if (art.writerId) authorLink.href = `profile.html?id=${art.writerId}`;

  // Like state
  if (localStorage.getItem('liked_' + art.id)) document.getElementById('like-btn').classList.add('liked');
  document.getElementById('like-count').textContent = art.likes || 0;

  // Bookmark state — handled by Firestore onSnapshot listener above

  // Share links
  const url = encodeURIComponent(window.location.href);
  const title = encodeURIComponent(art.title);
  document.getElementById('share-twitter').href = `https://twitter.com/intent/tweet?text=${title}&url=${url}`;
  document.getElementById('share-whatsapp').href = `https://wa.me/?text=${title}%20${url}`;

  // Author box
  document.getElementById('author-name').textContent = art.author || 'Editorial Team';
  document.getElementById('author-avatar').textContent = (art.author || 'A')[0].toUpperCase();
}

// ── Load Writer for Follow Button ─────────────────────
async function loadWriter(wId) {
  try {
    const doc = await db.collection('writers').doc(wId).get();
    if (!doc.exists) return;
    writerData = { id: doc.id, ...doc.data() };

    // Update author box
    if (writerData.bio) document.getElementById('author-bio-text').textContent = writerData.bio;
    if (writerData.avatar) {
      document.getElementById('author-avatar').innerHTML = `<img src="${writerData.avatar}" alt="${writerData.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    }

    // Follow button
    const btn = document.getElementById('author-follow-btn');
    btn.style.display = 'inline-block';

    auth.onAuthStateChanged(async user => {
      if (user && writerData) {
        const followDoc = await db.collection('follows').doc(`${user.uid}_${writerData.id}`).get();
        isFollowingWriter = followDoc.exists;
        btn.textContent = isFollowingWriter ? '✓ Following' : 'Follow';
        if (isFollowingWriter) btn.classList.add('following');
      }
    });
  } catch (e) { console.error(e); }
}

// ── Load Related Articles ──────────────────────────────
async function loadRelated(category, excludeId) {
  try {
    const snap = await db.collection('articles').where('category', '==', category).limit(4).get();
    const related = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.id !== excludeId).slice(0, 3);
    const grid = document.getElementById('related-grid');
    grid.innerHTML = related.length ? related.map(miniCard).join('') : '<p style="color:var(--text-muted)">No related articles.</p>';
  } catch (e) { console.error(e); }
}

// ── Comments ───────────────────────────────────────────
function loadComments(artId) {
  db.collection('comments')
    .where('articleId', '==', artId)
    .onSnapshot(snap => {
      const comments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort in JS to avoid requiring a Firestore composite index
      comments.sort((a, b) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return aTime - bTime;
      });
      renderComments(comments);
    }, err => console.error('Comments error:', err));

  // Watch auth state for comment form
  auth.onAuthStateChanged(user => {
    const prompt = document.getElementById('comment-auth-prompt');
    const form = document.getElementById('comment-form');
    if (user) {
      prompt.style.display = 'none';
      form.style.display = 'block';
    } else {
      prompt.style.display = 'flex';
      form.style.display = 'none';
    }
  });

  // Character counter
  const input = document.getElementById('comment-input');
  const counter = document.getElementById('comment-char-count');
  if (input) {
    input.addEventListener('input', () => {
      counter.textContent = input.value.length + ' / 1000';
    });
  }
}

function renderComments(comments) {
  const list = document.getElementById('comment-list');
  if (!comments.length) {
    list.innerHTML = '<div class="empty-state" style="padding:2rem"><div class="icon" style="font-size:2rem">💬</div><p>No reflections yet. Be the first.</p></div>';
    return;
  }
  list.innerHTML = comments.map(c => {
    const user = auth.currentUser;
    const canDelete = user && user.uid === c.userId;
    const date = c.createdAt ? formatDate(c.createdAt) : '';
    return `
    <div class="comment-item" id="comment-${c.id}">
      <div class="comment-header">
        <div class="comment-avatar">${(c.userName || 'U')[0].toUpperCase()}</div>
        <span class="comment-user">${c.userName || 'Anonymous'}</span>
        <span class="comment-date">${date}</span>
        ${canDelete ? `<button class="comment-delete" onclick="deleteComment('${c.id}')">Delete</button>` : ''}
      </div>
      <div class="comment-body">${escapeHTML(c.content)}</div>
    </div>`;
  }).join('');
}

async function submitComment() {
  const user = auth.currentUser;
  if (!user) { showAuthModal('login'); return; }
  const input = document.getElementById('comment-input');
  const content = input.value.trim();
  if (!content) { showToast('Please write something first.'); return; }
  const btn = document.getElementById('comment-submit-btn');
  btn.textContent = 'Posting…'; btn.disabled = true;
  try {
    await db.collection('comments').add({
      articleId,
      userId: user.uid,
      userName: user.displayName || user.email.split('@')[0],
      content,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    input.value = '';
    document.getElementById('comment-char-count').textContent = '0 / 1000';
    showToast('Reflection posted ✓');
  } catch (e) {
    console.error(e);
    showToast('Could not post comment.');
  } finally {
    btn.textContent = 'Post Reflection'; btn.disabled = false;
  }
}
window.submitComment = submitComment;

async function deleteComment(commentId) {
  if (!confirm('Delete this comment?')) return;
  try {
    await db.collection('comments').doc(commentId).delete();
    showToast('Comment deleted.');
  } catch (e) { showToast('Could not delete.'); }
}
window.deleteComment = deleteComment;

function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

loadArticle();
