# QUIZ LAB - Online Quiz System

> Developer: TsByin  
> Stack: Vanilla JS + Google Apps Script + Google Sheets  
> Status: Production-ready core flow (User + Admin + Anti-cheat + Review)

Quiz Lab la he thong kiem tra truc tuyen gon nhe, de trien khai, de mo rong, va toi uu cho van hanh tren Google Apps Script.

---------------------------------------------------------------------

## 1) PROJECT OVERVIEW

Quiz Lab gom 2 vai tro chinh:

- User:
  - Dang nhap, chon mon, chon bai quiz, lam bai theo timer.
  - Xem ket qua sau khi nop bai, review tung cau hoi.

- Admin:
  - Quan ly trang thai quiz (Active/Inactive).
  - Bat/tat che do show answer.
  - Import cau hoi hang loat bang Aiken format.
  - Theo doi thong ke va bieu do hoat dong.

Muc tieu cua he thong:

- Don gian khi setup.
- Chay duoc tren static hosting + GAS backend.
- Cham diem dung, review ro rang, chong gian lan co ban.
- Giao dien hien dai, responsive, thong nhat voi tsbyin.dev.

---------------------------------------------------------------------

## 2) CURRENT HIGHLIGHTS

### 2.1 User Experience

- Login SHA-256 (khong gui mat khau thuong).
- Dashboard da duoc redesign:
  - Subject picker dang pills.
  - Quiz cards dong deu chieu cao.
  - Nut action can deu, ten dai khong pha bo cuc.
- Quiz player:
  - Swiper slide.
  - Timer, progress, indicator.
  - Confirm modal noi bo (khong dung alert/confirm browser).
- Result page redesign:
  - Tong quan ket qua.
  - Review chi tiet theo tung cau.
  - Hien thi dap an da chon, dap an dung, giai thich.

### 2.2 Admin Experience

- Admin dashboard da tach view bang nut:
  - Quan Ly Bai Thi
  - Nhap Cau Hoi Hang Loat
- Chart.js da nang cap:
  - Bar: so luot lam
  - Line: so cau hoi
- Card quan ly quiz ro rang:
  - QuizID, subject, title, mo ta
  - So cau hoi, so luot lam
  - Toggle status + showAnswer

### 2.3 Security and Reliability

- Token auth + role-based routing.
- Backend cham diem server-side (khong phu thuoc diem client gui len).
- Anti-cheat:
  - Chan keyboard shortcuts, right-click, clipboard, text selection.
  - Theo doi tab/focus khi dang lam bai.
  - Co cooldown + dialog lock de tranh false positive.
  - Auto-submit mode khi vi pham qua nguong.
- Co log vi pham anti-cheat ve backend.

### 2.4 Performance Optimizations

- Them endpoint `getDashboardInit` de gom subjects + stats trong 1 request.
- Dashboard ap dung stale-while-revalidate:
  - Render nhanh tu session cache.
  - Refresh ngam de cap nhat du lieu moi.
- Cache quiz theo tung subject trong sessionStorage.
- Admin data aggregation da toi uu bang object mapping (giam nested loops).
- Lazy chart render trong admin (chi ve khi view quan ly dang hien).

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
|-- ANTICHEATING_SUMMARY.md
|-- ANTICHEATING_INTEGRATION.md
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
- Anti-cheat module rieng: `assets/anticheating.js`.

### 4.2 Backend

- Google Apps Script Web App (`Quiz_Lab_Backend.gs`).
- Action-based router qua `doPost`.

Actions hien co:

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

- Google Sheets dong vai tro database.

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

Luu y tuong thich:

- Backend co helper de doc du lieu Questions theo ca schema cu va schema moi.
- Bulk upload hien ghi theo schema moi (khong chen cot rong Reserved).

---------------------------------------------------------------------

## 6) SETUP QUICK START

### Step 1: Tao Google Sheets

Tao 4 sheet dung ten chinh xac:

- Users
- Quiz_List
- Questions
- Attempt_Logs

### Step 2: Deploy GAS

1. Mo Google Sheets > Extensions > Apps Script.
2. Dan code tu `Quiz_Lab_Backend.gs`.
3. Neu standalone script: dien `SPREADSHEET_ID`.
4. Deploy Web App:
   - Execute as: ban
   - Who has access: Anyone
5. Copy deployment URL.

### Step 3: Cau hinh frontend API

Cap nhat `APIClient.GAS_URL` trong `assets/script.js`.

### Step 4: Tao user va password hash

Tao SHA-256 cho password va luu vao cot `Password_Hash`.

### Step 5: Test end-to-end

1. Login user.
2. Chon subject/quiz.
3. Lam bai, nop bai, xem result + review.
4. Login admin.
5. Test toggle + import Aiken + chart.

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

Chap nhan ca dinh dang:

- `A)` `B)` `C)` `D)`
- `A.` `B.` `C.` `D.`

---------------------------------------------------------------------

## 8) ANTI-CHEAT NOTES

Co che hien tai tap trung vao quiz page:

- Chan thao tac copy/inspect co ban.
- Theo doi tab switch/focus loss.
- Canh bao theo lan vi pham.
- Auto-submit mode khi vuot nguong.

Cac fix quan trong da ap dung:

- Event conflict blur + visibilitychange.
- Popup loop do browser alert/confirm.
- Dialog lock + cooldown + anti-repeat punishment.
- Chuyen sang in-app modal de giu UX on dinh.

---------------------------------------------------------------------

## 9) KNOWN OPERATION RULES

- Sau moi thay doi backend, can deploy lai GAS.
- Neu dashboard khong co stats ngay:
  - He thong co fallback ve API cu (`getSubjects` + `getUserStats`).
- Neu score/review khong dung:
  - Kiem tra cot `CorrectAnswer` co A/B/C/D hop le.
  - Kiem tra du lieu Question/QuizID khop nhau.

---------------------------------------------------------------------

## 10) TROUBLESHOOTING

### Invalid token

- Kiem tra GAS deployment URL dung.
- Kiem tra Web App access la `Anyone`.
- Kiem tra token da het han chua.

### Quiz khong hien o dashboard

- Kiem tra `Status` quiz = `Active`.
- Kiem tra `Subject` co du lieu.

### Nop bai ra diem sai

- Kiem tra `CorrectAnswer`.
- Kiem tra backend da deploy ban moi.

### Admin chart/trang thai bat thuong

- Kiem tra logs co gia tri score hop le.
- Kiem tra du lieu quiz/question co day du.

### Anti-cheat trigger sai

- Dam bao dang dung ban code moi co modal noi bo.
- Refresh trinh duyet de clear stale JS.

---------------------------------------------------------------------

## 11) CHANGE SUMMARY (RECENT)

- Redesign dashboard/result/admin UI.
- Tach view admin theo nut.
- Server-side scoring va review payload day du.
- Fix cot dap an khi bulk upload.
- Toi uu dashboard init va admin aggregation.
- Dong bo header/footer style theo tsbyin.dev.

---------------------------------------------------------------------

## 12) LICENSE

Personal project for learning and internal deployment.

For production/public use, review legal and privacy requirements before collecting user activity data.
