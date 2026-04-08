# Quiz Lab

He thong quiz online su dung Vanilla JS + Google Apps Script + Google Sheets.

## Tinh nang hien tai

### Nguoi dung
- Dang nhap voi hash SHA-256.
- Dashboard moi: chon mon hoc, danh sach quiz card dong deu, thong ke ca nhan.
- Lam bai theo timer, progress, slide cau hoi (Swiper).
- 2 mode:
  - Practice: co the xem phan hoi ngay khi chon dap an.
  - Exam: nop bai moi hien ket qua.
- Trang ket qua moi: tong quan diem + review tung cau hoi.

### Admin
- Admin Dashboard moi voi 2 khu vuc chuyen bang nut:
  - Quan ly bai thi
  - Nhap cau hoi hang loat (Aiken)
- Chart.js da nang cap:
  - Bar: luot lam
  - Line: so cau hoi
- Toggle status quiz va showAnswer ngay tren card quan ly.

### Bao mat va do tin cay
- Token auth, role-based access (User/Admin).
- Anti-cheat module:
  - Chan phim tat, chuot phai, copy/paste, text selection.
  - Theo doi roi man hinh quiz.
  - Co lock trang thai dialog va cooldown tranh loop canh bao.
- Popup browser da duoc thay bang in-app modal trong quiz de tranh event xung dot.
- Backend cham diem phia server de tranh sai so do client gui score.

## Cau truc

- index.html
- login.html
- dashboard.html
- quiz.html
- result.html
- admin.html
- Quiz_Lab_Backend.gs
- assets/style.css
- assets/script.js
- assets/anticheating.js

## Data model (Google Sheets)

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

## Ghi chu quan trong

- Backend da ho tro du lieu Questions theo 2 dang cot dap an (de tuong thich du lieu cu).
- Bulk upload hien tai ghi theo schema moi (khong chen cot rong).
- Result page hien diem theo dang dung/tong de de doc.

## Quick start

1. Tao Google Sheets dung ten 4 sheet o tren.
2. Deploy Quiz_Lab_Backend.gs dang Web App (Who has access: Anyone).
3. Dat GAS URL trong APIClient.GAS_URL (assets/script.js).
4. Tao user hash SHA-256 va dien vao Users.
5. Dang nhap va test role User/Admin.

## Troubleshooting

- Invalid token:
  - Kiem tra deployment URL.
  - Kiem tra deployment access la Anyone.
- Khong hien quiz:
  - Kiem tra quiz Status = Active.
  - Kiem tra QuizID giua Quiz_List va Questions.
- Diem sai:
  - Kiem tra CorrectAnswer trong Questions co A/B/C/D hop le.
  - Deploy lai GAS sau khi cap nhat backend.
