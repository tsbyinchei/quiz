# QUIZ LAB - Online Quiz System

> Developer: TsByin  
> Stack: Vanilla JS + Google Apps Script + Google Sheets  
> Status: Production-ready core flow (User + Admin + Anti-cheat + Review)

Quiz Lab là hệ thống kiểm tra trực tuyến gọn nhẹ, dễ triển khai, dễ mở rộng, và tối ưu cho vận hành trên Google Apps Script.

---------------------------------------------------------------------

## 1) PROJECT OVERVIEW

Quiz Lab gồm 2 vai trò chính:

- User:
  - Đăng nhập, chọn môn, chọn bài quiz, làm bài theo timer.
  - Xem kết quả sau khi nộp bài, review từng câu hỏi.

- Admin:
  - Quản lý trạng thái quiz (Active/Inactive).
  - Bật/tắt chế độ show answer.
  - Import câu hỏi hàng loạt bằng Aiken format.
  - Theo dõi thống kê và biểu đồ hoạt động.

Mục tiêu của hệ thống:

- Đơn giản khi setup.
- Chạy được trên static hosting + GAS backend.
- Chấm điểm đúng, review rõ ràng, chống gian lận cơ bản.
- Giao diện hiện đại, responsive, thống nhất với tsbyin.dev.

---------------------------------------------------------------------

## 2) CURRENT HIGHLIGHTS

### 2.1 User Experience

- Login SHA-256 (không gửi mật khẩu thường).
- Dashboard đã được redesign:
  - Subject picker dạng pills.
  - Quiz cards đồng đều chiều cao.
  - Nút action căn đều, tên dài không phá bố cục.
- Quiz player:
  - Swiper slide.
  - Timer, progress, indicator.
  - Confirm modal nội bộ (không dùng alert/confirm browser).
- Result page redesign:
  - Tổng quan kết quả.
  - Review chi tiết theo từng câu.
  - Hiển thị đáp án đã chọn, đáp án đúng, giải thích.

### 2.2 Admin Experience

- Admin dashboard đã tách view bằng nút:
  - Quản Lý Bài Thi
  - Nhập Câu Hỏi Hàng Loạt
- Màn quản lý bài thi đã chuyển sang danh sách môn giống dashboard, chỉ hiển thị quiz của môn đang chọn.
- Có cụm nút bật/tắt hàng loạt theo từng môn cho status, show answer, shuffle, anti-cheat, auto-next và allow-back.
- Chart.js đã nâng cấp:
  - Bar: số lượt làm
  - Line: số câu hỏi
- Card quản lý quiz rõ ràng:
  - QuizID, subject, title, mô tả
  - Số câu hỏi, số lượt làm
  - Toggle status + showAnswer

### 2.3 Security and Reliability

- Token auth + role-based routing.
- Backend chấm điểm server-side (không phụ thuộc điểm client gửi lên).
- Anti-cheat:
  - Chặn keyboard shortcuts, right-click, clipboard, text selection.
  - Theo dõi tab/focus khi đang làm bài.
  - Có cooldown + dialog lock để tránh false positive.
  - Auto-submit mode khi vi phạm quá ngưỡng.
- Có log vi phạm anti-cheat về backend.

### 2.4 Performance Optimizations

- Thêm endpoint `getDashboardInit` để gom subjects + stats trong 1 request.
- Dashboard áp dụng stale-while-revalidate:
  - Render nhanh từ session cache.
  - Refresh ngầm để cập nhật dữ liệu mới.
- Cache quiz theo từng subject trong sessionStorage.
- Admin data aggregation đã tối ưu bằng object mapping (giảm nested loops).
- Lazy chart render trong admin (chỉ vẽ khi view quản lý đang hiện).

---------------------------------------------------------------------

## 3) PROJECT STRUCTURE

```
quiz/
|-- index.html
|-- login.html
|-- dashboard.html
|-- quiz.html
|-- result.html
|-- admin.html
|-- hash.html
|-- Quiz_Lab_Backend.gs
|-- README.md
|-- SETUP_GUIDE.md
|-- FILE_STRUCTURE.md
`-- assets/
    |-- style.css
    |-- script.js
    `-- anticheating.js
```

---------------------------------------------------------------------

## 4) ARCHITECTURE

### 4.1 Frontend

- HTML/CSS/JS thuần.
- Shared API layer: `assets/script.js` (`APIClient`).
- Shared visual system: `assets/style.css`.
- Anti-cheat module riêng: `assets/anticheating.js`.

### 4.2 Backend

- Google Apps Script Web App (`Quiz_Lab_Backend.gs`).
- Action-based router qua `doPost`.

Actions hiện có:

- `login`
- `getSubjects`
- `getDashboardInit`
- `getQuizzesBySubject`
- `getQuizData`
- `submitScore`
- `getUserStats`
- `getAdminData`
- `updateQuizStatus`
- `updateShowAnswer`
- `bulkUpload`
- `logCheatViolation`

### 4.3 Data Store

- Google Sheets đóng vai trò database.

---------------------------------------------------------------------

## 5) GOOGLE SHEETS SCHEMA

### Users

- Username
- Password_Hash
- Role
- FullName

### Quiz_List

- QuizID
- Subject
- Title
- Description
- TimeLimit
- Status
- Show_Answer

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
- Score
- User_Answers
- Timestamp

Lưu ý tương thích:

- Backend có helper để đọc dữ liệu Questions theo cả schema cũ và schema mới.
- Bulk upload hiện ghi theo schema mới (không chèn cột rỗng Reserved).

---------------------------------------------------------------------

## 6) SETUP QUICK START

### Step 1: Tạo Google Sheets

Tạo 4 sheet đúng tên chính xác:

- Users
- Quiz_List
- Questions
- Attempt_Logs

### Step 2: Deploy GAS

1. Mở Google Sheets > Extensions > Apps Script.
2. Dán code từ `Quiz_Lab_Backend.gs`.
3. Nếu standalone script: điền `SPREADSHEET_ID`.
4. Deploy Web App:
  - Execute as: bạn
   - Who has access: Anyone
5. Copy deployment URL.

### Step 3: Cấu hình frontend API

Cập nhật `APIClient.GAS_URL` trong `assets/script.js`.

### Step 4: Tạo user và password hash

Tạo SHA-256 cho password và lưu vào cột `Password_Hash`.

### Step 5: Test end-to-end

1. Login user.
2. Chọn subject/quiz.
3. Làm bài, nộp bài, xem result + review.
4. Login admin.
5. Test chọn môn, bulk toggle theo môn, import Aiken và chart.

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
- Tách view admin theo nút.
- Server-side scoring và review payload đầy đủ.
- Fix cột đáp án khi bulk upload.
- Tối ưu dashboard init và admin aggregation.
- Đồng bộ header/footer style theo tsbyin.dev.

---------------------------------------------------------------------

## 12) LICENSE

Personal project for learning and internal deployment.

For production/public use, review legal and privacy requirements before collecting user activity data.
