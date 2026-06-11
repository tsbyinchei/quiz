# Quiz Lab - File Structure

## Project path trong workspace

`d:/Project/Github/tsbyin-cv/quiz/`

## Cây thư mục hiện tại

```text
quiz/
|-- admin.html
|-- dashboard.html
|-- FILE_STRUCTURE.md
|-- hash.html
|-- icon.ico
|-- index.html
|-- login.html
|-- package.json
|-- package-lock.json
|-- quiz.html
|-- Quiz_Lab_Backend.gs
|-- README.md
|-- register.html
|-- result.html
|-- SETUP_GUIDE.md
|-- assets/
|   |-- anticheating.js
|   |-- script.js
|   `-- style.css
|-- file/
`-- tools/
```

## Vai trò từng file chính

- index.html: landing page.
- register.html: đăng ký user bằng referral code.
- login.html: đăng nhập user/admin.
- dashboard.html: chọn môn, chọn quiz, xem stats cá nhân, hiển thị số câu hỏi và lượt làm theo từng quiz.
- quiz.html: làm bài, timer, submit, fullscreen prompt, loading overlay submit.
- result.html: hiển thị điểm + review.
- admin.html: panel admin (quản lý quiz/import/quản lý mã/quản lý chức năng toàn cục), verify Admin PIN.
- assets/script.js: sha256, AuthManager, AikenParser, APIClient, tiện ích dùng chung.
- assets/anticheating.js: anti-cheat module (tab/fullscreen configurable mode).
- assets/style.css: toàn bộ style shared.
- Quiz_Lab_Backend.gs: router doPost + toàn bộ xử lý backend.

## Luồng phụ thuộc trang

### User pages

- register.html -> assets/style.css + assets/script.js + assets/anticheating.js
- login.html -> assets/style.css + assets/script.js + assets/anticheating.js
- dashboard.html -> assets/style.css + assets/script.js
- quiz.html -> assets/style.css + assets/script.js + assets/anticheating.js + Swiper CDN
- result.html -> assets/style.css + assets/script.js

### Admin pages

- admin.html -> assets/style.css + assets/script.js + Chart.js CDN

## Anti-cheat & fullscreen ghi chú đúng hiện trạng

- antiCheat.enable(true, { tabSwitch: true, fullscreen: true }): monitor cả tab/focus và fullscreen; vi phạm cộng dồn chung 3 lần.
- antiCheat.enable(true, { tabSwitch: true, fullscreen: false }): chỉ monitor tab/focus; vi phạm 3 lần sẽ xử phạt.
- antiCheat.enable(true, { tabSwitch: false, fullscreen: true }): chỉ monitor fullscreen exit; vi phạm 3 lần sẽ xử phạt.
- antiCheat.enable(true, { tabSwitch: false, fullscreen: false }): BASIC mode (vẫn chặn DevTools/copy/paste/right-click/select, không monitor tab/fullscreen).
- quiz.html không auto fullscreen. Chỉ hiện prompt và user tự bấm nút fullscreen.
- Fullscreen exit chỉ được ghi nhận vi phạm khi monitorFullscreen đã được kích hoạt.
- Nút Làm mới trên thanh tab admin gọi lại loadAdminData() rồi render lại view đang mở.

## Loading overlay đang dùng ở đâu

- register.html: xác thực mã giới thiệu.
- login.html: xác thực đăng nhập.
- quiz.html: nộp bài.
- admin.html: xác thực Admin PIN.

## Backend actions (doPost router)

- login
- registerUser
- getSubjects
- getDashboardInit
- getQuizzesBySubject
- getQuizData
- submitScore
- getUserStats
- getAdminData
- getReferralCodes
- generateReferralCodes
- verifyAdminPin
- updateQuizStatus
- updateShowAnswer
- updateShuffle
- updateAntiCheat
- updateAntiCheatTabSwitch
- updateAntiCheatFullscreen
- updateAutoNext
- updateAllowBack
- batchUpdateQuizSettings
- bulkUpload
- logCheatViolation

## Cache backend (đang dùng)

- quiz_snapshot_v*: 300s
- dashboard_init_v*_<username>: 90s
- dashboard_stats_all / dashboard_stats_user_*: 120s
- admin_data_cache: 300s
- session_<username> và admin_pin_<username>: 21600s

## Current admin/dashboard data shape

- Dashboard init: subjects, quizzesBySubject, stats.
- Mỗi quiz trong dashboard có `questionCount` và `userAttempts`.
- Admin data: stats, quizzes.
- Mỗi quiz trong admin có `questionCount` và `attempts`.
