# QUIZ LAB - Setup Guide (Updated)

Tài liệu này mô tả quy trình setup theo trạng thái code hiện tại.

## 1) Chuẩn bị Google Sheets

Tạo 4 sheet đúng tên:
- Users
- Quiz_List
- Questions
- Attempt_Logs

### Users
Header:
- Username | Password_Hash | Role | FullName

### Quiz_List
Header:
- QuizID | Subject | Title | Description | TimeLimit | Status | Show_Answer

### Questions
Header:
- QuestionID | QuizID | QuestionText | A | B | C | D | CorrectAnswer | Explanation

Lưu ý:
- Schema mới KHÔNG có cột Reserved.
- Backend vẫn đọc tương thích dữ liệu cũ nếu sheet đã từng dùng cột Reserved.

### Attempt_Logs
Header:
- LogID | Username | QuizID | Score | User_Answers | Timestamp

## 2) Deploy Google Apps Script

1. Mở Google Sheet.
2. Extensions > Apps Script.
3. Dán code Quiz_Lab_Backend.gs.
4. Nếu là standalone script, điền SPREADSHEET_ID.
5. Deploy > New deployment > Web app:
   - Execute as: bạn
   - Who has access: Anyone
6. Copy deployment URL.

## 3) Cấu hình frontend

Cập nhật URL tại:
- assets/script.js (APIClient.GAS_URL)

Lưu ý:
- Hiện tại frontend gọi API thông qua APIClient, không cần sửa từng HTML riêng.

## 4) Tạo password hash

Dùng console:
- await sha256('matkhau')

Dán hash vào cột Password_Hash trong Users.

## 5) Test nhanh

### User flow
1. Login user.
2. Chọn môn học > chọn quiz > làm bài.
3. Nộp bài > xem result + review.

### Admin flow
1. Login admin.
2. Vào admin.html.
3. Chuyển view bằng nút:
   - Quản Lý Bài Thi
   - Nhập Câu Hỏi Hàng Loạt
4. Chọn một môn ở danh sách bên trái để xem quiz của riêng môn đó.
5. Thử bulk toggle theo môn cho status/showAnswer/shuffle/anti-cheat/auto-next/allow-back.
6. Thử import Aiken bằng cách dán nội dung hoặc nạp file `.txt`.

## 6) Aiken format

Question text?
A) Option A
B) Option B
C) Option C
D) Option D
ANSWER: B
EXP: Giải thích

Có thể dùng A. B. C. D. hoặc A) B) C) D).

## 7) Lỗi thường gặp

- Invalid token:
  - Sai deployment URL hoặc token hết hạn.
- Unauthorized:
  - Role không đúng (User vào API admin).
- Quiz không hiện:
  - Quiz status chưa Active.
- Điểm sai:
  - Kiểm tra CorrectAnswer có đúng A/B/C/D.
  - Deploy lại GAS sau thay đổi backend.

## 8) Checklist trước khi bàn giao

- Deploy GAS mới nhất.
- APIClient.GAS_URL đúng deployment URL mới nhất.
- Test user + admin trên browser private.
- Kiểm tra import Aiken và kết quả review sau nộp bài.
