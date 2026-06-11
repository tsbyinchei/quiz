# 📋 Improvements & Enhancements - Quiz Lab

**Ngày đánh giá:** 13/05/2026  
**Scope:** Quiz Lab system (Frontend + Backend + Tests + Infra)  
**Tham khảo:** [../IMPROVEMENTS.md](../IMPROVEMENTS.md) - Tài liệu đánh giá tổng quát

---

## 📊 Tóm tắt

- **🔴 CRITICAL:** 5 vấn đề (phải làm - ảnh hưởng chức năng/bảo mật)
- **🟠 HIGH:** 7 vấn đề (nên tuần này - hiệu năng/UX)
- **⚡ QUICK WINS:** 5 items (1-2 giờ, hiệu quả cao)
- **Total:** 12 cải tiến, ~5-6 giờ để hoàn thành Phase 1

---

## 🔴 **CRITICAL (Phải làm - Ảnh hưởng chức năng & bảo mật)**

### #1: Pre-compute SHA-256 hashes
**Tệp:** `assets/quiz.html` → `selectAnswer()` function  
**Vấn đề:** Mỗi lần user click answer → 4 gọi SHA-256 tuần tự → chậm 1-2s trên mạng chậm

```javascript
// ❌ CURRENT (inefficient)
async function resolveCorrectOptionKey(question) {
    for (const candidate of ['A', 'B', 'C', 'D']) {
        const hash = await sha256(...); // <- 4 gọi, chợp chần
        if (question.answerHash === hash) return candidate;
    }
}
```

**Phương án:**
```javascript
// ✅ BETTER: Pre-compute
let answerHashMap = {}; // { qID: { A: hash, B: hash, ... } }

function initQuiz(quizData) {
    answerHashMap = {};
    quizData.questions.forEach(q => {
        answerHashMap[q.questionID] = {
            'A': sha256Sync(q.questionID + 'A' + SECRET),
            'B': sha256Sync(q.questionID + 'B' + SECRET),
            'C': sha256Sync(q.questionID + 'C' + SECRET),
            'D': sha256Sync(q.questionID + 'D' + SECRET),
        };
    });
}

// Khi user click
function selectAnswer(questionID, choice) {
    const correctHash = quiz.questions[questionID].answerHash;
    const isCorrect = answerHashMap[questionID][choice] === correctHash;
    // ... update UI immediately
}
```

**Ưu tiên:** 🔴 **TỨC TÍCH**  
**Khó độ:** Easy | **Thời gian:** 30 phút  
**File thay đổi:**
- `assets/script.js` - Add `sha256Sync()` hoặc cache layer
- `assets/quiz.html` - Call `initQuiz()` khi load, modify `selectAnswer()` để lookup

---

### #2: Cache pollution Cross-Quiz bug
**Tệp:** `assets/quiz.html` - `selectAnswer()` function  
**Vấn đề:** Cùng questionID ở 2 quiz khác → cache sai → điểm sai

```javascript
// ❌ CURRENT
const correctOptionKeyByQuestion = {}; // Global, không clear, không prefix quizID
correctOptionKeyByQuestion[questionID] = 'A'; // Không có quizID key

// Nếu Quiz A có questionID=42 → A, Quiz B có questionID=42 → D
// Quiz B sẽ dùng cache Quiz A → sai điểm!
```

**Phương án:**
```javascript
// ✅ BETTER: Add quizID + clear cache

// Option 1: Prefix cache key
const cacheKey = `${currentQuizID}_${questionID}`;
correctOptionKeyByQuestion[cacheKey] = 'A';

// Option 2: Clear cache khi load quiz mới
function loadQuiz(quizID, quizData) {
    currentQuizID = quizID;
    correctOptionKeyByQuestion = {}; // <- RESET
    // ... init quiz
}
```

**Ưu tiên:** 🔴 **TỨC TÍCH**  
**Khó độ:** Easy | **Thời gian:** 20 phút  
**File thay đổi:**
- `assets/quiz.html` - Thêm `currentQuizID` variable, clear cache @ `loadQuiz()`

---

### #3: Result Page thiếu UI đúng/sai
**Tệp:** `result.html` - `renderReviewList()` function  
**Vấn đề:** 
- Không hiển thị badges (✓/✕) giống như khi làm quiz
- Không có image viewer modal
- Options bị shuffle lại → user nhầm

