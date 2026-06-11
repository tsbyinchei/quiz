# QUIZ LAB - Setup Guide

Tài liệu setup theo trạng thái code hiện tại trong thư mục quiz.

## 1) Chuẩn bị Google Sheets

Tạo đúng 5 sheet:

- Users
- ReferralCodes
- Quiz_List
- Questions
- Attempt_Logs

### 1.1 Users

Header khuyến nghị:

- Username
- Password_Hash
- Role
- FullName
- AdminPinHash
- CreatedAt

Ghi chú:

- Admin đăng nhập admin.html bắt buộc phải có AdminPinHash để verify PIN.
- Backend có cơ chế detect header linh hoạt, nhưng nên dùng đúng tên trên.

### 1.2 ReferralCodes

Header:

- Code
- Status
- UsedBy
- UsedAt

Quy ước:

- Code dạng REF-XXXXXXXX
- Status: Active hoặc Used

### 1.3 Quiz_List

Header khuyến nghị:

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

- Dashboard và Admin sẽ tự tính `questionCount` từ sheet Questions khi tải dữ liệu.
- Admin hiển thị `attempts` là tổng lượt làm của tất cả user, còn dashboard hiển thị `userAttempts` theo user đang đăng nhập.

### 1.4 Questions

Header:

- QuestionID
- QuizID
- QuestionText
- A
- B
- C
- D
- CorrectAnswer
- Explanation

### 1.5 Attempt_Logs

Header:

- LogID
- Username
- QuizID
- Score
- User_Answers
- Timestamp

## 2) Deploy backend (Google Apps Script)

1. Mở file Google Sheet.
2. Extensions > Apps Script.
3. Dán nội dung Quiz_Lab_Backend.gs.
4. Nếu là standalone script, điền SPREADSHEET_ID.
5. Deploy > New deployment > Web app:
   - Execute as: bạn
   - Who has access: Anyone
6. Lưu URL Web App.

## 3) Cấu hình frontend

Sửa API URL tại assets/script.js:

- APIClient.GAS_URL = 'YOUR_DEPLOYMENT_URL'

## 4) Tạo hash cho tài khoản

Trong browser console:

- await sha256('user_password')
- await sha256('admin_pin_value')

Điền vào Users:

- Password_Hash: hash mật khẩu user/admin
- AdminPinHash: chỉ cần cho tài khoản Admin dùng admin.html

## 5) Quy trình test nhanh

### 5.1 User registration/login

1. Mở register.html.
2. Đăng ký với mã referral Active.
3. Kiểm tra referral code chuyển trạng thái Used.
4. Đăng nhập tại login.html.

### 5.2 User quiz flow

1. Mở dashboard.html.
2. Chọn môn, chọn bài quiz.
3. Làm bài và nộp.
4. Kiểm tra loading "Đang nộp bài..." và trang result.html.

### 5.3 Admin flow

1. Đăng nhập bằng tài khoản Admin.
2. Vào admin.html, nhập PIN để verify.
3. Kiểm tra loading "Đang xác thực PIN...".
4. Test các tab:
   - Quản lý bài thi
   - Quản lý chức năng
   - Nhập câu hỏi hàng loạt
   - Quản lý mã

Khi ở tab Quản Lý Chức Năng, có thể bật/tắt nhiều mode trước rồi mới bấm lưu nhờ bar "Bạn có X thay đổi chưa lưu.".

### 5.4 Anti-cheat/Fullscreen

1. Bật `AntiCheatTabSwitch` hoặc `AntiCheatFullscreen` cho 1 quiz trong admin.
2. Nếu bật fullscreen mode, vào quiz sẽ hiện prompt fullscreen có nút vào toàn màn hình.
3. Thoát fullscreen sau khi đã vào fullscreen (khi fullscreen mode đang bật): phải bị ghi nhận vi phạm.
4. Chuyển về `AntiCheatTabSwitch=false` và `AntiCheatFullscreen=false`: quiz chạy mode BASIC (không monitor tab/fullscreen).

## 6) Aiken format hợp lệ

Ví dụ:

Question text?
A) Option A
B) Option B
C) Option C
D) Option D
ANSWER: B
EXP: Giai thich

Parser hỗ trợ A) hoặc A.

## 7) Lỗi thường gặp

- Invalid token: sai URL deploy hoặc token hết hạn.
- Unauthorized: role không phù hợp hoặc thiếu Admin PIN proof.
- Admin PIN required: chưa verify PIN trước khi gọi action admin.
- Quiz not found/No questions found: dữ liệu sheet thiếu hoặc sai quizID.

## 8) Checklist trước khi bàn giao

- GAS đã deploy bản mới nhất.
- APIClient.GAS_URL đúng.
- Đủ 5 sheet + đúng header.
- Tài khoản Admin có AdminPinHash hợp lệ.
- Đăng ký user bằng referral code chạy đúng.
- Admin verify PIN, quản lý mã và tạo mã chạy đúng.
- Tab Quản Lý Chức Năng bật/tắt 7 mode toàn cục (bao gồm Tab switch và Fullscreen riêng biệt) và vẫn lưu theo batch hoạt động đúng.
- Submit quiz và result/review trả dữ liệu đầy đủ.

## 9) JWT secret rotation (Phase 2)

### 9.1 Script Properties cần có

- QUIZ_JWT_SECRET_CURRENT: secret đang dùng để ký token mới.
- QUIZ_JWT_SECRET_PREVIOUS: secret cũ, dùng để verify token trong giai đoạn chuyển tiếp.

Ghi chú tương thích:

- Nếu hệ thống cũ chỉ có QUIZ_JWT_SECRET, backend vẫn đọc được như current secret.
- Sau khi rotate lần đầu, nên giữ theo cặp CURRENT/PREVIOUS.

### 9.2 Quy trình rotate đề xuất

1. Vào Apps Script > Project Settings > Script properties.
2. Copy giá trị QUIZ_JWT_SECRET_CURRENT hiện tại sang QUIZ_JWT_SECRET_PREVIOUS.
3. Gán secret mới vào QUIZ_JWT_SECRET_CURRENT.
4. Lưu lại và redeploy web app (Deploy > Manage deployments > Edit > Deploy).
5. Theo dõi login/token trong 24h (chu kỳ hết hạn token) rồi cân nhắc thay QUIZ_JWT_SECRET_PREVIOUS.

### 9.3 Helper rotate trong backend

- Hàm `rotateJwtSecret_(newSecret)` có sẵn trong Quiz_Lab_Backend.gs.
- Hàm này tự:
   - chuyển current thành previous,
   - set current mới,
   - xóa key legacy QUIZ_JWT_SECRET,
   - clear cache secret.
