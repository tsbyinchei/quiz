# QUIZ LAB - Setup Guide (Updated)

Tai lieu nay mo ta quy trinh setup theo trang thai code hien tai.

## 1) Chuan bi Google Sheets

Tao 4 sheet dung ten:
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

Luu y:
- Schema moi KHONG co cot Reserved.
- Backend van doc tuong thich du lieu cu neu sheet da tung dung cot Reserved.

### Attempt_Logs
Header:
- LogID | Username | QuizID | Score | User_Answers | Timestamp

## 2) Deploy Google Apps Script

1. Mo Google Sheet.
2. Extensions > Apps Script.
3. Dan code Quiz_Lab_Backend.gs.
4. Neu la standalone script, dien SPREADSHEET_ID.
5. Deploy > New deployment > Web app:
   - Execute as: ban
   - Who has access: Anyone
6. Copy deployment URL.

## 3) Cau hinh frontend

Cap nhat URL tai:
- assets/script.js (APIClient.GAS_URL)

Luu y:
- Hien tai frontend goi API thong qua APIClient, khong can sua tung HTML rieng.

## 4) Tao password hash

Dung console:
- await sha256('matkhau')

Dan hash vao cot Password_Hash trong Users.

## 5) Test nhanh

### User flow
1. Login user.
2. Chon mon hoc > chon quiz > lam bai.
3. Nop bai > xem result + review.

### Admin flow
1. Login admin.
2. Vao admin.html.
3. Chuyen view bang nut:
   - Quan Ly Bai Thi
   - Nhap Cau Hoi Hang Loat
4. Thu toggle status/showAnswer.
5. Thu import Aiken.

## 6) Aiken format

Question text?
A) Option A
B) Option B
C) Option C
D) Option D
ANSWER: B
EXP: Giai thich

Co the dung A. B. C. D. hoac A) B) C) D).

## 7) Loi thuong gap

- Invalid token:
  - Sai deployment URL hoac token het han.
- Unauthorized:
  - Role khong dung (User vao API admin).
- Quiz khong hien:
  - Quiz status chua Active.
- Diem sai:
  - Kiem tra CorrectAnswer co dung A/B/C/D.
  - Deploy lai GAS sau thay doi backend.

## 8) Checklist truoc khi ban giao

- Deploy GAS moi nhat.
- APIClient.GAS_URL dung deployment URL moi nhat.
- Test user + admin tren browser private.
- Kiem tra import Aiken va ket qua review sau nop bai.