**Phương án:**
```javascript
// ✅ IMPROVEMENTS:
// 1. Copy imageViewerOverlay modal từ quiz.html
// 2. Áp dụng .is-correct / .is-wrong classes khi render
function renderReviewList(reviewData) {
    reviewData.forEach(item => {
        const isCorrect = item.userAnswer === item.correctAnswer;
        const badge = isCorrect 
            ? '<span class="badge is-correct">✓</span>'
            : '<span class="badge is-wrong">✕</span>';
        
        // ... render với badge + image viewer support
        optionEl.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
    });
}

// 3. Apply optionOrderByQuestion để restore đúng thứ tự
if (optionOrderByQuestion[questionID]) {
    const orderedOptions = optionOrderByQuestion[questionID];
    // ... reorder DOM elements
}
```

**Ưu tiên:** 🔴 **TỨC TÍCH**  
**Khó độ:** Medium | **Thời gian:** 1 giờ  
**File thay đổi:**
- `result.html` - Thêm: modal, .is-correct/.is-wrong styles, image viewer listener
- `assets/style.css` - Add badge styles, image viewer modal styles
- `assets/script.js` - Export `imageViewerOverlay` setup function

---

### #4: Secret key rotation policy
**Tệp:** `Quiz_Lab_Backend.gs` + client  
**Vấn đề:** Chỉ có 1 secret → nếu leak phải rebuild tất cả

**Phương án:**
```javascript
// Backend: Script Properties
// QUIZ_JWT_SECRET_CURRENT: "new_secret_2026_05_13"
// QUIZ_JWT_SECRET_PREVIOUS: "old_secret_2026_04_13"
// SECRET_ROTATE_TIME: timestamp khi rotate lần cuối

function getSecretForVerification() {
    const scriptProp = PropertiesService.getScriptProperties();
    return {
        current: scriptProp.getProperty('QUIZ_JWT_SECRET_CURRENT'),
        previous: scriptProp.getProperty('QUIZ_JWT_SECRET_PREVIOUS')
    };
}

function verifyAnswer(questionID, userAnswer, token) {
    const secrets = getSecretForVerification();
    const correctAnswerCurrent = sha256(questionID + answer + secrets.current);
    const correctAnswerPrevious = sha256(questionID + answer + secrets.previous);
    
    // Accept both current & previous (grace period)
    if (correctAnswerCurrent === stored || correctAnswerPrevious === stored) {
        return true;
    }
    return false;
}

// Rotation helper function (call manually hoặc via scheduled trigger)
function rotateSecret(newSecret) {
    const scriptProp = PropertiesService.getScriptProperties();
    const oldCurrent = scriptProp.getProperty('QUIZ_JWT_SECRET_CURRENT');
    
    scriptProp.setProperty('QUIZ_JWT_SECRET_PREVIOUS', oldCurrent);
    scriptProp.setProperty('QUIZ_JWT_SECRET_CURRENT', newSecret);
    scriptProp.setProperty('SECRET_ROTATE_TIME', new Date().getTime());
    
    // Log rotation event
    logRotationEvent(oldCurrent, newSecret);
}
```

**Ưu tiên:** 🔴 **TỨC TÍCH**  
**Khó độ:** Medium | **Thời gian:** 1.5 giờ  
**File thay đổi:**
- `Quiz_Lab_Backend.gs` - Add `getSecretForVerification()`, `rotateSecret()`, update verify endpoints
- Docs: Add secret rotation procedure to [SETUP_GUIDE.md](SETUP_GUIDE.md)

---

### #5: Missing E2E automation tests
**Vấn đề:** Không có test tự động → regression không phát hiện

**Phương án:**
```javascript
// tech: Jest (unit) + Playwright (E2E)

// jest.config.js
module.exports = { testEnvironment: 'jsdom', setupFiles: ['test/setup.js'] };

// test/auth.test.js
describe('Authentication Flow', () => {
    test('login with valid credentials', async () => {
        // Mock API
        // Test login page, submit, verify token stored
    });
    
    test('rate limit after 5 failed attempts', async () => {
        // 5x login fail, verify cooldown
    });
});

// test/quiz.e2e.js (Playwright)
describe('Quiz Flow E2E', () => {
    test('should submit and score correctly', async () => {
        await page.goto('http://localhost/quiz.html?quizID=1');
        await page.click('label:has-text("A")'); // select answer
        await page.click('button:has-text("Nộp bài")');
        await page.waitForNavigation({ url: /result\.html/ });
        // assert score displayed
    });
});
```

