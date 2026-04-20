// ==========================================================
// auth.js — Authentication System (Page-based)
// Redirects to /pages/auth for sign-in/register
// ==========================================================

// ── Global Auth State ──────────────────────────────────
let currentUser = null;
let currentUserData = null;

// Callbacks registered by other modules
const authStateCallbacks = [];
function onAuthChange(callback) { authStateCallbacks.push(callback); }

// ── Auth Prompt Modal ──────────────────────────────────
function injectAuthPrompt() {
  if (document.getElementById('auth-prompt-overlay')) return;
  const html = `
  <div class="auth-prompt-overlay" id="auth-prompt-overlay">
    <div class="auth-prompt-modal">
      <div class="auth-prompt-icon">☽</div>
      <h3>Sign in required</h3>
      <p>You need to sign in to perform this action.</p>
      <div class="auth-prompt-actions">
        <button class="btn-primary btn-full" id="auth-prompt-go">Sign In</button>
        <button class="btn-secondary btn-full" id="auth-prompt-cancel">Cancel</button>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);

  // Close on backdrop click
  document.getElementById('auth-prompt-overlay').addEventListener('click', e => {
    if (e.target.id === 'auth-prompt-overlay') hideAuthPrompt();
  });

  document.getElementById('auth-prompt-cancel').addEventListener('click', hideAuthPrompt);
}

function hideAuthPrompt() {
  const overlay = document.getElementById('auth-prompt-overlay');
  if (overlay) overlay.classList.remove('visible');
  document.body.style.overflow = '';
}

function showAuthModal(tab = 'login') {
  injectAuthPrompt();

  const isInPages = window.location.pathname.includes('/pages/');
  const basePath = isInPages ? 'auth' : 'pages/auth';
  const viewParam = tab === 'register' ? '?view=register' : '';

  // Wire the "Sign In" button to redirect
  const goBtn = document.getElementById('auth-prompt-go');
  goBtn.onclick = () => {
    window.location.href = basePath + viewParam;
  };

  // Show the modal
  document.getElementById('auth-prompt-overlay').classList.add('visible');
  document.body.style.overflow = 'hidden';
}
window.showAuthModal = showAuthModal;

// ── Sign Out ───────────────────────────────────────────
async function signOut() { return auth.signOut(); }
window.signOut = signOut;

// ── Friendly Error Messages ────────────────────────────
function friendlyError(code) {
  const map = {
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/invalid-credential': 'Invalid email or password.'
  };
  return map[code] || 'Something went wrong. Please try again.';
}

// ── Auth State Observer ────────────────────────────────
function initAuth(onLogin, onLogout) {
  auth.onAuthStateChanged(async user => {
    currentUser = user;
    if (user) {
      // Load or create user doc
      try {
        const doc = await db.collection('users').doc(user.uid).get();
        if (doc.exists) {
          currentUserData = doc.data();
        } else {
          const data = {
            uid: user.uid,
            displayName: user.displayName || user.email.split('@')[0],
            email: user.email,
            role: 'reader',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          };
          await db.collection('users').doc(user.uid).set(data);
          currentUserData = data;
        }
      } catch (e) { currentUserData = null; }
      authStateCallbacks.forEach(cb => cb(user, currentUserData));
      if (onLogin) onLogin(user, currentUserData);
    } else {
      currentUserData = null;
      authStateCallbacks.forEach(cb => cb(null, null));
      if (onLogout) onLogout();
    }
  });
}

// ── Inject Navbar Auth UI ──────────────────────────────
function injectNavbarAuth() {
  const actions = document.querySelector('.nav-actions');
  if (!actions) return;

  // Remove existing auth buttons
  actions.querySelectorAll('.btn-login, .user-nav').forEach(el => el.remove());

  if (currentUser) {
    const name = (currentUser.displayName || currentUser.email || 'U');
    const initial = name[0].toUpperCase();
    const userNav = document.createElement('div');
    userNav.className = 'user-nav';
    userNav.innerHTML = `
      <button class="user-avatar-btn" id="user-avatar-btn" onclick="toggleUserDropdown()" aria-label="User menu">
        ${initial}
      </button>
      <div class="user-dropdown" id="user-dropdown">
        <div class="dropdown-header">
          <div class="d-name">${name}</div>
          <div class="d-email">${currentUser.email}</div>
        </div>
        <a class="dropdown-item" href="${window.location.pathname.includes('/pages/') ? 'bookmarks' : 'pages/bookmarks'}">🔖 My Bookmarks</a>
        <div class="dropdown-divider"></div>
        <button class="dropdown-item danger" onclick="handleNavSignOut()">🚪 Sign Out</button>
      </div>`;
    actions.appendChild(userNav);

    // Close dropdown on outside click
    document.addEventListener('click', e => {
      const nav = document.getElementById('user-dropdown');
      const btn = document.getElementById('user-avatar-btn');
      if (nav && btn && !nav.contains(e.target) && !btn.contains(e.target)) {
        nav.classList.remove('open');
      }
    });
  } else {
    const btn = document.createElement('button');
    btn.className = 'btn-login';
    btn.textContent = 'Sign In';
    btn.onclick = () => showAuthModal('login');
    actions.appendChild(btn);
  }
}

function toggleUserDropdown() {
  document.getElementById('user-dropdown')?.classList.toggle('open');
}
window.toggleUserDropdown = toggleUserDropdown;

async function handleNavSignOut() {
  await signOut();
  window.location.reload();
}
window.handleNavSignOut = handleNavSignOut;

// ── Helper: require login ──────────────────────────────
// Call this before any auth-gated action
function requireAuth(action) {
  if (currentUser) { action(); }
  else { showAuthModal('login'); }
}
window.requireAuth = requireAuth;

// ── Auto-init navbar auth on DOM ready ────────────────
document.addEventListener('DOMContentLoaded', () => {
  auth.onAuthStateChanged(user => {
    currentUser = user;
    injectNavbarAuth();
  });
});
