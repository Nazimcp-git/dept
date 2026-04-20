// ==========================================================
// admin.js — Admin CRUD: Articles + Writers
// ==========================================================

// ── State ──────────────────────────────────────────────
let editingArticleId = null;
let editingWriterId = null;
let editingShortId = null;
let articlesCache = [];
let writersCache = [];
let shortsCache = [];

// ── Helpers ────────────────────────────────────────────
function toSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
}
function toExcerpt(content) {
  return content.replace(/<[^>]+>/g, '').trim().slice(0, 160);
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}
function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ══════════════════════════════════════════════════════
// ADMIN TABS
// ══════════════════════════════════════════════════════
function switchAdminTab(tab) {
  ['articles', 'writers', 'shorts'].forEach(t => {
    document.getElementById(`admin-tab-${t}`)?.classList.toggle('active', t === tab);
    document.getElementById(`panel-${t}`)?.classList.toggle('active', t === tab);
  });
}
window.switchAdminTab = switchAdminTab;

// ══════════════════════════════════════════════════════
// ARTICLES CRUD
// ══════════════════════════════════════════════════════
function loadAdminArticles() {
  db.collection('articles').orderBy('createdAt', 'desc').onSnapshot(snap => {
    articlesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderArticleTable(articlesCache);
    document.getElementById('article-count').textContent = articlesCache.length;
    const fc = articlesCache.filter(a => a.featured).length;
    document.getElementById('featured-count').textContent = fc;
    populateWriterDropdown();
  });
}

function renderArticleTable(articles) {
  const tbody = document.getElementById('articles-tbody');
  if (!articles.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:2rem">No articles yet.</td></tr>';
    return;
  }
  tbody.innerHTML = articles.map(a => `
    <tr>
      <td><strong>${a.title}</strong></td>
      <td><span class="card-category">${a.category || '—'}</span></td>
      <td>${formatDate(a.createdAt)}</td>
      <td>❤️ ${a.likes || 0}</td>
      <td>
        <button class="btn-edit" onclick="openEditArticle('${a.id}')">Edit</button>
        <button class="btn-danger" onclick="deleteArticle('${a.id}','${a.title.replace(/'/g,"\\'")}')">Delete</button>
      </td>
    </tr>`).join('');
}

function populateWriterDropdown() {
  const select = document.getElementById('f-writer');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">— No writer assigned —</option>' +
    writersCache.map(w => `<option value="${w.id}" ${w.id === current ? 'selected' : ''}>${w.name}</option>`).join('');
}

function openAddArticle() {
  editingArticleId = null;
  document.getElementById('modal-title').textContent = 'New Article';
  document.getElementById('article-form').reset();
  populateWriterDropdown();
  document.getElementById('article-modal').classList.remove('hidden');
}
window.openAddArticle = openAddArticle;
window.openAdd = openAddArticle; // alias

function openEditArticle(id) {
  const art = articlesCache.find(a => a.id === id);
  if (!art) return;
  editingArticleId = id;
  document.getElementById('modal-title').textContent = 'Edit Article';
  document.getElementById('f-title').value = art.title || '';
  document.getElementById('f-content').value = art.content || '';
  document.getElementById('f-category').value = art.category || 'Tafsir';
  document.getElementById('f-tags').value = (art.tags || []).join(', ');
  document.getElementById('f-image').value = art.image || '';
  document.getElementById('f-author').value = art.author || '';
  document.getElementById('f-featured').checked = !!art.featured;
  populateWriterDropdown();
  const writerSelect = document.getElementById('f-writer');
  if (writerSelect && art.writerId) writerSelect.value = art.writerId;
  document.getElementById('article-modal').classList.remove('hidden');
}
window.openEditArticle = openEditArticle;
window.openEdit = openEditArticle; // alias

function closeArticleModal() {
  document.getElementById('article-modal').classList.add('hidden');
  editingArticleId = null;
}
window.closeArticleModal = closeArticleModal;
window.closeModal = closeArticleModal; // alias

async function saveArticle() {
  const title = document.getElementById('f-title').value.trim();
  const content = document.getElementById('f-content').value.trim();
  const category = document.getElementById('f-category').value;
  const tagsRaw = document.getElementById('f-tags').value.trim();
  const image = document.getElementById('f-image').value.trim();
  const author = document.getElementById('f-author').value.trim() || 'Editorial Team';
  const featured = document.getElementById('f-featured').checked;
  const writerId = document.getElementById('f-writer')?.value || '';

  if (!title || !content) { showToast('Title and content are required.'); return; }

  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
  const data = {
    title, content, category, tags, image, author, featured,
    writerId,
    slug: toSlug(title),
    excerpt: toExcerpt(content),
    likes: editingArticleId ? (articlesCache.find(a => a.id === editingArticleId)?.likes || 0) : 0
  };

  const btn = document.getElementById('save-article-btn');
  btn.textContent = 'Saving…'; btn.disabled = true;
  try {
    if (editingArticleId) {
      await db.collection('articles').doc(editingArticleId).update(data);
      showToast('Article updated ✓');
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      
      let finalSlug = data.slug || 'article';
      // Check if a document with this slug already exists
      const docRef = await db.collection('articles').doc(finalSlug).get();
      if (docRef.exists) {
        finalSlug = finalSlug + '-' + Math.random().toString(36).substr(2, 4);
        data.slug = finalSlug;
      }
      
      await db.collection('articles').doc(finalSlug).set(data);
      
      // Update writer's article count
      if (writerId) await db.collection('writers').doc(writerId).update({ articleCount: firebase.firestore.FieldValue.increment(1) });
      showToast('Article published ✓');
    }
    closeArticleModal();
  } catch (e) {
    console.error(e);
    showToast('Save failed: ' + e.message);
  } finally {
    btn.textContent = 'Save Article'; btn.disabled = false;
  }
}
window.saveArticle = saveArticle;

