// ==========================================================
// article.js — Article Page Logic (with auth, comments, follow)
// ==========================================================

// âš ï¸ WARNING: Hardcoding your API key here is NOT secure for production!
const GROQ_API_KEY = "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";
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

const bar = document.getElementById('progress-bar');
window.addEventListener('scroll', () => {
  const h = document.documentElement.scrollHeight - window.innerHeight;
  bar.style.width = h > 0 ? (window.scrollY / h * 100) + '%' : '0%';
});

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

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

function processFootnotes(html) {
  if (!html) return html;
  const footnotes = [];
  // Match ((footnote text))
  let processedHtml = html.replace(/\(\((.*?)\)\)/g, (match, p1) => {
    footnotes.push(p1);
    const index = footnotes.length;
    return `<sup class="fn-ref"><a href="#fn-${index}" id="fnref-${index}">[${index}]</a></sup>`;
  });

  if (footnotes.length > 0) {
    let fnHtml = `<div class="footnotes-section">
      <div class="section-divider" style="margin: 2.5rem 0 1rem; width: 40px; background: var(--border);"></div>
      <ol class="footnotes-list">`;
    footnotes.forEach((fn, i) => {
      fnHtml += `<li id="fn-${i + 1}">
        ${fn} <a href="#fnref-${i + 1}" class="fn-backref" title="Jump back to reference" aria-label="Jump back to reference">â†©</a>
      </li>`;
    });
    fnHtml += `</ol></div>`;
    processedHtml += fnHtml;
  }

  return processedHtml;
}

// â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const params = new URLSearchParams(window.location.search);
const articleId = params.get('id');
let currentArticle = null;
let writerData = null;
let isFollowingWriter = false;

// â”€â”€ Copy Verse 
function copyVerse(btn) {
  const bq = btn.closest('blockquote');
  const arabic = bq.querySelector('.verse-arabic');
  const translation = bq.querySelector('.verse-translation');
  const text = (arabic ? arabic.textContent + '\n' : '') + (translation ? translation.textContent : '');
  navigator.clipboard.writeText(text).then(() => showToast('Verse copied âœ“'));
}
window.copyVerse = copyVerse;

function copyLink() {
  navigator.clipboard.writeText(window.location.href).then(() => showToast('Link copied âœ“'));
}
window.copyLink = copyLink;

// â”€â”€ Like (auth-gated) 
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
    showToast('Liked! JazakAllahu Khayran.');
  } catch (e) { showToast('Could not register like.'); }
}
window.handleLike = handleLike;

// â”€â”€ Bookmark State 
let isArticleBookmarked = false;

function updateBookmarkUI() {
  var btn = document.getElementById('bookmark-btn');
  if (!btn) return;
  btn.textContent = isArticleBookmarked ? '🔖 Bookmarked' : '🔖 Bookmark';
}

// Check bookmark state when auth loads
auth.onAuthStateChanged(function (user) {
  if (user && articleId) {
    var docId = user.uid + '_' + articleId;
    db.collection('bookmarks').doc(docId).onSnapshot(function (doc) {
      isArticleBookmarked = doc.exists;
      updateBookmarkUI();
    }, function (err) {
      console.error('Bookmark check error:', err);
    });
  } else {
    isArticleBookmarked = false;
    updateBookmarkUI();
  }
});

// â”€â”€ Bookmark (auth-required, Firestore-only) 
function handleBookmark() {
  if (!auth.currentUser) { showAuthModal('login'); return; }
  if (!articleId) return;

  var uid = auth.currentUser.uid;
  var docId = uid + '_' + articleId;

  if (isArticleBookmarked) {
    // Remove
    db.collection('bookmarks').doc(docId).delete()
      .then(function () { showToast('Bookmark removed'); })
      .catch(function (e) { console.error(e); showToast('Error removing bookmark'); });
    isArticleBookmarked = false;
    updateBookmarkUI();
  } else {
    // Add
    db.collection('bookmarks').doc(docId).set({
      userId: uid,
      articleId: articleId,
      savedAt: firebase.firestore.FieldValue.serverTimestamp()
    })
      .then(function () { showToast('Article bookmarked âœ“'); })
      .catch(function (e) { console.error(e); showToast('Error bookmarking'); });
    isArticleBookmarked = true;
    updateBookmarkUI();
  }
}
window.handleBookmark = handleBookmark;

// â”€â”€ Follow Writer 
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
      showToast('Following! JazakAllahu Khayran ');
    }
  } catch (e) { showToast('Action failed.'); }
}
window.handleFollowWriter = handleFollowWriter;

// â”€â”€ Mini card for related 
function miniCard(art) {
  const imgSrc = art.image || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600';
  return `
  <div class="article-card fade-up">
    <img class="card-img" src="${imgSrc}" alt="${art.title}" loading="lazy">
    <div class="card-body">
      <div class="card-category">${art.category || ''}</div>
      <a class="card-title" href="article?id=${art.id}">${art.title}</a>
      <p class="card-excerpt">${art.excerpt || ''}</p>
      <div class="card-meta"><span>${readingTime(art.content)} min read</span></div>
    </div>
  </div>`;
}