**Ưu tiên:** 🔴 **TỨC TÍCH** (after critical bugs)  
**Khó độ:** Hard | **Thời gian:** 4-6 giờ  
**File thay đổi:**
- `test/` - New directory
- `package.json` - Add jest, playwright, testing-library deps
- `.github/workflows/` - CI/CD GitHub Actions

---

## 🟠 **HIGH (Nên làm tuần này)**

### #6: Quiz timeout indicator + color warning
**Tệp:** `assets/quiz.html` - timer display  
**Vấn đề:** Timer chỉ hiển thị số, người dùng không nhận thức sắp hết giờ

```html
<!-- ❌ CURRENT -->
<div class="timer">04:32</div>

<!-- ✅ BETTER -->
<div class="timer-container">
    <progress value="272" max="900" class="timer-bar"></progress>
    <div class="timer-text">
        <span class="timer-value">04:32</span>
        <span class="timer-remaining" data-remaining>Còn 4 phút 32 giây</span>
    </div>
</div>

<style>
.timer-bar { width: 200px; height: 6px; }
.timer-bar[value="272"] { background: linear-gradient(90deg, red, orange, green); }
.timer-bar::-webkit-progress-bar { background: #333; border-radius: 3px; }
.timer-bar::-webkit-progress-value { background: currentColor; transition: all 0.3s; }

/* Critical mode: últimos 30 segundos */
.timer-container.critical .timer-value {
    color: #f87171;
    animation: pulse 0.5s infinite;
}
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
</style>
```

**Logic:**
- Green (> 5 min)
- Yellow (2-5 min)
- Orange (1-2 min)
- Red (< 1 min)
- Flash + toast @ 30s
- Final warning @ 5s → auto-submit @ 0s

**Ưu tiên:** 🟠 **HIGH**  
**Khó độ:** Easy | **Thời gian:** 45 phút  
**File thay đổi:**
- `assets/quiz.html` - Update timer HTML + add progress bar
- `assets/style.css` - Add timer styles, progress bar colors, pulse animation

---

### #7: Option shuffle inconsistency fix
**Tệp:** `assets/script.js` + `result.html`  
**Vấn đề:** Result page optionOrder không match quiz page thứ tự

```javascript
// ✅ FIX: Store optionOrderByQuestion globally
let optionOrderByQuestion = {}; // { qID: [A, D, B, C] }

function shuffleOptions(questionID, options) {
    const shuffled = fisherYates(options);
    optionOrderByQuestion[questionID] = shuffled.map(o => o.key); // Store order
    return shuffled;
}

// result.html: Restore order khi render
function renderReviewList(reviewData) {
    reviewData.forEach(item => {
        if (!optionOrderByQuestion[item.questionID]) {
            // Khôi phục từ sessionStorage hoặc stored order
            optionOrderByQuestion[item.questionID] = retrieveOptionOrder(item.questionID);
        }
        // Render theo stored order, không shuffle lại
    });
}
```

**Ưu tiên:** 🟠 **HIGH**  
**Khó độ:** Medium | **Thời gian:** 1 giờ  
**File thay đổi:**
- `assets/script.js` - Add global `optionOrderByQuestion`, persist to sessionStorage
- `result.html` - Retrieve order, apply when rendering

---

### #8: Anti-cheat violation feedback
**Tệp:** `assets/anticheating.js` + `quiz.html`  
**Vấn đề:** User vi phạm → không có feedback rõ ràng, app "đông cứng"

```javascript
// ✅ BETTER: Visual feedback

function recordViolation(violationType) {
    // Show overlay
    const overlay = document.getElementById('cheatViolationOverlay');
    const message = {
        'devtools': '❌ Không được mở DevTools!',
        'tab_switch': '❌ Không được chuyển tab!',
        'fullscreen_exit': '❌ Không được thoát fullscreen!',
        'copy_paste': '❌ Không được copy/paste!'
    }[violationType];
    
    overlay.querySelector('.violation-text').textContent = message;
    overlay.classList.add('show');
    
    // Counter & cooldown
    violationCount++;
    overlay.querySelector('.violation-count').textContent 
        = `Lần vi phạm: ${violationCount}/3`;
    
    // Color coding
    if (violationCount === 1) overlay.style.borderColor = '#fbbf24'; // Yellow
    if (violationCount === 2) overlay.style.borderColor = '#fb923c'; // Orange
    if (violationCount === 3) overlay.style.borderColor = '#f87171'; // Red
    
    // Cooldown timer
    disableQuizInteraction(1200);
    startCooldownTimer(overlay, 1200);
    
    // Auto-submit on 3rd violation
    if (violationCount >= 3) {
        setTimeout(() => submitQuizWithScore(0), 1200);
    }
}

function disableQuizInteraction(duration) {
    const quiz = document.getElementById('quizContainer');
    quiz.style.pointerEvents = 'none';
    quiz.style.opacity = '0.7';
    setTimeout(() => {
        quiz.style.pointerEvents = 'auto';
        quiz.style.opacity = '1';
    }, duration);
}
```

