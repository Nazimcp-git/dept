// ==========================================================
// email.js — Subscription & EmailJS Notification Service
// ==========================================================
// SETUP (5 minutes):
//
// 1. Go to https://www.emailjs.com/ → Sign Up (free)
// 2. Add Email Service:
//    Dashboard → Email Services → Add New Service → Gmail
//    → Connect your Gmail → copy the SERVICE_ID
//
// 3. Create Email Template:
//    Dashboard → Email Templates → Create New Template
//    Set these fields:
//      To:       {{to_email}}
//      Subject:  New Article: {{article_title}}
//      Content:  (use the HTML body below, or write your own)
//    → Save → copy the TEMPLATE_ID
//
// 4. Get your Public Key:
//    Dashboard → Account → API Keys → copy Public Key
//
// 5. Paste all three below:
// ==========================================================

const EMAILJS_SERVICE_ID = 'service_wgbbk9v';   // e.g. 'service_abc123'
const EMAILJS_TEMPLATE_ID = 'template_k9642ep';  // e.g. 'template_xyz789'
const EMAILJS_PUBLIC_KEY = 'XW2yXrnm6ywU9Z6Tp';   // e.g. 'user_XXXXXXXX'

const SITE_NAME = 'Noor Al-Quran';
const SITE_URL = 'https://nazimcp-git.github.io/dept/';

// ──────────────────────────────────────────────────────────
// loadEmailJS()
// Dynamically loads the EmailJS SDK from CDN if not already loaded
// ──────────────────────────────────────────────────────────
function loadEmailJS() {
  return new Promise((resolve, reject) => {
    if (window.emailjs) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
    script.onload = () => {
      emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load EmailJS SDK'));
    document.head.appendChild(script);
  });
}

// ──────────────────────────────────────────────────────────
// subscribeUser(email)
// Saves an email to Firestore `subscribers` collection.
// Prevents duplicate subscriptions gracefully.
// ──────────────────────────────────────────────────────────
async function subscribeUser(email) {
  if (!email || !email.includes('@')) throw new Error('Invalid email address.');

  const normalized = email.toLowerCase().trim();
  const docRef = db.collection('subscribers').doc(normalized);
  const snap = await docRef.get();

  if (snap.exists) {
    throw new Error('already_subscribed');
  }

  await docRef.set({
    email: normalized,
    subscribedAt: firebase.firestore.FieldValue.serverTimestamp(),
    active: true
  });

  return true;
}
window.subscribeUser = subscribeUser;

// ──────────────────────────────────────────────────────────
// notifySubscribers(article)
// Called when a new article is published.
// Reads all active subscribers and sends each an email.
// ──────────────────────────────────────────────────────────
async function notifySubscribers(article) {
  try {
    await loadEmailJS();

    const snap = await db.collection('subscribers').where('active', '==', true).get();
    if (snap.empty) {
      console.log('No subscribers to notify.');
      return 0;
    }

    const subscribers = snap.docs.map(d => d.data());
    let successCount = 0;
    const errors = [];

    for (const sub of subscribers) {
      try {
        await sendEmailJSEmail(sub.email, article);
        successCount++;
        // Small delay to avoid rate limits (EmailJS: 1 req/s on free plan)
        await new Promise(r => setTimeout(r, 1100));
      } catch (e) {
        errors.push({ email: sub.email, error: e.message });
        console.error(`Failed to send to ${sub.email}:`, e);
      }
    }

    if (errors.length) console.warn('Some emails failed:', errors);
    return successCount;

  } catch (e) {
    console.error('notifySubscribers error:', e);
    throw e;
  }
}
window.notifySubscribers = notifySubscribers;

// ──────────────────────────────────────────────────────────
// sendEmailJSEmail(toEmail, article)
// Sends a single email via EmailJS SDK.
// Template variables match what you set up in EmailJS dashboard.
// ──────────────────────────────────────────────────────────
async function sendEmailJSEmail(toEmail, article) {
  await loadEmailJS();

  const articleUrl = `${SITE_URL}pages/article?id=${article.slug || article.id || ''}`;
  const unsubUrl = `${SITE_URL}#newsletter`;
  const imgSrc = article.image ||
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format';

  const templateParams = {
    to_email: toEmail,
    site_name: SITE_NAME,
    article_title: article.title || 'New Article',
    article_excerpt: article.excerpt || '',
    article_category: article.category || 'General',
    article_author: article.author || 'Editorial Team',
    article_url: articleUrl,
    article_image: imgSrc,
    unsub_url: unsubUrl,
    site_url: SITE_URL
  };

  const result = await emailjs.send(
    EMAILJS_SERVICE_ID,
    EMAILJS_TEMPLATE_ID,
    templateParams
  );

  if (result.status !== 200) {
    throw new Error(`EmailJS error: ${result.text}`);
  }

  return result;
}
window.sendEmailJSEmail = sendEmailJSEmail;

// ──────────────────────────────────────────────────────────
// sendBrevoEmail — alias kept for backward compatibility with
// admin.js sendTestEmail() function
// ──────────────────────────────────────────────────────────
async function sendBrevoEmail(toEmail, article) {
  return sendEmailJSEmail(toEmail, article);
}
window.sendBrevoEmail = sendBrevoEmail;
