# QUIZ LAB - Online Quiz System

Developer: TsByin
Stack: Vanilla JS + Google Apps Script + Google Sheets
Status: User/Admin core flow running

## 1) Tổng quan

Quiz Lab là hệ thống thi trắc nghiệm online gồm 2 vai trò:

- User: đăng ký (có mã giới thiệu), đăng nhập, làm bài, xem kết quả/review.
- Admin: quản lý quiz, import câu hỏi Aiken, quản lý mã giới thiệu, theo dõi thống kê.

## 2) Tính năng hiện có

### 2.1 User

- Đăng ký 5 trường: Họ tên, Username, Mật khẩu, Nhập lại mật khẩu, Mã giới thiệu.
- Kiểm tra referral code server-side, chỉ tạo tài khoản khi mã ở trạng thái Active.
- Đăng nhập bằng password hash SHA-256 (frontend gửi hash, backend so hash).
- Dashboard theo môn học, danh sách bài theo môn, có thống kê người dùng.
- Mỗi quiz trên dashboard hiển thị thêm số câu hỏi và lượt làm của riêng user.
- Làm bài bằng Swiper, có timer/progress/chỉ báo câu hỏi.
- Nộp bài chấm điểm ở backend, trả về review chi tiết từng câu.
- Trang kết quả hiển thị score, số câu đúng/tổng, và phần giải thích.

### 2.2 Admin

- Bắt buộc role Admin + xác thực Admin PIN (endpoint verifyAdminPin).
- Quản lý quiz theo môn, toggle từng bài:
  - Status
  - Show Answer
  - Shuffle
  - Anti-Cheat (Tab switch)
  - Anti-Cheat (Fullscreen)
  - Auto Next
  - Allow Back
- Bulk toggle theo môn qua batchUpdateQuizSettings.
- Tab "Quản Lý Chức Năng" cho phép bật/tắt 7 mode trên toàn bộ quiz cùng lúc, và vẫn đi theo luồng chờ lưu thay đổi.
- Import câu hỏi hàng loạt theo Aiken format.
- Quản lý mã giới thiệu:
  - Lấy danh sách mã
  - Tạo mã mới (mặc định 10, tối đa 100/lần)
  - Định dạng mã: REF-XXXXXXXX
- Admin mobile có layout riêng: subject picker dạng dropdown, tab quản lý tối ưu cho màn hình nhỏ, và nút Back to top.

### 2.3 Security + Anti-cheat

- Token HMAC-SHA256 có sessionId và expiry.
- Server-side scoring (không tin điểm từ client).
- Anti-cheat module:
  - Luôn chặn DevTools shortcut, right-click, copy/cut/paste, select text.
  - Tab + Fullscreen mode: monitor tab/focus + fullscreen exit.
  - Tab-only mode: chỉ monitor tab/focus.
  - Fullscreen-only mode: chỉ monitor fullscreen exit.
  - BASIC mode: không monitor tab/focus/fullscreen, nhưng vẫn chặn DevTools/clipboard/mouse.
  - Vi phạm có cooldown 1200ms, tối đa 3 lần sẽ auto-submit điểm 0.
  - Có log vi phạm lên backend (action logCheatViolation).

### 2.4 Fullscreen hiện tại

- Không auto fullscreen khi vào quiz.
- Khi quiz bật antiCheatFullscreen, giao diện hiện prompt với nút "Vào Toàn Màn Hình".
- Nếu user đã vào fullscreen rồi thoát ra, anti-cheat ghi nhận vi phạm fullscreen_exit.
- Nếu antiCheatTabSwitch và antiCheatFullscreen cùng tắt, hệ thống chạy anti-cheat BASIC (không monitor tab/fullscreen).

### 2.5 Loading overlay hiện tại

- register.html: "Đang xác thực mã giới thiệu..."
- login.html: "Đang xác thực thông tin..."
- quiz.html: "Đang nộp bài..."
- admin.html: "Đang xác thực PIN..." (khi verify Admin PIN)

## 3) API actions backend

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

Ghi chú dữ liệu trả về:

- `getDashboardInit`: trả về `subjects`, `quizzesBySubject`, `stats`; mỗi quiz trong dashboard có thêm `questionCount` và `userAttempts`.
- `getAdminData`: trả về `stats` và danh sách `quizzes`; mỗi quiz có `questionCount` và `attempts`.

## 4) Google Sheets schema

### Users

Khuyến nghị header:

- Username
- Password_Hash
- Role
- FullName
- AdminPinHash
- CreatedAt

Ghi chú:

- Backend có fallback header detection, nhưng nên giữ đúng tên để ổn định.

### ReferralCodes

- Code
- Status (Active/Used)
- UsedBy
- UsedAt

### Quiz_List

- QuizID
- Subject
- Title
- Description
- TimeLimit
- Status
- Show_Answer
- Shuffle
- AntiCheat
- AntiCheatTabSwitch
- AntiCheatFullscreen
- AutoNext
- AllowBack

