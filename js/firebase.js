// ============================================================
// firebase.js — Firebase 8.10.0 Init & Config
// Replace firebaseConfig values with your actual project config
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyCZw0Dx_vVwquN8hOTFybVU3BsRYeSWkHM",
  authDomain: "story-d97ca.firebaseapp.com",
  databaseURL: "https://story-d97ca-default-rtdb.firebaseio.com",
  projectId: "story-d97ca",
  storageBucket: "story-d97ca.firebasestorage.app",
  messagingSenderId: "862986284987",
  appId: "1:862986284987:web:7734c6198595e6b6bbde9e",
  measurementId: "G-374L9VHFCV"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Firestore & Auth references
const db = firebase.firestore();
const auth = firebase.auth();

// ============================================================
// SAMPLE DATA SEED — Run once from admin panel or browser console
// Call: seedSampleData()
// ============================================================
async function seedSampleData() {
  const articles = [
    {
      title: "The Heart That Turns — Understanding Tawakkul in Surah Az-Zumar",
      slug: "tawakkul-surah-az-zumar",
      excerpt: "Tawakkul — true reliance on Allah — is not passivity. It is the highest form of action combined with the deepest trust. Surah Az-Zumar illuminates this beautifully.",
      content: `<p>The concept of <em>tawakkul</em> — often translated as "reliance on Allah" — is one of the most misunderstood virtues in Islamic spirituality. Many reduce it to passivity or fatalism. Yet the Qur'an, particularly in Surah Az-Zumar, paints a far richer picture.</p>

<blockquote class="verse">
  <p class="verse-arabic">قُلْ يَا عِبَادِيَ الَّذِينَ أَسْرَفُوا عَلَىٰ أَنفُسِهِمْ لَا تَقْنَطُوا مِن رَّحْمَةِ اللَّهِ</p>
  <p class="verse-translation">"Say: O My servants who have transgressed against themselves, do not despair of the mercy of Allah." — Qur'an 39:53</p>
  <button class="copy-verse-btn" onclick="copyVerse(this)">Copy Verse</button>
</blockquote>

<p>This verse encapsulates the essence of tawakkul: the believer acts, strives, and then surrenders the outcome entirely to Allah — not out of resignation, but out of certainty in His wisdom and mercy.</p>

<h2>The Two Dimensions of Tawakkul</h2>
<p>Scholars of tafsir identify two inseparable dimensions: outward effort (<em>asbab</em>) and inward surrender (<em>tafwid</em>). The Prophet ﷺ illustrated this when he advised tying the camel first, then placing trust in Allah.</p>

<p>Surah Az-Zumar dedicates an entire thematic arc to this: the contrast between those who, when afflicted, despair — and those who, when afflicted, turn toward their Lord with renewed certainty.</p>

<h2>Practical Implications</h2>
<p>For the modern Muslim navigating uncertainty — in career, health, or relationships — tawakkul offers not an escape from effort, but a liberation from anxiety about results. You plant. Allah gives the rain.</p>`,
      category: "Tafsir",
      tags: ["tawakkul", "surah az-zumar", "trust in allah", "tafsir"],
      image: "https://images.unsplash.com/photo-1542816417-0983c9c9ad53?w=800&auto=format",
      author: "Editorial Team",
      featured: true,
      likes: 47,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    },
    {
      title: "Reflections on Surah Al-Fatiha: The Seven Verses That Define a Muslim's Life",
      slug: "reflections-surah-al-fatiha",
      excerpt: "Al-Fatiha is recited seventeen times daily in prayer. Yet how deeply do we understand each word? A close reading reveals a complete worldview compressed into seven verses.",
      content: `<p>Surah Al-Fatiha — the Opening — is the most recited text in human history. A Muslim who prays five times daily recites it at least seventeen times. Yet familiarity can breed spiritual blindness. Let us pause and truly read it.</p>

<blockquote class="verse">
  <p class="verse-arabic">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
  <p class="verse-translation">"In the name of Allah, the Entirely Merciful, the Especially Merciful." — Qur'an 1:1</p>
  <button class="copy-verse-btn" onclick="copyVerse(this)">Copy Verse</button>
</blockquote>

<p>The surah opens not with a command, but with a name — the name of God. Before anything is said, done, or asked, we begin with attribution. This is the Islamic worldview in miniature: all things begin and end with Allah.</p>

<h2>A Dialogue Between Servant and Lord</h2>
<p>A hadith qudsi reveals that Allah said: "I have divided the prayer between Myself and My servant into two halves, and My servant shall have what he asks for." This transforms Al-Fatiha from a monologue into a conversation — each verse met with a divine response.</p>

<h2>The Central Verse</h2>
<blockquote class="verse">
  <p class="verse-arabic">إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ</p>
  <p class="verse-translation">"It is You we worship and You we ask for help." — Qur'an 1:5</p>
  <button class="copy-verse-btn" onclick="copyVerse(this)">Copy Verse</button>
</blockquote>

<p>This verse is the hinge of the surah — and perhaps of the entire Qur'an. It marks the transition from praise to petition. And it is phrased in the plural: we worship, we ask. Prayer, even in solitude, is a communal act.</p>`,
      category: "Reflection",
      tags: ["al-fatiha", "opening chapter", "prayer", "reflection"],
      image: "https://images.unsplash.com/photo-1519817914152-22d216bb9170?w=800&auto=format",
      author: "Editorial Team",
      featured: true,
      likes: 83,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    },
    {
      title: "Patience in the Qur'an: Why Allah Mentions Sabr Over 90 Times",
      slug: "patience-sabr-in-quran",
      excerpt: "No virtue is commanded more repeatedly in the Qur'an than patience. This is not coincidence — it is a blueprint for how the believer navigates the trials of existence.",
      content: `<p>If you searched the Qur'an for the root word <em>ṣ-b-r</em> (patience), you would find it in over ninety places. No other moral virtue — not generosity, not honesty, not courage — is mentioned with such frequency. This repetition is itself a message.</p>

<h2>Three Types of Sabr</h2>
<p>Classical scholars of tafsir distinguish three dimensions of patience:</p>
<ul>
  <li><strong>Patience in obedience</strong> — continuing to fulfill duties even when it is difficult</li>
  <li><strong>Patience from disobedience</strong> — restraining the self from what is forbidden</li>
  <li><strong>Patience with divine decree</strong> — accepting what Allah has written without resentment</li>
</ul>

<blockquote class="verse">
  <p class="verse-arabic">وَاسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ</p>
  <p class="verse-translation">"And seek help through patience and prayer." — Qur'an 2:45</p>
  <button class="copy-verse-btn" onclick="copyVerse(this)">Copy Verse</button>
</blockquote>

<p>Notice that Allah pairs patience with prayer — not wealth, not intelligence, not connections. These two are the twin pillars of the believer's coping mechanism.</p>

<h2>The Reward Without Measure</h2>
<blockquote class="verse">
  <p class="verse-arabic">إِنَّمَا يُوَفَّى الصَّابِرُونَ أَجْرَهُم بِغَيْرِ حِسَابٍ</p>
  <p class="verse-translation">"Indeed, the patient will be given their reward without account." — Qur'an 39:10</p>
  <button class="copy-verse-btn" onclick="copyVerse(this)">Copy Verse</button>
</blockquote>

<p>Every other deed in Islam has a multiplier — ten times, seven hundred times. But the reward of patience is described as <em>bila hisab</em>: beyond calculation. This alone tells us how precious this quality is to Allah.</p>`,
      category: "Lessons",
      tags: ["sabr", "patience", "virtues", "lessons from quran"],
      image: "https://images.unsplash.com/photo-1569426489641-24e7c0a4e1d9?w=800&auto=format",
      author: "Editorial Team",
      featured: false,
      likes: 62,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    },
    {
      title: "The Story of Musa and Khidr: What Surah Al-Kahf Teaches About Hidden Wisdom",
      slug: "musa-khidr-surah-al-kahf",
      excerpt: "The encounter between Prophet Musa and the mysterious Khidr in Surah Al-Kahf is one of the Qur'an's most philosophically rich narratives. What does it tell us about divine knowledge?",
      content: `<p>In Surah Al-Kahf, Allah narrates one of the most philosophically dense stories in the Qur'an: the journey of Prophet Musa with a mysterious figure known as Khidr. It is a story about the limits of human knowledge — and the wisdom that lies beyond what we can see.</p>

<h2>The Setup: Humility Before Knowledge</h2>
<p>The story begins when Musa tells his people that he is the most learned man on earth. Allah corrects him — not with punishment, but with a lesson. He sends Musa on a journey to meet a servant granted knowledge Musa does not possess.</p>

<blockquote class="verse">
  <p class="verse-arabic">فَوَجَدَا عَبْدًا مِّنْ عِبَادِنَا آتَيْنَاهُ رَحْمَةً مِّنْ عِندِنَا وَعَلَّمْنَاهُ مِن لَّدُنَّا عِلْمًا</p>
  <p class="verse-translation">"And they found a servant from among Our servants to whom We had given mercy from us and had taught him from Us a [certain] knowledge." — Qur'an 18:65</p>
  <button class="copy-verse-btn" onclick="copyVerse(this)">Copy Verse</button>
</blockquote>

<h2>Three Actions, Three Explanations</h2>
<p>Khidr performs three actions that horrify Musa: scuttling a boat, killing a boy, and repairing a wall without payment. Each time, Musa objects. Each time, Khidr reveals a wisdom Musa could not have seen.</p>

<p>The boat belonged to poor fishermen — Khidr damaged it to save it from a tyrannical king who seized good vessels. The boy would have grown to cause grief and disbelief to his believing parents. The wall hid a treasure for two orphans whose righteous father had buried it.</p>

<h2>The Lesson</h2>
<p>The story is a masterclass in <em>husn al-dhann billah</em> — thinking well of Allah. What appears to be loss may be protection. What appears to be tragedy may be mercy. The divine perspective always encompasses what our limited view cannot.</p>`,
      category: "Stories",
      tags: ["musa", "khidr", "surah al-kahf", "wisdom", "stories of prophets"],
      image: "https://images.unsplash.com/photo-1518638150340-f706e86654de?w=800&auto=format",
      author: "Editorial Team",
      featured: true,
      likes: 91,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    },
    {
      title: "Light Upon Light — A Thematic Study of Nur in the Qur'an",
      slug: "light-nur-thematic-study",
      excerpt: "Light — nur — is one of the Qur'an's most exquisite metaphors. From the famous Ayat al-Nur to scattered verses across 24 surahs, light weaves a theological and spiritual thread through the entire Book.",
      content: `<p>The Arabic word <em>nur</em> (light) appears in the Qur'an in some of its most beautiful and philosophically profound verses. It is not merely a physical phenomenon — it is a theological category, a description of divine guidance, and a metaphor for the believing heart.</p>

<h2>The Verse of Light</h2>
<blockquote class="verse">
  <p class="verse-arabic">اللَّهُ نُورُ السَّمَاوَاتِ وَالْأَرْضِ ۚ مَثَلُ نُورِهِ كَمِشْكَاةٍ فِيهَا مِصْبَاحٌ</p>
  <p class="verse-translation">"Allah is the Light of the heavens and the earth. The example of His light is like a niche within which is a lamp." — Qur'an 24:35</p>
  <button class="copy-verse-btn" onclick="copyVerse(this)">Copy Verse</button>
</blockquote>

<p>Ayat al-Nur — the Verse of Light — is considered by many scholars and poets to be the most beautiful verse in the Qur'an. Its imagery is layered: a niche, a lamp, a glass like a brilliant star, lit from a blessed olive tree. Each layer deepens the metaphor.</p>

<h2>Light as Guidance</h2>
<p>Throughout the Qur'an, light is consistently paired with the concept of guidance (<em>huda</em>). Darkness represents misguidance, confusion, and the state of a heart cut off from the divine. Light is what the Qur'an itself brings.</p>

<blockquote class="verse">
  <p class="verse-arabic">يَهْدِي بِهِ اللَّهُ مَنِ اتَّبَعَ رِضْوَانَهُ سُبُلَ السَّلَامِ</p>
  <p class="verse-translation">"By which Allah guides those who pursue His pleasure to the ways of peace." — Qur'an 5:16</p>
  <button class="copy-verse-btn" onclick="copyVerse(this)">Copy Verse</button>
</blockquote>

<h2>The Light of the Believer's Heart</h2>
<p>Ibn al-Qayyim wrote extensively about the <em>nur al-qalb</em> — the light of the heart. He described it as something that grows with remembrance of Allah and dims with sin. The Qur'an speaks of those whose light runs before them on the Day of Judgment — a tangible, visible manifestation of their faith.</p>`,
      category: "Tafsir",
      tags: ["nur", "light", "ayat al-nur", "tafsir", "surah an-nur"],
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format",
      author: "Editorial Team",
      featured: false,
      likes: 55,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }
  ];

  try {
    for (const article of articles) {
      await db.collection("articles").add(article);
      console.log("Seeded:", article.title);
    }
    console.log("✅ All sample articles seeded successfully.");
    alert("Sample data seeded! Refresh the page.");
  } catch (e) {
    console.error("Seed error:", e);
  }
}
