# 📂 Quiz Lab - File Structure & Documentation

## Project Location
```
c:\Users\TsByin\Documents\GitHub\tsbyin-cv\tsbyin-cv\labs\quiz\
```

## Complete File Tree

```
quiz/
│
├── 📄 index.html                    # Landing Page
│   ├─ Giới thiệu dự án
│   ├─ Showcase công nghệ
│   ├─ Nút "Bắt Đầu" → login.html
│   └─ Glassmorphism design
│
├── 📄 login.html                    # Auth Page
│   ├─ Form đăng nhập (glassmorphism)
│   ├─ SHA-256 hash password
│   ├─ Anti-cheat:
│   │  ├─ Chặn F12 key
│   │  ├─ Chặn right-click
│   │  ├─ Chặn Ctrl+C/X/V/U
│   │  └─ Chặn text selection
│   ├─ Token lưu localStorage
│   └─ Redirect dashboard.html nếu login thành công
│
├── 📄 dashboard.html                # Dashboard - Chọn Môn & Bài
│   ├─ Header: Username + Logout
│   ├─ Subject Grid (từ GAS)
│   ├─ Quiz List (khi chọn môn)
│   ├─ User Stats:
│   │  ├─ Tổng lần làm
│   │  ├─ Điểm cao nhất
│   │  └─ Điểm trung bình
│   ├─ Auth check (redirect login nếu không token)
│   └─ Admin button (nếu role = Admin)
│
├── 📄 quiz.html                     # Quiz Player
│   ├─ Swiper.js slide view
│   ├─ Timer (countdown)
│   ├─ Progress bar
│   ├─ Question indicator (dots)
│   ├─ Answer options (radio)
│   ├─ Chế độ Luyện tập:
│   │  ├─ SHA-256 validation
│   │  ├─ Show Xanh/Đỏ feedback
│   │  └─ Show explanation
│   ├─ Chế độ Thi:
│   │  ├─ Chỉ ghi nhận, không show feedback
│   │  └─ Nộp lúc hết giờ
│   ├─ Navigation: Prev/Next/Submit
│   └─ Redirect result.html sau nộp
│
├── 📄 result.html                   # Result Display
│   ├─ Score circle (visual)
│   ├─ Correct/Total count
│   ├─ Ratio percentage
│   ├─ Message (based on score)
│   ├─ "Làm Lại" button
│   └─ "Về Dashboard" button
│
├── 📄 admin.html                    # Admin Dashboard
│   ├─ Auth check (role = Admin)
│   ├─ Statistics:
│   │  ├─ Tổng bài thi
│   │  ├─ Tổng lượt làm
│   │  ├─ Người dùng hoạt động
│   │  └─ Điểm trung bình
│   ├─ Chart.js (bar chart)
│   │  └─ Tần suất làm bài theo quiz
│   ├─ Quiz Management:
│   │  ├─ Toggle Status (Active/Inactive)
│   │  └─ Toggle Show_Answer (Practice/Exam)
│   ├─ Aiken Bulk Import:
│   │  ├─ Select quiz
│   │  ├─ Textarea (Aiken content)
│   │  ├─ Parse & validate
│   │  └─ Insert vào Questions sheet
│   └─ Feedback messages
│
├── 📁 assets/
│   │
│   ├── 📄 style.css                 # Main Stylesheet (1000+ lines)
│   │   ├─ CSS Variables (colors, spacing)
│   │   ├─ Glassmorphism effect
│   │   ├─ Dark mode theme
│   │   ├─ Typography
│   │   ├─ Buttons & Forms
│   │   ├─ Layouts:
│   │   │  ├─ Landing page
│   │   │  ├─ Login card
│   │   │  ├─ Dashboard grid
│   │   │  ├─ Quiz player
│   │   │  ├─ Admin sections
│   │   │  └─ Result card
│   │   ├─ Components:
│   │   │  ├─ Cards
│   │   │  ├─ Toggle switch
│   │   │  ├─ Progress bar
│   │   │  ├─ Timer
│   │   │  ├─ Charts
│   │   │  └─ Indicators
│   │   ├─ Animations:
│   │   │  ├─ Shimmer loader
│   │   │  └─ Spinner
│   │   └─ Responsive (Mobile/Tablet/Desktop)
│   │
│   └── 📄 script.js                 # Core JavaScript (500+ lines)
│       ├─ SHA-256 Hashing:
│       │  └─ sha256(message) → async
│       ├─ AuthManager class:
│       │  ├─ getToken()
│       │  ├─ getRole()
│       │  ├─ isAuthenticated()
│       │  ├─ isAdmin()
│       │  └─ setAuth() / clearAuth()
│       ├─ GradingEngine class:
│       │  ├─ validateAnswer()
│       │  └─ calculateScore()
│       ├─ AikenParser class:
│       │  ├─ parse()
│       │  ├─ parseBlock()
│       │  └─ validate()
│       ├─ APIClient class:
│       │  ├─ request()
│       │  ├─ login()
│       │  ├─ getSubjects()
│       │  ├─ getQuizzesBySubject()
│       │  ├─ getQuizData()
│       │  ├─ submitScore()
│       │  ├─ getUserStats()
│       │  ├─ getAdminData()
│       │  ├─ updateQuizStatus()
│       │  ├─ updateShowAnswer()
│       │  └─ bulkUpload()
│       └─ Utils class:
│          ├─ formatTime()
│          ├─ formatPercent()
│          ├─ generateID()
│          ├─ LocalStorage helpers
│          └─ Notification/Dark mode
│
├── 📄 Quiz_Lab_Backend.gs           # Google Apps Script (400+ lines)
│   ├─ Configuration:
│   │  ├─ SPREADSHEET_ID
│   │  ├─ SECRET_KEY
│   │  └─ TOKEN_EXPIRY
│   ├─ Sheets References
│   ├─ Main Handler (doPost)
│   ├─ Authentication Module:
│   │  ├─ handleLogin()
│   │  ├─ generateToken()
│   │  └─ verifyToken()
│   ├─ Quiz Data Module:
│   │  ├─ handleGetSubjects()
│   │  ├─ handleGetQuizzesBySubject()
│   │  └─ handleGetQuizData()
│   ├─ Grading Module:
│   │  ├─ handleSubmitScore()
│   │  └─ handleGetUserStats()
│   ├─ Admin Module:
│   │  ├─ handleGetAdminData()
│   │  ├─ handleUpdateQuizStatus()
│   │  ├─ handleUpdateShowAnswer()
│   │  └─ handleBulkUpload()
│   └─ Utility Functions:
│      └─ JsonResponse()
│
├── 📄 README.md                     # Main Documentation
│   ├─ Features overview
│   ├─ Setup guide (4 steps)
│   ├─ File structure
│   ├─ Usage guide
│   ├─ Aiken format
│   ├─ Security explanation
│   ├─ Technologies
│   └─ Troubleshooting
│
└── 📄 SETUP_GUIDE.md                # Step-by-step Setup
    ├─ Checklist
    ├─ Google Sheets structure
    ├─ GAS deployment
    ├─ Frontend updates
    ├─ Testing steps
    ├─ Configuration recap
    ├─ Error solutions
    └─ Features enabled

```