// â”€â”€ Load Article 
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
    if (window.showBugReportModal) window.showBugReportModal('Article Load Error', e.stack || e.toString());
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
  document.getElementById('article-likes-bar').textContent = '❤️' + (art.likes || 0) + ' likes';
  document.getElementById('article-body').innerHTML = processFootnotes(art.content || '');

  if (typeof MicroContent !== 'undefined' && art.microContent && art.microContent.highlights) {
    MicroContent.injectHighlights(document.getElementById('article-body'), art.microContent.highlights);
  }

  // AI Summary Block
  const aiContainer = document.getElementById('ai-summary-container');
  const aiBody = document.getElementById('ai-summary-body');
  const aiWrapper = document.getElementById('ai-summary-wrapper');
  const aiBtn = document.getElementById('btn-generate-dynamic-summary');

  // Show the container frame
  aiContainer.style.display = 'flex';

  if (art.aiSummary) {
    // If it was already generated and saved in DB (from old version or future update)
    aiBody.textContent = art.aiSummary;
    aiWrapper.classList.remove('hidden');
    aiBtn.style.display = 'none';
  } else {
    // Show the generate button
    aiWrapper.classList.add('hidden');
    aiBtn.style.display = 'inline-block';
  }

  // Author link
  const authorLink = document.getElementById('article-author-link');
  authorLink.textContent = '✍️' + (art.author || 'Editorial Team');
  if (art.writerId) authorLink.href = `profile?id=${art.writerId}`;

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

  // Set article content for Audio Player
  if (typeof AudioPlayer !== 'undefined' && AudioPlayer.setArticle) {
    AudioPlayer.setArticle(art);
  }
}

// â”€â”€ Load Writer for Follow Button â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Load Related Articles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function loadRelated(category, excludeId) {
  try {
    const snap = await db.collection('articles').where('category', '==', category).limit(4).get();
    const related = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.id !== excludeId).slice(0, 3);
    const grid = document.getElementById('related-grid');
    grid.innerHTML = related.length ? related.map(miniCard).join('') : '<p style="color:var(--text-muted)">No related articles.</p>';
  } catch (e) {
    console.error(e);
    if (window.showBugReportModal) window.showBugReportModal('Related Articles Load Error', e.stack || e.toString());
  }
}

// â”€â”€ Comments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    showToast('Reflection posted âœ“');
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

// Initialize audio player (code in audio-player.js)
AudioPlayer.init();

// â”€â”€ AI Dynamic Summarization â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function generateDynamicSummary() {
  if (GROQ_API_KEY === "YOUR_GROQ_API_KEY_HERE" || !GROQ_API_KEY) {
    showToast('Please set your Groq API Key in js/article.js first.');
    return;
  }

  const btn = document.getElementById('btn-generate-dynamic-summary');
  const loading = document.getElementById('ai-loading');
  const body = document.getElementById('ai-summary-body');
  const articleContent = currentArticle?.content || '';

  if (!articleContent) {
    showToast('No article content to summarize.');
    return;
  }

  btn.style.display = 'none';
  loading.classList.remove('hidden');

  // Strip HTML to reduce token usage
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = articleContent;
  const plainText = tempDiv.textContent || tempDiv.innerText || '';

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{
          role: 'user',
          content: "Please provide a simple, easy-to-understand summary of the following article in plain English. The summary should be detailed enough to cover the main points, around 4-5 sentences long, and written in a captivating way that encourages users to read the full article:\n\n" + plainText
        }],
        temperature: 0.7,
        max_tokens: 250
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      console.error('Groq API Error details:', errData);
      throw new Error(errData.error?.message || 'API Request Failed');
    }
    const data = await response.json();
    const summaryText = data.choices?.[0]?.message?.content;

    if (summaryText) {
      body.textContent = summaryText.trim();
      loading.classList.add('hidden');
      document.getElementById('ai-summary-wrapper').classList.remove('hidden');

      // Optionally save it back to the database to prevent re-generating later
      if (articleId) {
        db.collection('articles').doc(articleId).update({ aiSummary: summaryText.trim() }).catch(e => console.error('Failed to save summary:', e));
      }
    } else {
      throw new Error('No summary generated');
    }
  } catch (e) {
    console.error('Summarization Error:', e);
    showToast('AI Error: ' + (e.message || 'Check your API key.'));
    loading.classList.add('hidden');
    btn.style.display = 'inline-block';
    if (window.showBugReportModal) window.showBugReportModal('AI Summarization Error', e.stack || e.toString());
  }
}
window.generateDynamicSummary = generateDynamicSummary;

loadArticle();

