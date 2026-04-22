// ==========================================================
// email.js — Subscription & Brevo Email Notification Service
// ==========================================================
// Replace BREVO_API_KEY with your actual key from:
//   https://app.brevo.com → Settings → API Keys
// Replace BREVO_SENDER.email with your verified sender address.
// ==========================================================

const BREVO_API_KEY = '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';

const BREVO_SENDER = {
  name: 'Noor Al-Quran',
  email: 'nazimcpunity@gmail.com' // ← Replace with your verified Brevo sender
};

const SITE_URL = 'https://nazimcp-git.github.io/dept/'; // ← Replace with your actual site URL

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
// Reads all active subscribers from Firestore and sends
// an email to each via the Brevo SMTP API.
// ──────────────────────────────────────────────────────────
async function notifySubscribers(article) {
  try {
    const snap = await db.collection('subscribers').where('active', '==', true).get();
    if (snap.empty) {
      console.log('No subscribers to notify.');
      return 0;
    }

    const subscribers = snap.docs.map(d => d.data());
    let successCount = 0;
    const errors = [];

    // Send in small batches to avoid rate limits (Brevo free: 300/day)
    for (const sub of subscribers) {
      try {
        await sendBrevoEmail(sub.email, article);
        successCount++;
      } catch (e) {
        errors.push({ email: sub.email, error: e.message });
        console.error(`Failed to send to ${sub.email}:`, e);
      }
    }

    if (errors.length) {
      console.warn('Some emails failed:', errors);
    }

    return successCount;
  } catch (e) {
    console.error('notifySubscribers error:', e);
    throw e;
  }
}
window.notifySubscribers = notifySubscribers;

// ──────────────────────────────────────────────────────────
// sendBrevoEmail(toEmail, article)
// Sends a single rich HTML email via Brevo REST API.
// ──────────────────────────────────────────────────────────
async function sendBrevoEmail(toEmail, article) {
  const articleUrl = `${SITE_URL}/pages/article?id=${article.slug || article.id || ''}`;
  const unsubUrl = `${SITE_URL}/unsubscribe?email=${encodeURIComponent(toEmail)}`;

  const htmlContent = buildEmailTemplate(article, articleUrl, unsubUrl);
  const textContent = buildPlainText(article, articleUrl);

  const payload = {
    sender: BREVO_SENDER,
    to: [{ email: toEmail }],
    subject: `New Article: ${article.title}`,
    htmlContent,
    textContent
  };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Brevo API error ${response.status}: ${errorData.message || response.statusText}`);
  }

  return await response.json();
}

// ──────────────────────────────────────────────────────────
// buildEmailTemplate(article, articleUrl, unsubUrl)
// Returns a rich HTML email string.
// ──────────────────────────────────────────────────────────
function buildEmailTemplate(article, articleUrl, unsubUrl) {
  const imgSrc = article.image ||
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format';
  const category = article.category || 'General';
  const excerpt = article.excerpt || '';
  const author = article.author || 'Editorial Team';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${article.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, 'Times New Roman', serif; background: #F5F0E8; color: #2C2C2C; }
    .wrapper { max-width: 600px; margin: 0 auto; background: #FFFFFF; }
    .header { background: linear-gradient(135deg, #1B4332 0%, #0F2D22 100%); padding: 40px 32px; text-align: center; }
    .header-brand { color: #D4A853; font-size: 13px; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 8px; }
    .header-title { color: #FFFFFF; font-size: 28px; font-weight: normal; line-height: 1.3; }
    .hero-img { width: 100%; height: 240px; object-fit: cover; display: block; }
    .body { padding: 36px 32px; }
    .meta-row { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .badge { background: #1B4332; color: #fff; font-size: 11px; font-family: Arial, sans-serif; letter-spacing: 1px; text-transform: uppercase; padding: 4px 10px; border-radius: 4px; }
    .meta-author { color: #888; font-family: Arial, sans-serif; font-size: 13px; }
    .article-title { font-size: 22px; color: #1B4332; line-height: 1.4; margin-bottom: 16px; }
    .excerpt { font-size: 16px; line-height: 1.75; color: #4A4A4A; margin-bottom: 28px; }
    .cta-wrapper { text-align: center; margin-bottom: 36px; }
    .cta-btn { display: inline-block; background: linear-gradient(135deg, #1B4332, #2D6A4F); color: #ffffff !important; font-family: Arial, sans-serif; font-size: 15px; font-weight: bold; text-decoration: none; padding: 14px 36px; border-radius: 8px; letter-spacing: 0.5px; }
    .divider { border: none; border-top: 1px solid #E8E0D0; margin: 28px 0; }
    .quote { background: #F9F6F0; border-left: 3px solid #D4A853; padding: 16px 20px; margin: 24px 0; font-style: italic; color: #555; font-size: 15px; line-height: 1.7; }
    .footer { background: #1B4332; padding: 28px 32px; text-align: center; }
    .footer p { color: rgba(255,255,255,0.6); font-family: Arial, sans-serif; font-size: 12px; line-height: 1.8; margin-bottom: 6px; }
    .footer a { color: #D4A853; text-decoration: none; }
    @media (max-width: 480px) {
      .body { padding: 24px 20px; }
      .header { padding: 28px 20px; }
      .article-title { font-size: 19px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <!-- Header -->
    <div class="header">
      <div class="header-brand">☽ Noor Al-Quran</div>
      <div class="header-title">A new article has been published for you</div>
    </div>

    <!-- Hero Image -->
    <img class="hero-img" src="${imgSrc}" alt="${article.title}"/>

    <!-- Body -->
    <div class="body">
      <div class="meta-row">
        <span class="badge">${category}</span>
        <span class="meta-author">by ${author}</span>
      </div>

      <h1 class="article-title">${article.title}</h1>

      <p class="excerpt">${excerpt}</p>

      <div class="quote">
        "And We have certainly made the Qur'an easy for remembrance, so is there any who will remember?" — Qur'an 54:17
      </div>

      <div class="cta-wrapper">
        <a href="${articleUrl}" class="cta-btn">Read Full Article →</a>
      </div>

      <hr class="divider"/>

      <p style="font-family:Arial,sans-serif;font-size:14px;color:#888;text-align:center;line-height:1.7;">
        You are receiving this email because you subscribed to Noor Al-Quran.<br/>
        <a href="${unsubUrl}" style="color:#1B4332;">Unsubscribe</a>
      </p>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p><strong style="color:#fff;">☽ Noor Al-Quran</strong></p>
      <p>Reflections, Tafsir &amp; Lessons from the Qur'an</p>
      <p><a href="${SITE_URL}">${SITE_URL}</a></p>
    </div>
  </div>
</body>
</html>`;
}

// ──────────────────────────────────────────────────────────
// buildPlainText — fallback plain text version
// ──────────────────────────────────────────────────────────
function buildPlainText(article, articleUrl) {
  return `☽ Noor Al-Quran — New Article

${article.title}
${'─'.repeat(60)}

${article.excerpt || ''}

Read the full article: ${articleUrl}

─────────────────────────────────────────────────────────────
You received this because you subscribed to Noor Al-Quran.
To unsubscribe, visit: ${SITE_URL}/unsubscribe
`;
}