async function deleteArticle(id, title) {
  if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
  try {
    await db.collection('articles').doc(id).delete();
    showToast('Article deleted.');
  } catch (e) { showToast('Delete failed: ' + e.message); }
}
window.deleteArticle = deleteArticle;

// ── Seed ──────────────────────────────────────────────
function runSeed() {
  if (!confirm('Add 5 sample articles to Firestore?')) return;
  seedSampleData();
}
window.runSeed = runSeed;

// ── Article Search ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('admin-search')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    renderArticleTable(articlesCache.filter(a =>
      a.title?.toLowerCase().includes(q) || a.category?.toLowerCase().includes(q)
    ));
  });
  document.getElementById('writer-search')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    renderWriterCards(writersCache.filter(w => w.name?.toLowerCase().includes(q)));
  });
});

// ══════════════════════════════════════════════════════
// WRITERS CRUD
// ══════════════════════════════════════════════════════
function loadAdminWriters() {
  db.collection('writers').orderBy('createdAt', 'desc').onSnapshot(snap => {
    writersCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderWriterCards(writersCache);
    document.getElementById('writer-count').textContent = writersCache.length;
  });
}

function renderWriterCards(writers) {
  const grid = document.getElementById('writers-grid');
  if (!writers.length) {
    grid.innerHTML = '<div class="empty-state"><div class="icon">✍️</div><p>No writers yet. Add the first one!</p></div>';
    return;
  }
  grid.innerHTML = writers.map(w => {
    const avatarContent = w.avatar
      ? `<img src="${w.avatar}" alt="${w.name}" style="width:100%;height:100%;object-fit:cover">`
      : w.name[0].toUpperCase();
    return `
    <div class="writer-card">
      <div class="wc-avatar">${avatarContent}</div>
      <div class="wc-name">${w.name}</div>
      <div class="wc-title">${w.title || ''}</div>
      <div class="wc-stats">📝 ${w.articleCount || 0} articles · 👥 ${w.followerCount || 0} followers</div>
      <div class="wc-actions">
        <a class="btn-edit" href="profile.html?id=${w.id}" target="_blank" style="text-decoration:none;font-size:0.82rem">View</a>
        <button class="btn-edit" onclick="openEditWriter('${w.id}')">Edit</button>
        <button class="btn-danger" onclick="deleteWriter('${w.id}','${w.name.replace(/'/g,"\\'")}')">Delete</button>
      </div>
    </div>`;
  }).join('');
}

function openAddWriter() {
  editingWriterId = null;
  document.getElementById('writer-modal-title').textContent = 'New Writer';
  document.getElementById('writer-form').reset();
  document.getElementById('writer-modal').classList.remove('hidden');
}
window.openAddWriter = openAddWriter;

function openEditWriter(id) {
  const w = writersCache.find(w => w.id === id);
  if (!w) return;
  editingWriterId = id;
  document.getElementById('writer-modal-title').textContent = 'Edit Writer';
  document.getElementById('wf-name').value = w.name || '';
  document.getElementById('wf-title').value = w.title || '';
  document.getElementById('wf-bio').value = w.bio || '';
  document.getElementById('wf-avatar').value = w.avatar || '';
  document.getElementById('wf-twitter').value = w.socialLinks?.twitter || '';
  document.getElementById('wf-website').value = w.socialLinks?.website || '';
  document.getElementById('wf-featured').checked = !!w.featured;
  document.getElementById('writer-modal').classList.remove('hidden');
}
window.openEditWriter = openEditWriter;

function closeWriterModal() {
  document.getElementById('writer-modal').classList.add('hidden');
  editingWriterId = null;
}
window.closeWriterModal = closeWriterModal;

