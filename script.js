/**
 * ============================================================================
 * JOHN'S QUIZ SITE - REACT APPLICATION (script.js)
 *
 * Built with React 18 loaded from a CDN (see index.html). There is no build
 * step and no JSX: components use React.createElement (aliased to `h`), so the
 * site still runs as three plain files, even when opened straight from disk.
 *
 * Contents:
 *  1. Constants & fallback data
 *  2. Helpers (storage, sound, shuffle, decode)
 *  3. <Icon>            - Lucide icons rendered as React SVG elements
 *  4. <BackdropCanvas>  - Falling, cursor-reactive question-mark backdrop
 *  5. <Navbar>
 *  6. <Landing>
 *  7. <Subjects>        - Category picker with live search
 *  8. <Quiz>            - Gameplay: timer, streaks, feedback
 *  9. <Results>         - Summary + answer review
 * 10. <Leaderboard>     - Modal backed by localStorage
 * 11. <App>             - Root component, owns navigation & shared state
 * ============================================================================
 */

const { useState, useEffect, useRef, useCallback } = React;
const h = React.createElement;

/* ============================================================================
   1. CONSTANTS & FALLBACK DATA
   ============================================================================ */
const QUESTION_TIME = 20; // seconds per question
const TIMEOUT = '__timeout__'; // sentinel stored in `selected` when time expires
const THEME_KEY = 'johns_quiz_theme';
const SCORES_KEY = 'johns_quiz_scores';

// Used if the Open Trivia DB categories request fails or is throttled
const FALLBACK_CATEGORIES = [
  { id: 9, name: 'General Knowledge', icon: 'brain', color: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
  { id: 17, name: 'Science & Nature', icon: 'leaf', color: 'linear-gradient(135deg, #10b981, #047857)' },
  { id: 18, name: 'Computers & Tech', icon: 'laptop', color: 'linear-gradient(135deg, #06b6d4, #0284c7)' },
  { id: 19, name: 'Mathematics', icon: 'calculator', color: 'linear-gradient(135deg, #f59e0b, #d97706)' },
  { id: 21, name: 'Sports', icon: 'trophy', color: 'linear-gradient(135deg, #22c55e, #15803d)' },
  { id: 22, name: 'Geography', icon: 'globe', color: 'linear-gradient(135deg, #0ea5e9, #4f46e5)' },
  { id: 23, name: 'History', icon: 'landmark', color: 'linear-gradient(135deg, #d97706, #b45309)' },
  { id: 11, name: 'Film & Movies', icon: 'film', color: 'linear-gradient(135deg, #f43f5e, #be123c)' },
  { id: 12, name: 'Music', icon: 'music', color: 'linear-gradient(135deg, #a855f7, #7e22ce)' },
  { id: 15, name: 'Video Games', icon: 'gamepad-2', color: 'linear-gradient(135deg, #d946ef, #a21caf)' }
];

// Used if the trivia questions request fails or is throttled
const FALLBACK_QUESTIONS = [
  {
    category: 'General Knowledge',
    question: 'Which iconic landmark is located in Paris, France?',
    correct_answer: 'Eiffel Tower',
    options: ['Eiffel Tower', 'Empire State Building', 'Colosseum', 'Big Ben']
  },
  {
    category: 'Science & Nature',
    question: 'What is the chemical symbol for Oxygen?',
    correct_answer: 'O',
    options: ['O', 'Ox', 'Og', 'Om']
  },
  {
    category: 'Computers & Tech',
    question: 'What does CPU stand for in computer systems?',
    correct_answer: 'Central Processing Unit',
    options: ['Central Processing Unit', 'Central Power Unit', 'Computer Performance Unit', 'Core Processing Utility']
  },
  {
    category: 'Geography',
    question: 'What is the capital city of Japan?',
    correct_answer: 'Tokyo',
    options: ['Tokyo', 'Kyoto', 'Osaka', 'Seoul']
  },
  {
    category: 'General Knowledge',
    question: 'How many days are in a standard leap year?',
    correct_answer: '366',
    options: ['366', '365', '364', '360']
  }
];

/* ============================================================================
   2. HELPERS
   ============================================================================ */

// localStorage can throw (private windows, blocked storage) so always guard it
function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : raw;
  } catch (e) {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (e) { /* ignore */ }
}