**HTML:**
```html
<div id="cheatViolationOverlay" class="violation-overlay hidden">
    <div class="violation-card">
        <div class="violation-icon">⚠️</div>
        <div class="violation-text">Không được mở DevTools!</div>
        <div class="violation-counter">
            <span>Lần vi phạm: </span>
            <strong class="violation-count">1</strong>
            <span>/3</span>
        </div>
        <div class="cooldown-timer">Khóa: <span>1.2</span>s</div>
    </div>
</div>
```

**Ưu tiên:** 🟠 **HIGH**  
**Khó độ:** Medium | **Thời gian:** 1 giờ  
**File thay đổi:**
- `assets/anticheating.js` - Redesign `recordViolation()`, add feedback
- `quiz.html` - Add violation overlay HTML
- `assets/style.css` - Add overlay styles, animations

---

### #9: Mobile admin layout responsive
**Tệp:** `admin.html` + `assets/style.css`  
**Vấn đề:** Admin mobile layout tắc, khó navigate

```css
/* ✅ MOBILE-FIRST RESPONSIVE */

/* Desktop: Sidebar */
@media (min-width: 1024px) {
    .admin-wrapper {
        display: grid;
        grid-template-columns: 200px 1fr;
    }
    .admin-sidebar {
        position: fixed;
        width: 200px;
    }
}

/* Tablet: Sidebar collapse */
@media (max-width: 1024px) {
    .admin-sidebar {
        position: fixed;
        left: 0;
        transform: translateX(-100%);
        transition: transform 0.3s;
        z-index: 1000;
    }
    .admin-sidebar.open { transform: translateX(0); }
    .hamburger-menu { display: block; }
}

/* Mobile: Full stack */
@media (max-width: 640px) {
    .admin-grid { 
        grid-template-columns: 1fr; 
        gap: 12px;
    }
    .quiz-card { 
        padding: 12px;
        font-size: 12px;
    }
    .checkbox-group { 
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }
    .checkbox-group label {
        font-size: 10px;
        padding: 4px 8px;
    }
}
```

**Features:**
- Hamburger menu (mobile)
- Grid → stacked cards (mobile)
- Checkbox/button inline
- "Back to top" FAB button

**Ưu tiên:** 🟠 **HIGH**  
**Khó độ:** Medium | **Thời gian:** 1.5 giờ  
**File thay đổi:**
- `admin.html` - Add hamburger button, Back-to-top FAB
- `assets/style.css` - Add responsive breakpoints, mobile styles

---

### #10: Session persistence across tabs
**Tệp:** `assets/script.js` - AuthManager  
**Vấn đề:** User đóng tab → phải login lại

```javascript
// ✅ BETTER: localStorage + cross-tab sync

class AuthManager {
    static init() {
        // Try restore token trước
        const token = this.getToken();
        if (token && !this.isTokenExpired(token)) {
            this.authState.token = token;
            return true;
        }
        return false;
    }
    
    static getToken() {
        // Priority: sessionStorage > localStorage
        return sessionStorage.getItem('auth_token') 
            || localStorage.getItem('auth_token');
    }
    
    static setToken(token, persist = true) {
        sessionStorage.setItem('auth_token', token);
        if (persist) {
            localStorage.setItem('auth_token', token); // Long-term
        }
    }
    
    static logout() {
        sessionStorage.removeItem('auth_token');
        localStorage.removeItem('auth_token');
    }
    
    // Cross-tab sync
    static setupCrossTabSync() {
        window.addEventListener('storage', (e) => {
            if (e.key === 'auth_token') {
                if (e.newValue) {
                    this.authState.token = e.newValue;
                    // Tab 1 logged in → Tab 2 auto-refreshes
                } else {
                    this.logout(); // Logout từ tab khác
                    window.location.href = 'login.html';
                }
            }
        });
    }
}

// On page load
document.addEventListener('DOMContentLoaded', () => {
    AuthManager.setupCrossTabSync();
    if (AuthManager.init()) {
        // Already logged in, proceed
    } else {
        // Redirect to login
        window.location.href = 'login.html';
    }
});
```

