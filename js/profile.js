// ==========================================================
// profile.js — Writer Profile Page Logic
// URL: profile?id=<writerId>
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

// ── Helpers ────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
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

// ── State ──────────────────────────────────────────────
const params = new URLSearchParams(window.location.search);
const writerId = params.get('id');
let writerData = null;
let isFollowing = false;

// ── Article Card ───────────────────────────────────────
function articleCard(art) {
  const imgSrc = art.image || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800';
  const rt = readingTime(art.content);
  return `
  <div class="article-card fade-up">
    <img class="card-img" src="${imgSrc}" alt="${art.title}" loading="lazy">
    <div class="card-body">
      <div class="card-category">${art.category || ''}</div>
      <a class="card-title" href="article?id=${art.id}">${art.title}</a>
      <p class="card-excerpt">${art.excerpt || ''}</p>
      <div class="card-meta">
        <span>${formatDate(art.createdAt)} · ${rt} min read</span>
        <span>❤️ ${art.likes || 0}</span>
      </div>
    </div>
  </div>`;
}

// ── Load Writer ────────────────────────────────────────
async function loadWriter() {
  if (!writerId) {
    document.getElementById('profile-name').textContent = 'Writer not found.';
    return;
  }
  try {
    const doc = await db.collection('writers').doc(writerId).get();
    if (!doc.exists) {
      document.getElementById('profile-name').textContent = 'Writer not found.';
      return;
    }
    writerData = { id: doc.id, ...doc.data() };
    renderProfile(writerData);
    loadWriterArticles(writerId);
  } catch (e) {
    console.error(e);
    document.getElementById('profile-name').textContent = 'Error loading profile.';
  }
}

function renderProfile(w) {
  document.getElementById('page-title').textContent = w.name + ' — Noor Al-Quran';
  document.getElementById('page-desc').setAttribute('content', w.bio || '');

  // Avatar
  const avatarEl = document.getElementById('profile-avatar');
  if (w.avatar) {
    avatarEl.innerHTML = `<img src="${w.avatar}" alt="${w.name}" loading="lazy">`;
  } else {
    avatarEl.textContent = w.name[0].toUpperCase();
  }

  document.getElementById('profile-name').textContent = w.name;
  document.getElementById('profile-title').textContent = w.title || '';
  document.getElementById('profile-bio').textContent = w.bio || '';
  document.getElementById('stat-followers').textContent = w.followerCount || 0;

  // Social links
  const social = document.getElementById('profile-social');
  let links = '';
  if (w.socialLinks?.twitter) links += `<a class="social-link" href="${w.socialLinks.twitter}" target="_blank">𝕏 Twitter</a>`;
  if (w.socialLinks?.website) links += `<a class="social-link" href="${w.socialLinks.website}" target="_blank">🌐 Website</a>`;
  social.innerHTML = links;

  // Show follow button after auth check
  auth.onAuthStateChanged(user => {
    const btn = document.getElementById('follow-btn');
    if (user) {
      btn.style.display = 'inline-block';
      checkFollowState(user.uid, writerId);
    } else {
      btn.style.display = 'inline-block';
      btn.textContent = 'Follow';
    }
  });
}

// ── Load Articles ──────────────────────────────────────
async function loadWriterArticles(wId) {
  try {
    const snap = await db.collection('articles')
      .where('writerId', '==', wId)
      .get();

    const articles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Sort in JS to avoid requiring a Firestore composite index
    articles.sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return bTime - aTime;
    });
    const grid = document.getElementById('writer-articles-grid');
    const heading = document.getElementById('articles-heading');

    document.getElementById('stat-articles').textContent = articles.length;
    heading.textContent = `Articles (${articles.length})`;

    // Total likes
    const totalLikes = articles.reduce((sum, a) => sum + (a.likes || 0), 0);
    document.getElementById('stat-likes').textContent = totalLikes;

    grid.innerHTML = articles.length
      ? articles.map(articleCard).join('')
      : '<div class="empty-state"><div class="icon">📜</div><p>No articles published yet.</p></div>';
  } catch (e) {
    console.error(e);
  }
}

// ── Follow State ───────────────────────────────────────
async function checkFollowState(userId, wId) {
  try {
    const doc = await db.collection('follows').doc(`${userId}_${wId}`).get();
    isFollowing = doc.exists;
    updateFollowBtn();
  } catch (e) { /* ignore */ }
}

function updateFollowBtn() {
  const btn = document.getElementById('follow-btn');
  if (isFollowing) {
    btn.textContent = '✓ Following';
    btn.classList.add('following');
  } else {
    btn.textContent = 'Follow';
    btn.classList.remove('following');
  }
}

async function handleFollow() {
  const user = auth.currentUser;
  if (!user) { showAuthModal('login'); return; }

  const followId = `${user.uid}_${writerId}`;
  const followRef = db.collection('follows').doc(followId);
  const writerRef = db.collection('writers').doc(writerId);

  try {
    if (isFollowing) {
      // Unfollow
      await followRef.delete();
      await writerRef.update({ followerCount: firebase.firestore.FieldValue.increment(-1) });
      isFollowing = false;
      const curr = parseInt(document.getElementById('stat-followers').textContent || '0');
      document.getElementById('stat-followers').textContent = Math.max(0, curr - 1);
      showToast('Unfollowed');
    } else {
      // Follow
      await followRef.set({ followerId: user.uid, writerId, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      await writerRef.update({ followerCount: firebase.firestore.FieldValue.increment(1) });
      isFollowing = true;
      const curr = parseInt(document.getElementById('stat-followers').textContent || '0');
      document.getElementById('stat-followers').textContent = curr + 1;
      showToast('Following! JazakAllahu Khayran ✓');
    }
    updateFollowBtn();
  } catch (e) {
    console.error(e);
    showToast('Action failed. Please try again.');
  }
}
window.handleFollow = handleFollow;

loadWriter();