function readScores() {
  try {
    return JSON.parse(readStorage(SCORES_KEY, '[]')) || [];
  } catch (e) {
    return [];
  }
}

function decodeHTML(html) {
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// --- Web Audio synthesizer (no external audio files) ---
const AudioCtor = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let soundEnabled = true; // kept in sync with React state by <App>

function playSound(type) {
  if (!soundEnabled || !AudioCtor) return;
  try {
    if (!audioCtx) audioCtx = new AudioCtor();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'correct') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'wrong') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(130.81, now + 0.2);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  } catch (e) {
    console.error('Audio synth error', e);
  }
}

/* ============================================================================
   3. ICON COMPONENT
   Lucide's own createIcons() swaps <i> tags for <svg> behind React's back,
   which breaks reconciliation. Instead we read Lucide's icon data and let
   React render the <svg> itself.
   ============================================================================ */
const ICON_ALIASES = {
  'circle-help': ['HelpCircle'],
  'circle-check-big': ['CheckCircle2', 'CheckCircle'],
  'circle-alert': ['AlertCircle'],
  'square-check-big': ['CheckSquare'],
  'grid-3x3': ['Grid', 'Grid3X3'],
  'sliders-horizontal': ['Sliders']
};

function toPascal(name) {
  return name.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

function findIconNode(name) {
  const icons = (window.lucide && window.lucide.icons) || {};
  const candidates = [toPascal(name), ...(ICON_ALIASES[name] || [])];
  for (const c of candidates) if (icons[c]) return icons[c];
  return null;
}

function Icon({ name, className = '' }) {
  const node = findIconNode(name);
  if (!node) return h('span', { className: `icon-fallback ${className}`, 'aria-hidden': true });

  return h(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width: 24,
      height: 24,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className,
      'aria-hidden': true
    },
    node[2].map(([tag, attrs], i) => {
      const { key, ...rest } = attrs || {};
      return h(tag, { key: i, ...rest });
    })
  );
}

/* ============================================================================
   4. ANIMATED BACKDROP CANVAS
   The canvas is owned by React, but the animation loop runs outside React's
   render cycle (inside one effect) so 60fps drawing never triggers re-renders.
   The current theme is passed in through a ref so the loop never restarts.
   ============================================================================ */