async function saveWriter() {
  const name = document.getElementById('wf-name').value.trim();
  const title = document.getElementById('wf-title').value.trim();
  const bio = document.getElementById('wf-bio').value.trim();
  const avatar = document.getElementById('wf-avatar').value.trim();
  const twitter = document.getElementById('wf-twitter').value.trim();
  const website = document.getElementById('wf-website').value.trim();
  const featured = document.getElementById('wf-featured').checked;

  if (!name) { showToast('Name is required.'); return; }

  const data = {
    name, title, bio, avatar, featured,
    socialLinks: { twitter, website }
  };

  const btn = document.getElementById('save-writer-btn');
  btn.textContent = 'Saving…'; btn.disabled = true;
  try {
    if (editingWriterId) {
      await db.collection('writers').doc(editingWriterId).update(data);
      showToast('Writer updated ✓');
    } else {
      data.followerCount = 0;
      data.articleCount = 0;
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('writers').add(data);
      showToast('Writer profile created ✓');
    }
    closeWriterModal();
  } catch (e) {
    console.error(e);
    showToast('Save failed: ' + e.message);
  } finally {
    btn.textContent = 'Save Writer'; btn.disabled = false;
  }
}
window.saveWriter = saveWriter;

async function deleteWriter(id, name) {
  if (!confirm(`Delete writer "${name}"? Their articles will remain.`)) return;
  try {
    await db.collection('writers').doc(id).delete();
    showToast('Writer deleted.');
  } catch (e) { showToast('Delete failed: ' + e.message); }
}
window.deleteWriter = deleteWriter;

// ══════════════════════════════════════════════════════
// SHORTS CRUD
// ══════════════════════════════════════════════════════
function loadAdminShorts() {
  db.collection('shorts').orderBy('createdAt', 'desc').onSnapshot(snap => {
    shortsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderShortsTable(shortsCache);
  });
}
window.loadAdminShorts = loadAdminShorts;

function renderShortsTable(shorts) {
  const tbody = document.getElementById('shorts-tbody');
  if (!tbody) return;
  if (!shorts.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:2rem">No shorts yet.</td></tr>';
    return;
  }
  tbody.innerHTML = shorts.map(s => {
    const preview = s.content.length > 50 ? s.content.substring(0, 50) + '...' : s.content;
    const arabicPreview = s.arabic ? `<div style="font-family:serif;font-size:1.2rem;" dir="rtl">${s.arabic.substring(0,20)}...</div>` : '';
    return `
    <tr>
      <td>${arabicPreview}<div style="font-size:0.85rem">${preview}</div></td>
      <td>${s.source || '—'}</td>
      <td><span class="card-category" style="background:var(--bg)">${s.theme || 'emerald'}</span></td>
      <td>${formatDate(s.createdAt)}</td>
      <td>
        <button class="btn-edit" onclick="openEditShort('${s.id}')">Edit</button>
        <button class="btn-danger" onclick="deleteShort('${s.id}')">Delete</button>
      </td>
    </tr>`;
  }).join('');
}

function openAddShort() {
  editingShortId = null;
  document.getElementById('short-modal-title').textContent = 'New Short';
  document.getElementById('short-form').reset();
  document.getElementById('sf-theme').value = 'emerald';
  document.getElementById('short-modal').classList.remove('hidden');
}
window.openAddShort = openAddShort;

function openEditShort(id) {
  const s = shortsCache.find(x => x.id === id);
  if (!s) return;
  editingShortId = id;
  document.getElementById('short-modal-title').textContent = 'Edit Short';
  document.getElementById('sf-arabic').value = s.arabic || '';
  document.getElementById('sf-content').value = s.content || '';
  document.getElementById('sf-source').value = s.source || '';
  document.getElementById('sf-theme').value = s.theme || 'emerald';
  document.getElementById('short-modal').classList.remove('hidden');
}
window.openEditShort = openEditShort;

function closeShortModal() {
  document.getElementById('short-modal').classList.add('hidden');
  editingShortId = null;
}
window.closeShortModal = closeShortModal;

async function saveShort() {
  const arabic = document.getElementById('sf-arabic').value.trim();
  const content = document.getElementById('sf-content').value.trim();
  const source = document.getElementById('sf-source').value.trim();
  const theme = document.getElementById('sf-theme').value;

  if (!content && !arabic) { showToast('Content or Arabic text is required.'); return; }

  const data = { arabic, content, source, theme };
  const btn = document.getElementById('save-short-btn');
  btn.textContent = 'Saving…'; btn.disabled = true;
  try {
    if (editingShortId) {
      await db.collection('shorts').doc(editingShortId).update(data);
      showToast('Short updated ✓');
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('shorts').add(data);
      showToast('Short published ✓');
    }
    closeShortModal();
  } catch (e) {
    console.error(e);
    showToast('Save failed: ' + e.message);
  } finally {
    btn.textContent = 'Save Short'; btn.disabled = false;
  }
}
window.saveShort = saveShort;

async function deleteShort(id) {
  if (!confirm(`Delete this short? This cannot be undone.`)) return;
  try {
    await db.collection('shorts').doc(id).delete();
    showToast('Short deleted.');
  } catch (e) { showToast('Delete failed: ' + e.message); }
}
window.deleteShort = deleteShort;