**Ưu tiên:** 🟠 **HIGH**  
**Khó độ:** Medium | **Thời gian:** 1.5 giờ  
**File thay đổi:**
- `assets/script.js` - Refactor AuthManager for localStorage + cross-tab sync

---

### #11: Rate limit feedback improvement
**Tệp:** `assets/script.js` - APIClient  
**Vấn đề:** Rate limit message generic, user không biết chờ bao lâu

```javascript
// ✅ BETTER: Include timing info

class APIClient {
    static async request(action, data) {
        try {
            const response = await fetch(BACKEND_URL, {
                method: 'POST',
                body: JSON.stringify({ action, ...data })
            });
            
            if (response.status === 429) { // Too Many Requests
                const error = await response.json();
                const { remainingTime, attemptsLeft } = error;
                
                // Show detailed feedback
                const message = attemptsLeft > 0
                    ? `🔒 Quá nhiều thử. Chờ ${remainingTime}s, còn ${attemptsLeft} lần`
                    : `🔒 Tài khoản bị khóa tạm thời. Chờ ${remainingTime}s`;
                
                this.showToast(message, 'warning');
                this.startCountdown(remainingTime);
                throw new RateLimitError(remainingTime, attemptsLeft);
            }
        } catch (error) {
            if (error instanceof RateLimitError) {
                // Disable button, show countdown
                this.setRetryButton(error.remainingTime);
            }
        }
    }
    
    static startCountdown(seconds) {
        let remaining = seconds;
        const interval = setInterval(() => {
            remaining--;
            document.getElementById('retryCountdown').textContent 
                = `Thử lại trong ${remaining}s`;
            if (remaining <= 0) clearInterval(interval);
        }, 1000);
    }
}
```

**Backend response:**
```javascript
// Quiz_Lab_Backend.gs
function doPost(e) {
    try {
        // ... verify rate limit
        if (isRateLimited(username)) {
            const remainingTime = calculateCooldown(username);
            return ContentService.createTextOutput(JSON.stringify({
                error: 'Too many requests',
                remainingTime: Math.ceil(remainingTime / 1000),
                attemptsLeft: MAX_ATTEMPTS - getAttemptCount(username)
            })).setMimeType(ContentService.MimeType.JSON)
              .setResponseCode(429);
        }
    } catch (error) { ... }
}
```

**Ưu tiên:** 🟠 **HIGH**  
**Khó độ:** Medium | **Thời gian:** 1 giờ  
**File thay đổi:**
- `assets/script.js` - Enhance error handling, add countdown UI
- `Quiz_Lab_Backend.gs` - Return `remainingTime`, `attemptsLeft` in 429 response

---

### #12: Dark/Light theme toggle
**Tệp:** `assets/style.css` + tất cả HTML  
**Vấn đề:** Chỉ dark theme, không có tuỳ chọn light cho ban đêm

```javascript
// ✅ THEME MANAGER

class ThemeManager {
    static init() {
        const saved = localStorage.getItem('theme-preference') 
            || this.getSystemPreference();
        this.setTheme(saved);
    }
    
    static getSystemPreference() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark' : 'light';
    }
    
    static setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme-preference', theme);
    }
    
    static toggle() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        this.setTheme(next);
    }
    
    static setupToggleButton() {
        const btn = document.getElementById('themeToggle');
        btn.addEventListener('click', () => this.toggle());
    }
}

// HTML
<button id="themeToggle" aria-label="Toggle theme">
    <svg class="icon-light">☀️</svg>
    <svg class="icon-dark">🌙</svg>
</button>
```

**CSS Variables:**
```css
:root[data-theme="dark"] {
    --bg: #0a0e1a;
    --surface: #111827;
    --text: #f1f5f9;
    --border: rgba(34,211,238,.1);
}

:root[data-theme="light"] {
    --bg: #e5ebf2;
    --surface: #f0f4f9;
    --text: #243547;
    --border: rgba(8,145,178,.12);
}

body { background: var(--bg); color: var(--text); }
```

**Ưu tiên:** 🟠 **HIGH**  
**Khó độ:** Medium | **Thời gian:** 1.5 giờ  
**File thay đổi:**
- `assets/style.css` - Add `[data-theme]` selectors, CSS variables
- `assets/script.js` - Add ThemeManager class
- All HTML pages - Add theme toggle button

---

## ⚡ **QUICK WINS (1-2 giờ, win nhanh)**