## Key File Dependencies

```
index.html
    └─ assets/style.css
    └─ assets/script.js (sha256)

login.html
    └─ assets/style.css
    └─ assets/script.js (sha256, APIClient.login)

dashboard.html
    └─ assets/style.css
    └─ assets/script.js (AuthManager, APIClient)

quiz.html
    └─ swiper.min.css (CDN)
    └─ assets/style.css
    └─ assets/script.js (sha256, GradingEngine, APIClient)
    └─ swiper.min.js (CDN)

admin.html
    └─ chart.min.js (CDN)
    └─ assets/style.css
    └─ assets/script.js (AikenParser, APIClient)

result.html
    └─ assets/style.css
    └─ assets/script.js

Quiz_Lab_Backend.gs
    └─ Google Sheets API
    └─ Utilities (crypto, base64)
```

## External Libraries

| Library | Usage | CDN/Local |
|---------|-------|-----------|
| Swiper.js | Quiz player slides | CDN: jsdelivr |
| Chart.js | Admin statistics | CDN: jsdelivr |
| Web Crypto API | SHA-256 hashing | Built-in Browser API |
| Google Sheets API | Data storage | Built-in GAS API |

## Code Statistics

| File | Lines | Purpose |
|------|-------|---------|
| index.html | ~80 | Landing page |
| login.html | ~120 | Authentication |
| dashboard.html | ~160 | Quiz selection |
| quiz.html | ~220 | Quiz player + scoring |
| admin.html | ~230 | Admin management |
| result.html | ~145 | Result display |
| style.css | ~1000+ | Complete styling |
| script.js | ~550 | Client-side logic |
| Backend.gs | ~400 | Server-side logic |

**Total:** ~3000+ lines of code

## Configuration Files

### Frontend (in HTML files)
```javascript
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwFuUIJGsZ1y4voIjdhUR471Ocw63mpq0ZChEmtHJmHOnkERryTxU6GrUkLQh433CBs/exec';
const SECRET_KEY = 'TsByinChei'; // in script.js
```

### Backend (in Google Apps Script)
```javascript
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
const SECRET_KEY = 'TsByinChei';
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000;
```

## Data Flow Diagram

```
User Input (HTML)
    ↓
Frontend Logic (JS)
    ↓
SHA-256 Hashing (Web Crypto)
    ↓
API Request (Fetch)
    ↓
Google Apps Script
    ↓
Google Sheets Database
    ↓
Response JSON
    ↓
Frontend Rendering
    ↓
User Output (UI)
```

---

**Project Status:** ✅ **COMPLETE & READY FOR DEPLOYMENT**
