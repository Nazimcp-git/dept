// ══════════════════════════════════════════════════════════
// AUDIO PLAYER — StreamElements (Amazon Polly) Neural TTS
// Realistic male voices via Amazon Polly neural engine
// ══════════════════════════════════════════════════════════

const AudioPlayer = (() => {
  // ── State ──
  let chunks = [];
  let chunkOffsets = [];
  let currentChunkIndex = 0;
  let audio = new Audio();
  let isPlaying = false;
  let isPaused = false;
  let articleText = '';
  let totalChars = 0;
  let spokenChars = 0;
  let speeds = [0.75, 1, 1.25, 1.5, 2];
  let speedIndex = 1;
  let waveformBars = [];
  let waveAnimFrame = null;
  let progressInterval = null;
  let estimatedDuration = 0;
  let elapsedTime = 0;
  let startTimestamp = 0;
  let selectedVoice = 'Brian';
  let useFallback = false;

  // Male voices available via StreamElements (Amazon Polly)
  const voiceOptions = [
    { code: 'Matthew', label: ' US Male' },
    { code: 'Geraint', label: '🏴 Geraint — Welsh Male' }
  ];

  // ── DOM refs ──
  const playBtn = document.getElementById('audio-play-btn');
  const playIcon = document.getElementById('audio-play-icon');
  const pauseIcon = document.getElementById('audio-pause-icon');
  const stopBtn = document.getElementById('audio-stop-btn');
  const speedBtn = document.getElementById('audio-speed-btn');
  const voiceSelect = document.getElementById('audio-voice-select');
  const waveformEl = document.getElementById('audio-waveform');
  const progressBar = document.getElementById('audio-progress-bar');
  const progressFill = document.getElementById('audio-progress-fill');
  const timeCurrent = document.getElementById('audio-time-current');
  const timeTotal = document.getElementById('audio-time-total');

  // ── Init ──
  function init() {
    populateVoices();
    generateWaveform();
    bindEvents();
    setupAudioEvents();
  }

  function populateVoices() {
    voiceSelect.innerHTML = '';
    voiceOptions.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.code;
      opt.textContent = v.label;
      voiceSelect.appendChild(opt);
    });
  }

  // ── StreamElements TTS URL (Amazon Polly voices) ──
  function getTTSUrl(text, voice) {
    return `https://api.streamelements.com/kappa/v2/speech?voice=${voice}&text=${encodeURIComponent(text)}`;
  }

  // ── Extract text from HTML ──
  function extractText(html) {
    const div = document.createElement('div');
    div.innerHTML = html || '';
    div.querySelectorAll('script, style, .copy-verse-btn').forEach(el => el.remove());
    let text = div.textContent || div.innerText || '';
    return text.replace(/\s+/g, ' ').trim();
  }

  // ── Set article ──
  function setArticle(art) {
    articleText = extractText(art.content);
    totalChars = articleText.length;
    const words = totalChars / 5;
    estimatedDuration = Math.ceil((words / 150) * 60);
    timeTotal.textContent = formatTime(estimatedDuration);
    // Pre-chunk
    buildChunks();
  }

  // ── Chunk text (~190 chars at sentence boundaries) ──
  function buildChunks() {
    const maxLen = 190;
    chunks = [];
    chunkOffsets = [];
    let remaining = articleText;
    let offset = 0;

    while (remaining.length > 0) {
      if (remaining.length <= maxLen) {
        chunks.push(remaining);
        chunkOffsets.push(offset);
        break;
      }
      let bp = -1;
      for (let i = maxLen; i > maxLen * 0.4; i--) {
        const ch = remaining[i];
        if ('.!?;\n'.includes(ch)) { bp = i + 1; break; }
      }
      if (bp === -1) {
        for (let i = maxLen; i > maxLen * 0.4; i--) {
          if (remaining[i] === ' ') { bp = i + 1; break; }
        }
      }
      if (bp === -1) bp = maxLen;
      chunks.push(remaining.substring(0, bp));
      chunkOffsets.push(offset);
      offset += bp;
      remaining = remaining.substring(bp).trimStart();
      const trimmed = remaining.length;
      offset = articleText.length - trimmed;
    }
  }

  // ── Audio element events ──
  function setupAudioEvents() {
    audio.addEventListener('ended', () => {
      spokenChars = (chunkOffsets[currentChunkIndex] || 0) + (chunks[currentChunkIndex] || '').length;
      currentChunkIndex++;
      updateProgress();
      if (currentChunkIndex < chunks.length && isPlaying) {
        playChunk(currentChunkIndex);
      } else if (currentChunkIndex >= chunks.length) {
        onFinished();
      }
    });

    audio.addEventListener('error', () => {
      console.warn('Google TTS failed, switching to Web Speech API fallback');
      useFallback = true;
      playChunkFallback(currentChunkIndex);
    });

    audio.addEventListener('timeupdate', () => {
      if (!isPlaying) return;
      elapsedTime = (Date.now() - startTimestamp) / 1000;
      updateProgress();
    });
  }

  // ── Play a specific chunk ──
  function playChunk(index) {
    if (index >= chunks.length) { onFinished(); return; }
    currentChunkIndex = index;

    if (useFallback) {
      playChunkFallback(index);
      return;
    }

    const url = getTTSUrl(chunks[index], selectedVoice);
    audio.src = url;
    audio.playbackRate = speeds[speedIndex];
    audio.play().then(() => {
      startWaveAnimation();
      // Preload next chunk
      if (index + 1 < chunks.length) {
        const preload = new Audio();
        preload.src = getTTSUrl(chunks[index + 1], selectedVoice);
        preload.preload = 'auto';
      }
    }).catch(() => {
      console.warn('Google TTS blocked, using fallback');
      useFallback = true;
      playChunkFallback(index);
    });
  }

  // ── Web Speech API Fallback ──
  function playChunkFallback(index) {
    if (index >= chunks.length) { onFinished(); return; }
    currentChunkIndex = index;
    const synth = window.speechSynthesis;
    if (!synth) { onFinished(); return; }

    const utt = new SpeechSynthesisUtterance(chunks[index]);
    utt.rate = speeds[speedIndex];
    utt.pitch = 1;
    utt.volume = 1;

    // Pick best MALE voice only
    const voices = synth.getVoices();
    const maleVoices = voices.filter(v => {
      if (!v.lang.startsWith('en')) return false;
      const n = v.name.toLowerCase();
      // Exclude known female voices
      if (n.includes('female') || n.includes('zira') || n.includes('samantha') ||
        n.includes('victoria') || n.includes('karen') || n.includes('moira') ||
        n.includes('fiona') || n.includes('tessa') || n.includes('veena') ||
        n.includes('jenny') || n.includes('aria') || n.includes('sara') ||
        n.includes('libby') || n.includes('emily') || n.includes('sonia')) return false;
      return true;
    }).sort((a, b) => {
      const sc = v => {
        let s = 0; const n = v.name.toLowerCase();
        if (n.includes('natural') || n.includes('neural')) s += 100;
        if (n.includes('enhanced') || n.includes('premium')) s += 50;
        if (n.includes('male') || n.includes('david') || n.includes('mark') ||
          n.includes('james') || n.includes('guy') || n.includes('ryan') ||
          n.includes('roger')) s += 40;
        if (n.includes('google')) s += 30;
        if (v.localService === false) s += 10;
        return s;
      };
      return sc(b) - sc(a);
    });
    if (maleVoices.length) utt.voice = maleVoices[0];

    utt.onend = () => {
      spokenChars = (chunkOffsets[index] || 0) + chunks[index].length;
      currentChunkIndex++;
      updateProgress();
      if (currentChunkIndex < chunks.length && isPlaying) {
        playChunkFallback(currentChunkIndex);
      } else if (currentChunkIndex >= chunks.length) {
        onFinished();
      }
    };
    utt.onerror = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      onFinished();
    };
    utt.onstart = () => startWaveAnimation();

    synth.speak(utt);
  }

  // ── Playback Controls ──
  function play() {
    if (!articleText || !chunks.length) return;
    selectedVoice = voiceSelect.value || 'Brian';

    if (isPaused) {
      // Resume
      if (!useFallback) {
        audio.play();
      } else {
        window.speechSynthesis && window.speechSynthesis.resume();
      }
      isPaused = false;
      isPlaying = true;
      startTimestamp = Date.now() - (elapsedTime * 1000);
      startProgressTimer();
      startWaveAnimation();
      updatePlayUI();
      return;
    }

    // Fresh start
    stopInternal();
    currentChunkIndex = 0;
    spokenChars = 0;
    elapsedTime = 0;
    isPlaying = true;
    isPaused = false;
    startTimestamp = Date.now();
    useFallback = false;

    playChunk(0);
    startProgressTimer();
    updatePlayUI();
  }

  function pause() {
    if (!isPlaying) return;
    if (!useFallback) {
      audio.pause();
    } else {
      window.speechSynthesis && window.speechSynthesis.pause();
    }
    isPaused = true;
    isPlaying = false;
    elapsedTime = (Date.now() - startTimestamp) / 1000;
    stopProgressTimer();
    stopWaveAnimation();
    updatePlayUI();
  }

  function stopInternal() {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    isPlaying = false;
    isPaused = false;
    currentChunkIndex = 0;
    spokenChars = 0;
    elapsedTime = 0;
    stopProgressTimer();
    stopWaveAnimation();
    progressFill.style.width = '0%';
    timeCurrent.textContent = '0:00';
    resetWaveformColors();
    updatePlayUI();
  }

  function stop() { stopInternal(); }

  function togglePlayPause() {
    isPlaying ? pause() : play();
  }

  function cycleSpeed() {
    speedIndex = (speedIndex + 1) % speeds.length;
    speedBtn.textContent = speeds[speedIndex] + '×';
    if (!useFallback && isPlaying) {
      audio.playbackRate = speeds[speedIndex];
    } else if (isPlaying || isPaused) {
      // For fallback, need to restart
      const savedChunk = currentChunkIndex;
      stopInternal();
      currentChunkIndex = savedChunk;
      spokenChars = chunkOffsets[savedChunk] || 0;
      isPlaying = true;
      startTimestamp = Date.now();
      playChunk(savedChunk);
      startProgressTimer();
      updatePlayUI();
    }
  }

  function onFinished() {
    isPlaying = false;
    isPaused = false;
    stopProgressTimer();
    stopWaveAnimation();
    progressFill.style.width = '100%';
    timeCurrent.textContent = timeTotal.textContent;
    waveformBars.forEach(b => b.classList.add('played'));
    updatePlayUI();
    setTimeout(() => {
      currentChunkIndex = 0;
      spokenChars = 0;
      elapsedTime = 0;
      progressFill.style.width = '0%';
      timeCurrent.textContent = '0:00';
      resetWaveformColors();
    }, 3000);
  }

  // ── Progress ──
  function startProgressTimer() {
    stopProgressTimer();
    progressInterval = setInterval(() => {
      if (!isPlaying) return;
      elapsedTime = (Date.now() - startTimestamp) / 1000;
      updateProgress();
    }, 250);
  }

  function stopProgressTimer() {
    if (progressInterval) { clearInterval(progressInterval); progressInterval = null; }
  }

  function updateProgress() {
    const charProg = totalChars > 0 ? spokenChars / totalChars : 0;
    const sp = speeds[speedIndex];
    const adjDur = estimatedDuration / sp;
    const timeProg = adjDur > 0 ? elapsedTime / adjDur : 0;
    const progress = Math.min(1, Math.max(charProg, timeProg * 0.9));
    progressFill.style.width = (progress * 100) + '%';
    timeCurrent.textContent = formatTime(Math.floor(elapsedTime));
    const playedBars = Math.floor(progress * waveformBars.length);
    waveformBars.forEach((bar, i) => bar.classList.toggle('played', i < playedBars));
  }

  // ── Waveform ──
  function generateWaveform() {
    waveformEl.innerHTML = '';
    waveformBars = [];
    for (let i = 0; i < 48; i++) {
      const bar = document.createElement('div');
      bar.className = 'audio-waveform-bar';
      const x = i / 48;
      const h = Math.max(12, Math.min(100,
        30 + Math.sin(x * Math.PI) * 60 +
        Math.sin(x * Math.PI * 5.7) * 15 +
        Math.sin(x * Math.PI * 13.3 + 0.5) * 8 +
        (Math.random() - 0.5) * 12
      ));
      bar.style.height = h + '%';
      waveformEl.appendChild(bar);
      waveformBars.push(bar);
    }
  }

  function startWaveAnimation() {
    waveformEl.classList.add('active');
    animateWaveBars();
  }

  function stopWaveAnimation() {
    waveformEl.classList.remove('active');
    waveformBars.forEach(b => { b.classList.remove('animating'); b.style.animationDelay = ''; });
    if (waveAnimFrame) { cancelAnimationFrame(waveAnimFrame); waveAnimFrame = null; }
  }

  function animateWaveBars() {
    if (!isPlaying) return;
    const prog = totalChars > 0 ? spokenChars / totalChars : 0;
    const center = Math.floor(prog * waveformBars.length);
    waveformBars.forEach((bar, i) => {
      const d = Math.abs(i - center);
      if (d < 4) { bar.classList.add('animating'); bar.style.animationDelay = (d * 0.08) + 's'; }
      else { bar.classList.remove('animating'); bar.style.animationDelay = ''; }
    });
    waveAnimFrame = requestAnimationFrame(() => setTimeout(animateWaveBars, 300));
  }

  function resetWaveformColors() {
    waveformBars.forEach(b => { b.classList.remove('played', 'animating'); b.style.animationDelay = ''; });
  }

  // ── UI ──
  function updatePlayUI() {
    if (isPlaying) {
      playBtn.classList.add('playing');
      playIcon.classList.add('hidden');
      pauseIcon.classList.remove('hidden');
    } else {
      playBtn.classList.remove('playing');
      playIcon.classList.remove('hidden');
      pauseIcon.classList.add('hidden');
    }
  }

  function formatTime(secs) {
    if (!secs || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  // ── Events ──
  function bindEvents() {
    playBtn.addEventListener('click', togglePlayPause);
    stopBtn.addEventListener('click', stop);
    speedBtn.addEventListener('click', cycleSpeed);

    voiceSelect.addEventListener('change', () => {
      selectedVoice = voiceSelect.value;
      if (isPlaying || isPaused) {
        const savedChunk = currentChunkIndex;
        stopInternal();
        currentChunkIndex = savedChunk;
        spokenChars = chunkOffsets[savedChunk] || 0;
        useFallback = false;
        isPlaying = true;
        startTimestamp = Date.now();
        playChunk(savedChunk);
        startProgressTimer();
        updatePlayUI();
      }
    });

    progressBar.addEventListener('click', (e) => {
      if (!chunks.length) return;
      const rect = progressBar.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const targetChar = Math.floor(pct * totalChars);
      let targetChunk = 0;
      for (let i = 0; i < chunks.length; i++) {
        if ((chunkOffsets[i] || 0) + chunks[i].length > targetChar) { targetChunk = i; break; }
      }
      stopInternal();
      currentChunkIndex = targetChunk;
      spokenChars = chunkOffsets[targetChunk] || 0;
      elapsedTime = (pct * estimatedDuration) / speeds[speedIndex];
      startTimestamp = Date.now() - (elapsedTime * 1000);
      isPlaying = true;
      playChunk(targetChunk);
      startProgressTimer();
      updatePlayUI();
      updateProgress();
    });
  }

  return { init, setArticle };
})();