```
✅ #1  Pre-compute SHA-256 hashes        (30 min)  → ++Performance (1-2s)
✅ #2  Fix cross-quiz cache pollution    (20 min)  → ++Correctness
✅ #6  Time warning visual + countdown   (45 min)  → ++UX clarity
✅ #7  Option shuffle order fix          (1 hr)    → ++Correctness result page
✅ #12 Dark/Light theme toggle           (1.5 hr)  → ++Accessibility
-------
Total: ~4.5 hours for 5 quick improvements
```

---

## 📈 **Recommended Roadmap**

### 🔴 **IMMEDIATE (3-4 hours)**
Priority: **Correctness + Performance**

```
[x] #1  Pre-compute SHA-256              (30 min) ⭐
[x] #2  Fix cross-quiz cache             (20 min) ⭐
[x] #3  Result page UI (badges)          (1 hr)   ⭐
[x] #6  Countdown timer visual           (45 min) ⭐
Total: 2h 35m
```

Status: Completed on 13/05/2026 (implemented + verified build/tests).

### 🔴 **THIS WEEK (3-4 hours)**
Priority: **Security + UX Polish**

```
[x] #4  Secret rotation policy           (1.5 hr) 🔒
[x] #10 Session cross-tab sync           (1.5 hr) 🔑
Total: 3h
```

Status: Completed on 13/05/2026 (implemented + build verified).

### 🟠 **WEEK 2 (4-5 hours)**
Priority: **Feature Completeness**

```
[ ] #7  Option shuffle consistency       (1 hr)
[ ] #8  Anti-cheat feedback              (1 hr)
[ ] #9  Mobile admin layout              (1.5 hr)
[ ] #11 Rate limit feedback              (1 hr)
Total: 4.5h
```

### 🟠 **WEEK 3+ (6+ hours)**
Priority: **Testing + Advanced**

```
[ ] #5  E2E automation tests             (4-6 hr) 🧪
[ ] #12 Dark/Light theme                 (1.5 hr)
```

---

## 📋 Implementation Checklist

### Phase 1 - Correctness & Performance (THIS WEEK)
- [x] #1 Pre-compute SHA-256
    - [x] Add answer validation warmup/cache layer
    - [x] Warmup correct option map during quiz load
    - [x] Test: verify no lag on answer selection
  
- [x] #2 Cross-quiz cache pollution
    - [x] Add `currentQuizID` variable
    - [x] Clear `correctOptionKeyByQuestion` on quiz load
    - [x] Test: switch between 2 quizzes, verify scores separate
  
- [x] #3 Result page UI
    - [x] Keep imageViewerOverlay modal on result page
    - [x] Add .is-correct/.is-wrong + clearer review badges/states
    - [x] Implement optionOrderByQuestion restore
    - [x] Test: verify ✓/✕ display + image viewer on result page
  
- [x] #6 Countdown timer visual
    - [x] Add progress bar to timer HTML
    - [x] Implement color logic (green → red)
    - [x] Add pulse animation < 1 min
    - [x] Test: verify visual changes at 5min, 2min, 1min, 30s, etc.

### Phase 2 - Security & Sessions (WEEK 2)
- [x] #4 Secret rotation
    - [x] Add CURRENT/PREVIOUS secrets to Script Properties
    - [x] Implement token signature verification to accept both secrets
    - [x] Create `rotateJwtSecret_()` helper
    - [x] Document rotation procedure
  
- [x] #10 Cross-tab session sync
    - [x] Refactor AuthManager for localStorage/sessionStorage sync
    - [x] Implement storage event listener
    - [ ] Test: open 2 tabs, login in tab 1, verify tab 2 auto-syncs (manual)

### Verification

- [x] Production build: ran 5 times successfully (no errors)

---

## 📐 Performance Metrics to Track

After implementation, measure:

| Item | Baseline | Target | Method |
|------|----------|--------|--------|
| Answer click response | 1-2s | <300ms | DevTools Performance |
| Quiz page load | ~2s | <1s | Lighthouse |
| Session restore | N/A | <500ms | Manual test |
| Rate limit display | 3s | <500ms | Network tab |

---

## 🤝 Dependencies & Blockers

- **#3** depends on `optionOrderByQuestion` from **#7**
- **#4** (Secret rotation) requires manual GAS deployment
- **#5** (Tests) should be done after **#1, #2, #3, #6** are merged

---

**Last updated:** 13/05/2026 (Phase 1 + core Phase 2 items completed)