Ghi chú:

- `questionCount` không lưu trực tiếp trong sheet này mà được backend đếm từ sheet Questions.
- `attempts` trên Admin là tổng lượt làm của tất cả user, còn `userAttempts` ở dashboard là số lần của user hiện tại.
- `AntiCheat` được giữ để tương thích dữ liệu cũ; giá trị thực tế theo mode mới là `AntiCheatTabSwitch` và `AntiCheatFullscreen`.

### Questions

- QuestionID
- QuizID
- QuestionText
- A
- B
- C
- D
- CorrectAnswer
- Explanation

### Attempt_Logs

- LogID
- Username
- QuizID
- Score (hoặc CHEAT)
- User_Answers (hoặc log payload JSON)
- Timestamp

## 5) Caching hiện tại (backend)

- Quiz snapshot: 300s
- Dashboard init: 90s
- User stats: 120s
- Admin data: 300s
- Session/Admin PIN proof: cache 21600s

Nút refresh ở phần Thống Kê Tổng Quan trong admin chỉ gọi lại `getAdminData()` và render lại view hiện tại.

## 6) Build

Trong package.json:

- npm run build:quiz
- npm run clean:dist

Dev dependencies:

- terser
- html-minifier-terser
- clean-css
- javascript-obfuscator

## 7) Setup nhanh

Xem chi tiết ở SETUP_GUIDE.md.

Tối thiểu cần làm:

1. Tạo đúng 5 sheet: Users, ReferralCodes, Quiz_List, Questions, Attempt_Logs.
2. Deploy Quiz_Lab_Backend.gs thành Web App.
3. Cập nhật APIClient.GAS_URL trong assets/script.js.
4. Chuẩn bị tài khoản Admin có AdminPinHash để vào admin.html.

---------------------------------------------------------------------

## 7) AIKEN IMPORT FORMAT

```
Question text?
A) Option A
B) Option B
C) Option C
D) Option D
ANSWER: B
EXP: Explanation
```

Chấp nhận cả định dạng:

- `A)` `B)` `C)` `D)`
- `A.` `B.` `C.` `D.`

Ngoài dán trực tiếp, phần admin import còn hỗ trợ nạp file `.txt` vào ô nội dung rồi kiểm tra / chỉnh tay trước khi nhập.

---------------------------------------------------------------------

## 8) ANTI-CHEAT NOTES

Cơ chế hiện tại tập trung vào quiz page:

- Chặn thao tác copy/inspect cơ bản.
- Theo dõi tab switch/focus loss.
- Cảnh báo theo lần vi phạm.
- Auto-submit mode khi vượt ngưỡng.

Các fix quan trọng đã áp dụng:

- Event conflict blur + visibilitychange.
- Popup loop do browser alert/confirm.
- Dialog lock + cooldown + anti-repeat punishment.
- Chuyển sang in-app modal để giữ UX ổn định.

---------------------------------------------------------------------

## 9) KNOWN OPERATION RULES

- Sau mỗi thay đổi backend, cần deploy lại GAS.
- Nếu dashboard không có stats ngay:
  - Hệ thống có fallback về API cũ (`getSubjects` + `getUserStats`).
- Nếu score/review không đúng:
  - Kiểm tra cột `CorrectAnswer` có A/B/C/D hợp lệ.
  - Kiểm tra dữ liệu Question/QuizID khớp nhau.

---------------------------------------------------------------------

## 10) TROUBLESHOOTING

### Invalid token

- Kiểm tra GAS deployment URL đúng.
- Kiểm tra Web App access là `Anyone`.
- Kiểm tra token đã hết hạn chưa.

### Quiz không hiện ở dashboard

- Kiểm tra `Status` quiz = `Active`.
- Kiểm tra `Subject` có dữ liệu.

### Nộp bài ra điểm sai

- Kiểm tra `CorrectAnswer`.
- Kiểm tra backend đã deploy bản mới.

### Admin chart/trạng thái bất thường

- Kiểm tra logs có giá trị score hợp lệ.
- Kiểm tra dữ liệu quiz/question có đầy đủ.

### Anti-cheat trigger sai

- Đảm bảo đang dùng bản code mới có modal nội bộ.
- Refresh trình duyệt để clear stale JS.

---------------------------------------------------------------------

## 11) CHANGE SUMMARY (RECENT)

- Redesign dashboard/result/admin UI.
- Dashboard hiển thị thêm `questionCount` và `userAttempts`.
- Admin có tab Quản Lý Chức Năng để điều khiển 6 mode trên toàn hệ thống.
- Tách view admin theo nút.
- Server-side scoring và review payload đầy đủ.
- Fix cột đáp án khi bulk upload.
- Tối ưu dashboard init và admin aggregation.
- Đồng bộ header/footer style theo tsbyin.dev.

---------------------------------------------------------------------

## 12) LICENSE

Personal project for learning and internal deployment.

For production/public use, review legal and privacy requirements before collecting user activity data.