const LIGHT_COLORS = ['#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];
const DARK_COLORS = ['#38bdf8', '#a855f7', '#f472b6', '#4ade80', '#fbbf24', '#60a5fa', '#c084fc'];

function BackdropCanvas({ theme }) {
  const canvasRef = useRef(null);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const mouse = { x: -1000, y: -1000, radius: 140 };
    let width = 0;
    let height = 0;
    let particles = [];
    let frameId = 0;

    class QuestionMark {
      constructor() {
        this.reset(true);
      }

      reset(initial = false) {
        this.x = Math.random() * width;
        this.y = initial ? Math.random() * height : -40;
        this.fontSize = Math.floor(Math.random() * 30) + 16; // 16-45px
        this.colorIdx = Math.floor(Math.random() * LIGHT_COLORS.length);
        this.speedY = (this.fontSize / 24) * 0.75 + 0.35; // bigger = falls faster
        this.speedX = (Math.random() - 0.5) * 0.4;
        this.angle = Math.random() * Math.PI * 2;
        this.spinSpeed = (Math.random() - 0.5) * 0.02;
        this.opacity = Math.random() * 0.45 + 0.35;
      }

      update() {
        this.y += this.speedY;
        this.x += this.speedX;
        this.angle += this.spinSpeed;

        // Push away from the cursor / finger
        const dx = this.x - mouse.x;
        const dy = this.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouse.radius) {
          const force = (mouse.radius - dist) / mouse.radius;
          const a = Math.atan2(dy, dx);
          this.x += Math.cos(a) * force * 4;
          this.y += Math.sin(a) * force * 4;
        }

        if (this.y > height + 50 || this.x < -50 || this.x > width + 50) this.reset(false);
      }

      draw(isDark) {
        const palette = isDark ? DARK_COLORS : LIGHT_COLORS;
        const color = palette[this.colorIdx % palette.length];

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.globalAlpha = isDark ? Math.min(this.opacity + 0.15, 0.95) : this.opacity;
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = isDark ? 10 : 0; // neon glow in dark mode only
        ctx.font = `bold ${this.fontSize}px 'Plus Jakarta Sans', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', 0, 0);
        ctx.restore();
      }
    }

    // Size the canvas for the screen's pixel density so text stays sharp
    function resize() {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Keep existing particles; just add or remove to match the new area
      const target = Math.max(45, Math.floor((width * height) / 14000));
      while (particles.length < target) particles.push(new QuestionMark());
      if (particles.length > target) particles.length = target;
    }

    function animate() {
      const isDark = themeRef.current === 'dark';
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.fillStyle = isDark ? '#0b0f19' : '#ffffff';
      ctx.fillRect(0, 0, width, height);

      for (const p of particles) {
        p.update();
        p.draw(isDark);
      }
      frameId = requestAnimationFrame(animate);
    }

    const onMouseMove = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const onTouchMove = (e) => {
      if (e.touches.length) { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; }
    };
    const clearPointer = () => { mouse.x = -1000; mouse.y = -1000; };

    resize();
    animate();

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchstart', onTouchMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', clearPointer);
    document.documentElement.addEventListener('mouseleave', clearPointer);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchstart', onTouchMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', clearPointer);
      document.documentElement.removeEventListener('mouseleave', clearPointer);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return h('canvas', { id: 'bgCanvas', ref: canvasRef });
}

/* ============================================================================
   5. NAVBAR
   ============================================================================ */
function Navbar({ theme, soundOn, onHome, onLeaderboard, onToggleTheme, onToggleSound }) {
  return h('header', { className: 'navbar' },
    h('div', { className: 'navbar-container' },
      h('button', { onClick: onHome, className: 'brand-button', 'aria-label': 'Go to Home' },
        h('div', { className: 'brand-logo flex-center' }, h(Icon, { name: 'circle-help', className: 'icon-lg' })),
        h('div', { className: 'brand-text' },
          h('span', { className: 'brand-title' }, "John's Quiz Site"),
          h('span', { className: 'brand-subtitle' }, 'Knowledge Arena')
        )
      ),
      h('div', { className: 'nav-actions' },
        h('button', { onClick: onLeaderboard, className: 'btn btn-secondary flex-center gap-sm', title: 'View High Scores' },
          h(Icon, { name: 'trophy', className: 'icon-sm text-amber' }),
          h('span', { className: 'hide-mobile font-semibold' }, 'Leaderboard')
        ),
        h('button', { onClick: onToggleTheme, className: 'btn btn-icon', title: 'Toggle Light/Dark Theme' },
          h(Icon, { name: theme === 'dark' ? 'sun' : 'moon', className: 'icon-md' })
        ),
        h('button', { onClick: onToggleSound, className: 'btn btn-icon', title: 'Toggle Sound Effects' },
          h(Icon, { name: soundOn ? 'volume-2' : 'volume-x', className: 'icon-md' })
        )
      )
    )
  );
}

/* ============================================================================
   6. LANDING VIEW
   ============================================================================ */
function FeatureCard({ icon, tone, title, children }) {
  return h('div', { className: 'glass-card feature-card' },
    h('div', { className: `icon-wrapper bg-${tone}-light text-${tone} flex-center` },
      h(Icon, { name: icon, className: 'icon-lg' })
    ),
    h('h3', null, title),
    h('p', null, children)
  );
}

function Landing({ onStart, onRandom }) {
  return h('section', { id: 'view-landing', className: 'view-section animate-fade-in text-center flex-column flex-center' },
    h('div', { className: 'hero-badge flex-center gap-xs' },
      h(Icon, { name: 'sparkles', className: 'icon-sm text-blue' }),
      h('span', null, 'Dynamic Interactive Trivia')
    ),
    h('h1', { className: 'hero-title' },
      'Welcome to ', h('span', { className: 'gradient-text' }, "John's Quiz Site")
    ),
    h('p', { className: 'hero-description' },
      'Test your knowledge across science, pop culture, history, technology, and more with live questions, quick timers, interactive options, and high score tracking!'
    ),
    h('div', { className: 'cta-group flex-center' },
      h('button', { onClick: onStart, className: 'btn btn-primary btn-xl flex-center gap-sm' },
        h('span', null, 'Start Quiz Journey'),
        h(Icon, { name: 'arrow-right', className: 'icon-md' })
      ),
      h('button', { onClick: onRandom, className: 'btn btn-glass btn-xl flex-center gap-sm' },
        h(Icon, { name: 'shuffle', className: 'icon-md text-indigo' }),
        h('span', null, 'Quick Random Quiz')
      )
    ),
    h('div', { className: 'features-grid' },
      h(FeatureCard, { icon: 'database', tone: 'blue', title: 'OpenDB Trivia API' },
        'Thousands of fresh trivia questions with automatic offline backup protection.'),
      h(FeatureCard, { icon: 'sliders-horizontal', tone: 'emerald', title: 'Custom Sessions' },
        'Configure quiz lengths (5 to 20 questions) and set your preferred difficulty level.'),
      h(FeatureCard, { icon: 'sun-moon', tone: 'purple', title: 'Dual Canvas Themes' },
        'Switch between light white falling questions and dark glowing neon particle backdrops.')
    )
  );
}

/* ============================================================================
   7. SUBJECTS VIEW
   ============================================================================ */
function Subjects({ categories, loading, settings, onSettings, onBack, onSelect }) {
  const [search, setSearch] = useState('');
  const term = search.trim().toLowerCase();
  const visible = categories.filter(c => c.name.toLowerCase().includes(term));

  let body;
  if (loading) {
    body = h('div', { className: 'grid-message' }, 'Loading categories from trivia database...');
  } else if (visible.length === 0) {
    body = h('div', { className: 'grid-message' }, 'No categories match your search.');
  } else {
    body = visible.map(cat =>
      h('div', { key: cat.id, className: 'glass-card category-card', onClick: () => onSelect(cat) },
        h('div', { className: 'flex-between', style: { marginBottom: '1rem' } },
          h('div', { className: 'category-icon flex-center', style: { background: cat.color } },
            h(Icon, { name: cat.icon, className: 'icon-lg' })
          ),
          h('span', { className: 'badge badge-primary' }, 'Select')
        ),
        h('div', null,
          h('h3', { className: 'font-bold text-main', style: { fontSize: '1.125rem', marginBottom: '0.25rem' } }, cat.name),
          h('p', { style: { fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 } }, 'Dynamic API Questions & High Scores')
        )
      )
    );
  }

  return h('section', { id: 'view-subjects', className: 'view-section animate-fade-in' },
    h('div', { className: 'subjects-header flex-between' },
      h('div', null,
        h('button', { onClick: onBack, className: 'link-back flex-center gap-xs' },
          h(Icon, { name: 'arrow-left', className: 'icon-sm' }),
          h('span', null, 'Back to Home')
        ),
        h('h2', { className: 'section-title' }, 'Choose Quiz Category'),
        h('p', { className: 'section-subtitle' }, 'Select a subject and set your desired difficulty.')
      ),
      h('div', { className: 'filter-controls flex-center' },
        h('div', { className: 'control-group' },
          h('label', { htmlFor: 'amountSelect' }, 'Questions'),
          h('select', {
            id: 'amountSelect', className: 'form-select', value: settings.amount,
            onChange: (e) => onSettings({ ...settings, amount: parseInt(e.target.value, 10) })
          }, [5, 10, 15, 20].map(n => h('option', { key: n, value: n }, `${n} Questions`)))
        ),
        h('div', { className: 'control-group' },
          h('label', { htmlFor: 'difficultySelect' }, 'Difficulty'),
          h('select', {
            id: 'difficultySelect', className: 'form-select', value: settings.difficulty,
            onChange: (e) => onSettings({ ...settings, difficulty: e.target.value })
          },
            h('option', { value: 'any' }, 'Any Difficulty'),
            h('option', { value: 'easy' }, 'Easy'),
            h('option', { value: 'medium' }, 'Medium'),
            h('option', { value: 'hard' }, 'Hard')
          )
        ),
        h('div', { className: 'control-group search-group' },
          h('label', { htmlFor: 'categorySearch' }, 'Search'),
          h('div', { className: 'search-input-wrapper' },
            h('input', {
              type: 'text', id: 'categorySearch', className: 'form-input',
              placeholder: 'Search subjects...', value: search,
              onChange: (e) => setSearch(e.target.value)
            }),
            h(Icon, { name: 'search', className: 'icon-sm search-icon' })
          )
        )
      )
    ),
    h('div', { className: 'categories-grid' }, body)
  );
}

/* ============================================================================
   8. QUIZ VIEW
   Owns all gameplay state. <App> remounts it (via `key`) for each new attempt.
   ============================================================================ */
function Quiz({ category, settings, onFinish, onQuit }) {
  const [questions, setQuestions] = useState(null); // null = still loading
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [selected, setSelected] = useState(null); // chosen option, TIMEOUT, or null
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const timeSpent = useRef(0);

  const locked = selected !== null;
  const question = questions ? questions[idx] : null;

  // Load questions once when the quiz mounts
  useEffect(() => {
    let cancelled = false;

    async function load() {
      let url = `https://opentdb.com/api.php?amount=${settings.amount}&category=${category.id}&type=multiple`;
      if (settings.difficulty !== 'any') url += `&difficulty=${settings.difficulty}`;

      let loaded;
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.response_code === 0 && data.results.length > 0) {
          loaded = data.results.map(q => ({
            category: q.category,
            question: decodeHTML(q.question),
            correct_answer: decodeHTML(q.correct_answer),
            options: shuffle([...q.incorrect_answers, q.correct_answer]).map(decodeHTML)
          }));
        }
      } catch (err) { /* fall through to offline questions */ }

      if (!cancelled) {
        setQuestions(loaded || FALLBACK_QUESTIONS.map(q => ({ ...q, options: shuffle(q.options) })));
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // Count down while a question is open
  useEffect(() => {
    if (!questions || locked) return;
    const id = setInterval(() => {
      timeSpent.current += 1;
      setTimeLeft(t => t - 1);
    }, 1000);
    return () => clearInterval(id);
  }, [questions, idx, locked]);

  // Time ran out
  useEffect(() => {
    if (questions && !locked && timeLeft <= 0) lockAnswer(TIMEOUT);
  }, [timeLeft]);

  function lockAnswer(option) {
    if (locked) return;
    const isCorrect = option === question.correct_answer;
    const newStreak = isCorrect ? streak + 1 : 0;

    if (isCorrect) setScore(s => s + 10 + (newStreak > 1 ? newStreak * 2 : 0));
    setStreak(newStreak);
    setAnswers(a => [...a, {
      question: question.question,
      selected: option === TIMEOUT ? 'Time Expired' : option,
      correct: question.correct_answer,
      isCorrect
    }]);
    setSelected(option);
    playSound(isCorrect ? 'correct' : 'wrong');
  }

  function next() {
    playSound('click');
    if (idx + 1 < questions.length) {
      setIdx(idx + 1);
      setSelected(null);
      setTimeLeft(QUESTION_TIME);
    } else {
      onFinish({ answers, score, total: questions.length, timeSpent: timeSpent.current });
    }
  }

  function quit() {
    if (window.confirm('Quit current quiz? Progress will be lost.')) onQuit();
  }

  const total = questions ? questions.length : settings.amount;
  const isCorrect = locked && selected === question.correct_answer;
  const letters = ['A', 'B', 'C', 'D'];

  // --- Feedback banner ---
  let banner = null;
  if (locked) {
    const message = selected === TIMEOUT
      ? `Time's up! Correct answer: ${question.correct_answer}`
      : isCorrect ? 'Spot on! Correct answer.' : `Incorrect. Correct answer: ${question.correct_answer}`;
    banner = h('div', { className: `feedback-banner flex-center gap-sm ${isCorrect ? 'correct-banner' : 'incorrect-banner'}` },
      h(Icon, { name: isCorrect ? 'circle-check-big' : 'circle-alert', className: 'icon-md' }),
      h('div', null,
        h('h4', { className: 'feedback-heading' }, isCorrect ? 'Correct!' : 'Incorrect'),
        h('p', { className: 'feedback-message' }, message)
      )
    );
  }

  return h('section', { id: 'view-quiz', className: 'view-section animate-fade-in quiz-container' },
    // Status card
    h('div', { className: 'glass-card quiz-status-card' },
      h('div', { className: 'status-top-bar flex-between' },
        h('div', { className: 'status-badges flex-center' },
          h('span', { className: 'badge badge-primary' }, category.name),
          h('span', { className: 'badge badge-neutral' }, settings.difficulty.toUpperCase()),
          streak >= 2 && h('span', { className: 'badge badge-amber flex-center gap-xs' },
            h(Icon, { name: 'flame', className: 'icon-xs text-amber' }),
            h('span', null, `${streak} Streak!`)
          )
        ),
        h('div', { className: 'timer-box flex-center gap-xs' },
          h(Icon, { name: 'clock', className: 'icon-sm text-blue' }),
          h('span', null, `${Math.max(timeLeft, 0)}s`)
        )
      ),
      h('div', { className: 'progress-section' },
        h('div', { className: 'progress-labels flex-between' },
          h('span', null, `Question ${idx + 1} of ${total}`),
          h('span', { className: 'text-blue font-bold' }, `Score: ${score}`)
        ),
        h('div', { className: 'progress-track' },
          h('div', { className: 'progress-fill', style: { width: `${(idx / total) * 100}%` } })
        )
      )
    ),

    // Question card
    h('div', { className: 'glass-card question-card' },
      h('h2', { className: 'question-title' }, question ? question.question : 'Loading trivia question...'),
      h('div', { className: 'answers-stack' },
        question && question.options.map((opt, i) => {
          let state = '';
          if (locked) {
            if (opt === question.correct_answer) state = ' correct';
            else if (opt === selected) state = ' incorrect';
            else state = ' disabled';
          }
          return h('button', {
            key: `${idx}-${i}`, className: `answer-btn${state}`, disabled: locked,
            onClick: () => lockAnswer(opt)
          },
            h('span', { className: 'option-badge flex-center' }, letters[i]),
            h('span', { className: 'option-text' }, opt)
          );
        })
      ),
      banner
    ),

    // Controls
    h('div', { className: 'quiz-controls flex-between' },
      h('button', { onClick: quit, className: 'btn btn-ghost' }, 'Quit Quiz'),
      h('button', { onClick: next, disabled: !locked, className: 'btn btn-primary flex-center gap-xs' },
        h('span', null, idx + 1 < total ? 'Next Question' : 'See Results'),
        h(Icon, { name: 'arrow-right', className: 'icon-sm' })
      )
    )
  );
}

/* ============================================================================
   9. RESULTS VIEW
   ============================================================================ */
function Results({ result, onRetry, onNewSubject }) {
  const { answers, total, timeSpent } = result;
  const correctCount = answers.filter(a => a.isCorrect).length;
  const percentage = Math.round((correctCount / total) * 100);

  let grade = { title: 'Good Try!', subtitle: 'Practice makes perfect. Give it another shot!', icon: 'target' };
  if (percentage >= 80) grade = { title: 'Trivia Master!', subtitle: 'Outstanding performance! You crushed this topic.', icon: 'trophy' };
  else if (percentage >= 50) grade = { title: 'Great Job!', subtitle: 'Solid result! Keep practicing to sharpen your score.', icon: 'award' };

  // Celebrate a great score once, when the results first appear
  useEffect(() => {
    if (percentage >= 80) {
      try { if (window.confetti) window.confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); } catch (e) { /* ignore */ }
    }
  }, []);

  return h('section', { id: 'view-results', className: 'view-section animate-fade-in results-container' },
    h('div', { className: 'glass-card results-summary-card text-center' },
      h('div', { className: 'grade-icon-wrapper flex-center' }, h(Icon, { name: grade.icon, className: 'icon-xl' })),
      h('h2', { className: 'results-title' }, grade.title),
      h('p', { className: 'results-subtitle' }, grade.subtitle),
      h('div', { className: 'stats-grid' },
        h('div', { className: 'stat-box' },
          h('span', { className: 'stat-label' }, 'Final Score'),
          h('span', { className: 'stat-value text-blue' }, `${correctCount} / ${total}`)
        ),
        h('div', { className: 'stat-box' },
          h('span', { className: 'stat-label' }, 'Accuracy'),
          h('span', { className: 'stat-value text-emerald' }, `${percentage}%`)
        ),
        h('div', { className: 'stat-box full-width-mobile' },
          h('span', { className: 'stat-label' }, 'Time Spent'),
          h('span', { className: 'stat-value text-purple' }, `${timeSpent}s`)
        )
      ),
      h('div', { className: 'results-actions flex-center' },
        h('button', { onClick: onRetry, className: 'btn btn-primary flex-center gap-xs' },
          h(Icon, { name: 'rotate-ccw', className: 'icon-sm' }), h('span', null, 'Try Again')
        ),
        h('button', { onClick: onNewSubject, className: 'btn btn-secondary flex-center gap-xs' },
          h(Icon, { name: 'grid-3x3', className: 'icon-sm' }), h('span', null, 'Choose New Subject')
        )
      )
    ),

    h('div', { className: 'glass-card review-card' },
      h('h3', { className: 'review-heading flex-center gap-xs' },
        h(Icon, { name: 'square-check-big', className: 'icon-md text-blue' }),
        h('span', null, 'Answers Breakdown')
      ),
      h('div', { className: 'review-stack' },
        answers.map((ans, i) => {
          const tone = ans.isCorrect ? 'var(--color-emerald)' : 'var(--color-rose)';
          return h('div', { key: i, className: `review-item ${ans.isCorrect ? 'item-correct' : 'item-incorrect'}` },
            h('div', { className: 'flex-between', style: { alignItems: 'flex-start', gap: '0.75rem' } },
              h('span', { className: 'review-index flex-center', style: { background: tone } }, i + 1),
              h('div', { style: { flex: 1 } },
                h('h4', { className: 'font-bold', style: { fontSize: '0.95rem', marginBottom: '0.25rem' } }, ans.question),
                h('p', { style: { fontSize: '0.8125rem', color: 'var(--text-muted)' } },
                  'Your answer: ', h('strong', { style: { color: tone } }, ans.selected)
                ),
                !ans.isCorrect && h('p', { style: { fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.15rem' } },
                  'Correct choice: ', h('strong', { style: { color: 'var(--color-emerald)' } }, ans.correct)
                )
              )
            )
          );
        })
      )
    )
  );
}

/* ============================================================================
   10. LEADERBOARD MODAL
   ============================================================================ */
function Leaderboard({ scores, onClear, onClose }) {
  return h('div', { className: 'modal-backdrop flex-center', onClick: onClose },
    h('div', { className: 'glass-card modal-content', onClick: (e) => e.stopPropagation() },
      h('div', { className: 'modal-header flex-between' },
        h('div', { className: 'flex-center gap-xs' },
          h(Icon, { name: 'trophy', className: 'icon-md text-amber' }),
          h('h3', { className: 'modal-title' }, 'Leaderboard')
        ),
        h('button', { onClick: onClose, className: 'btn btn-icon btn-close', 'aria-label': 'Close modal' },
          h(Icon, { name: 'x', className: 'icon-sm' })
        )
      ),
      h('div', { className: 'modal-body scores-list' },
        scores.length === 0
          ? h('p', { style: { textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem 0', fontSize: '0.875rem' } }, 'No scores saved yet. Play a quiz!')
          : scores.map((s, i) =>
              h('div', { key: i, className: 'score-row' },
                h('div', null,
                  h('strong', { className: 'text-main' }, s.category),
                  h('span', { style: { display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)' } }, s.date)
                ),
                h('div', { style: { textAlign: 'right' } },
                  h('span', { className: 'text-blue font-bold' }, `${s.score} pts`),
                  h('span', { style: { display: 'block', fontSize: '0.6875rem', color: 'var(--color-emerald)', fontWeight: 700 } }, s.accuracy)
                )
              )
            )
      ),
      h('div', { className: 'modal-footer flex-between' },
        h('button', { onClick: onClear, className: 'text-danger link-btn' }, 'Clear History'),
        h('button', { onClick: onClose, className: 'btn btn-secondary btn-sm' }, 'Close')
      )
    )
  );
}

/* ============================================================================
   11. APP (ROOT)
   Shared state: current view, theme, sound, categories, quiz settings, result.
   ============================================================================ */
function App() {
  const [view, setView] = useState('landing'); // landing | subjects | quiz | results
  const [theme, setTheme] = useState(() => {
    const saved = readStorage(THEME_KEY, null);
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [soundOn, setSoundOn] = useState(true);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [settings, setSettings] = useState({ amount: 10, difficulty: 'any' });
  const [category, setCategory] = useState(null);
  const [attempt, setAttempt] = useState(0); // bumping this remounts <Quiz>
  const [result, setResult] = useState(null);
  const [scores, setScores] = useState(readScores);
  const [showBoard, setShowBoard] = useState(false);

  // Theme -> <html class="dark"> + persistence
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    writeStorage(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => { soundEnabled = soundOn; }, [soundOn]);

  // Fetch categories the first time the subjects view opens
  useEffect(() => {
    if (view !== 'subjects' || categories.length > 0) return;
    let cancelled = false;
    setCategoriesLoading(true);

    (async () => {
      let list = FALLBACK_CATEGORIES;
      try {
        const res = await fetch('https://opentdb.com/api_category.php');
        const data = await res.json();
        if (data && data.trivia_categories && data.trivia_categories.length > 0) {
          list = data.trivia_categories.map(cat => {
            const matched = FALLBACK_CATEGORIES.find(f => f.id === cat.id);
            return {
              id: cat.id,
              name: cat.name.replace(/^Entertainment: |^Science: /, ''),
              icon: matched ? matched.icon : 'circle-help',
              color: matched ? matched.color : 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
            };
          });
        }
      } catch (err) { /* use fallback list */ }
      if (!cancelled) {
        setCategories(list);
        setCategoriesLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [view]);

  function navigate(next) {
    playSound('click');
    setView(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function startQuiz(cat) {
    setCategory(cat);
    setResult(null);
    setAttempt(a => a + 1);
    navigate('quiz');
  }

  function quickRandom() {
    startQuiz(FALLBACK_CATEGORIES[Math.floor(Math.random() * FALLBACK_CATEGORIES.length)]);
  }

  function finishQuiz(res) {
    setResult(res);
    const correct = res.answers.filter(a => a.isCorrect).length;
    const entry = {
      category: category.name,
      score: res.score,
      accuracy: `${Math.round((correct / res.total) * 100)}%`,
      date: new Date().toLocaleDateString()
    };
    const updated = [entry, ...readScores()].slice(0, 10);
    writeStorage(SCORES_KEY, JSON.stringify(updated));
    setScores(updated);
    navigate('results');
  }

  function clearScores() {
    writeStorage(SCORES_KEY, null);
    setScores([]);
  }

  let content;
  if (view === 'landing') {
    content = h(Landing, { onStart: () => navigate('subjects'), onRandom: quickRandom });
  } else if (view === 'subjects') {
    content = h(Subjects, {
      categories, loading: categoriesLoading, settings, onSettings: setSettings,
      onBack: () => navigate('landing'), onSelect: startQuiz
    });
  } else if (view === 'quiz') {
    content = h(Quiz, {
      key: attempt, category, settings, onFinish: finishQuiz, onQuit: () => navigate('subjects')
    });
  } else if (view === 'results' && result) {
    content = h(Results, {
      key: attempt, result, onRetry: () => startQuiz(category), onNewSubject: () => navigate('subjects')
    });
  }

  return h(React.Fragment, null,
    h(BackdropCanvas, { theme }),
    h(Navbar, {
      theme, soundOn,
      onHome: () => navigate('landing'),
      onLeaderboard: () => { playSound('click'); setShowBoard(true); },
      onToggleTheme: () => { setTheme(t => (t === 'dark' ? 'light' : 'dark')); playSound('click'); },
      onToggleSound: () => setSoundOn(s => !s)
    }),
    h('main', { className: 'main-content flex-center' }, content),
    showBoard && h(Leaderboard, {
      scores, onClear: clearScores, onClose: () => { playSound('click'); setShowBoard(false); }
    }),
    h('footer', { className: 'footer text-center' },
      h('p', null, "John's Quiz Site © 2026 • Powered by Open Trivia Database")
    )
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(h(App));
