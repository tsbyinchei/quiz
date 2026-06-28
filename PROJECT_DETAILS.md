# 📚 TÀI LIỆU KỸ THUẬT TOÀN DIỆN DỰ ÁN TSBYIN EXAM
*Phiên bản: 4.0 (Bản nâng cấp phân tích chuyên sâu siêu chi tiết - Đạt tiêu chuẩn > 600 dòng)*

---

## MỤC LỤC
1. [Chương 1: Giới thiệu Tổng quan (Overview)](#chuong-1)
2. [Chương 2: Kiến trúc Hệ thống (System Architecture)](#chuong-2)
3. [Chương 3: Cơ sở Dữ liệu & Cấu trúc Schema (Database Schema)](#chuong-3)
4. [Chương 4: Giao tiếp Client-Server & API Endpoints](#chuong-4)
5. [Chương 5: Bảo mật Hệ thống & Xác thực (Security & Auth)](#chuong-5)
6. [Chương 6: Hệ thống Chống Gian lận (Anti-Cheat Engine)](#chuong-6)
7. [Chương 7: Cơ chế Caching & Tối ưu Hiệu năng](#chuong-7)
8. [Chương 8: Quản lý Bài thi & Chấm điểm Thực thi](#chuong-8)
9. [Chương 9: Trình Biên Dịch Aiken (Aiken Parser)](#chuong-9)
10. [Chương 10: Tích Hợp Dịch Vụ Mở Rộng (Telegram Bot)](#chuong-10)
11. [Chương 11: Quy trình Triển khai & Vận Hành (Deployment)](#chuong-11)
12. [Chương 12: Phân Tích UI/UX & Giao Diện Người Dùng](#chuong-12)
13. [Chương 13: Xử Lý Lỗi & Khắc Phục Sự Cố (Troubleshooting)](#chuong-13)
14. [Chương 14: Đánh Giá & Mở Rộng Tương Lai](#chuong-14)

---

<a name="chuong-1"></a>
## CHƯƠNG 1: GIỚI THIỆU TỔNG QUAN (OVERVIEW)

### 1.1. Bối cảnh dự án
**TsByin Exam** được khởi nguồn từ nhu cầu thực tiễn của các tổ chức giáo dục nhỏ lẻ, trung tâm gia sư, và cá nhân giáo viên cần một nền tảng thi trắc nghiệm trực tuyến linh hoạt. Vấn đề lớn nhất của các hệ thống LMS (Learning Management System) hiện nay là chi phí duy trì máy chủ (Server Hosting) và cơ sở dữ liệu đắt đỏ, đòi hỏi kỹ năng vận hành (DevOps) cao.
Dự án này ra đời nhằm giải quyết triệt để vấn đề đó bằng cách kết hợp sức mạnh của hệ sinh thái Google. Thay vì tốn hàng trăm đô la mỗi tháng cho AWS hoặc DigitalOcean, giáo viên chỉ cần 1 tài khoản Gmail miễn phí.

### 1.2. Mục tiêu Thiết kế
Hệ thống được thiết kế dựa trên 3 trụ cột chính:
1. **Zero-Cost Operation (Vận hành 0đ)**: Tận dụng hoàn toàn hệ sinh thái miễn phí của Google (Google Apps Script và Google Sheets). Hệ thống không yêu cầu chi phí máy chủ, không cần bảo trì hạ tầng mạng.
2. **High Security (Bảo mật cao)**: Xây dựng các lớp rào chắn chống gian lận cực kỳ khắt khe từ phía Client cho đến Server, ngang ngửa với các hệ thống thi chứng chỉ quốc tế chuyên nghiệp. Bao gồm giám sát hành vi, giám sát cửa sổ, và vô hiệu hóa công cụ dành cho nhà phát triển (DevTools).
3. **Ultra-Lightweight (Siêu nhẹ)**: Không sử dụng các framework Frontend nặng nề (như React, Vue). Toàn bộ dự án viết bằng Vanilla JS, CSS3 thuần, kết hợp với các library tối giản (Swiper, Chart.js) nhằm mang lại trải nghiệm tải trang cực nhanh, ngay cả trên các thiết bị di động có cấu hình thấp.

### 1.3. Khán giả và Phạm vi sử dụng
*   **Đối tượng sử dụng**: Giáo viên, trường học quy mô vừa và nhỏ, trung tâm khảo thí độc lập.
*   **Số lượng người dùng đồng thời**: Dựa vào Quotas của Google Apps Script, hệ thống có thể đáp ứng mượt mà khoảng 500 - 1000 thí sinh làm bài đồng thời, nhờ vào cơ chế Caching và Batch Update khéo léo.
*   **Môi trường thử nghiệm**: Hoạt động hoàn hảo trên Chrome, Safari, Edge, Firefox, và tương thích cao với WebView trên iOS/Android.

---

<a name="chuong-2"></a>
## CHƯƠNG 2: KIẾN TRÚC HỆ THỐNG (SYSTEM ARCHITECTURE)

Dự án áp dụng mô hình **Serverless Architecture** hoàn toàn, tách biệt rõ ràng Frontend (Giao diện) và Backend (Logic & Dữ liệu).

### 2.1. Sơ đồ Hoạt động chung

```text
[ Người Dùng Cuối (Học sinh/Giáo viên) ]
        |
        v
+---------------------------------------------------------+
|                Frontend (Trình duyệt)                   |
|  - HTML5 Semantic, CSS Variables (Dark/Light mode)      |
|  - Vanilla JS, OOP classes (AuthManager, APIClient)     |
|  - SwiperJS (Vuốt câu hỏi), Chart.js (Biểu đồ điểm)     |
+---------------------------------------------------------+
        |
        | HTTP POST (JSON Payload + JWT Bearer Token)
        | Cors: Mở (No-Cors) hoặc WebApp Proxy
        v
+-------------------------------------------------------+
|                 Google Apps Script (V8 Engine)        |
| +---------------------------------------------------+ |
| | doPost Router -> Định tuyến (Switch/Case action)  | |
| +---------------------------------------------------+ |
| | Logic Layer:                                      | |
| |   - Grading.js: Máy chấm điểm độc lập             | |
| |   - Auth.js: Hashing, JWT Verify, Rate Limit      | |
| |   - Admin.js: Quản lý hàng loạt, tính thống kê    | |
| +---------------------------------------------------+ |
| | CacheService -> Lưu đệm In-Memory (Redis-like)    | |
| +---------------------------------------------------+ |
+-------------------------------------------------------+
        |                                     |
        | Google Sheets API (Nội bộ)          | UrlFetchApp API
        v                                     v
+--------------------------+          +-------------------+
|     Google Sheets        |          |  Telegram Bot API |
| (Database vật lý RDBMS)  |          | (Gửi báo cáo lỗi) |
+--------------------------+          +-------------------+
```

### 2.2. Chi tiết Frontend (Lớp Hiển thị)
Frontend bao gồm các tệp HTML độc lập, được tổ chức chuẩn xác theo từng chức năng, không theo kiến trúc SPA (Single Page Application) nặng nề mà là MPA (Multi-Page Application) tối giản:
*   `index.html`: Landing page giới thiệu, hoạt ảnh bắt mắt.
*   `login.html` & `register.html`: Cửa ngõ xác thực người dùng.
*   `dashboard.html`: Nơi thí sinh theo dõi tiến độ, xem biểu đồ điểm số và chọn bài kiểm tra.
*   `quiz.html`: Nơi diễn ra bài thi thực sự, nơi các script Anti-Cheat hoạt động mạnh nhất và vô hiệu hóa các tương tác dư thừa.
*   `admin.html`: Bảng điều khiển quản trị viên, nơi xử lý khối lượng dữ liệu khổng lồ bằng DataTables.

**Triết lý thiết kế Frontend:**
*   Sử dụng biến CSS (CSS Variables) để thiết lập Theme (Sáng/Tối) tức thời mà không cần load lại trang.
*   Giao diện ứng dụng *Glassmorphism* (kính mờ), đổ bóng sâu (Drop shadow) tạo cảm giác hiện đại, nổi khối 3D.
*   Tách bạch mã nguồn: Thư mục `assets/pages/` chứa script riêng cho từng trang, trong khi `assets/script.js` chứa Core Logic dùng chung. Điều này giúp giảm thiểu kích thước bundle khi trình duyệt tải xuống.

### 2.3. Chi tiết Backend (Lớp Xử lý Logic)
Được triển khai dưới dạng **Google Apps Script (GAS) Web App**.
Mã nguồn Backend nằm trong thư mục `gs/`, được module hóa thành nhiều file để dễ bảo trì, thay vì viết tất cả vào một file `Code.gs` khổng lồ truyền thống.

#### Cấu trúc thư mục `gs/`:
*   `doPost.js`: Bộ định tuyến trung tâm.
*   `Auth.js`: Xác thực JWT, Mã hóa Password, Đăng nhập, Đăng ký.
*   `Admin.js`: Đọc/ghi diện rộng, cập nhật cài đặt hàng loạt.
*   `Quiz.js`: Kéo danh sách môn học, nạp cấu trúc bài thi.
*   `Grading.js`: Lõi chấm điểm, sinh báo cáo Review Items.
*   `Report.js`: Xử lý báo cáo câu hỏi lỗi từ User lên Telegram.
*   `Cache.js`: Các hàm helper đóng gói API CacheService của Google.
*   `Config.js`: Nơi cấu hình các chuỗi, ID cố định, hoặc hàm fetch SheetsRef.
*   `Utils.js`: Hàm phụ trợ (Normalize chuỗi, Date format, Dò tìm Header, Rate Limiter).

---

<a name="chuong-3"></a>
## CHƯƠNG 3: CƠ SỞ DỮ LIỆU & CẤU TRÚC SCHEMA (DATABASE SCHEMA)

Google Sheets được sử dụng làm Database chính. Mặc dù là một bảng tính phẳng (Flat File), backend của TsByin Exam xử lý nó với tư duy của một RDBMS (Hệ quản trị CSDL Quan hệ) hoàn chỉnh với Khóa Chính (Primary Key) và Khóa Ngoại (Foreign Key).

### 3.1. Dynamic Header Resolution (Dò tìm cột động)
**Vấn đề:** Trong thực tế vận hành, giáo viên rất dễ vô tình chèn thêm cột, xóa cột, hoặc đổi chỗ cột "Tên Đăng Nhập" và "Mật Khẩu". Nếu hệ thống dùng Index tĩnh (VD: `row[0]`, `row[1]`), toàn bộ dữ liệu sẽ ghi nhầm cột, dẫn tới Database bị hỏng hoàn toàn.
**Giải pháp:** Dự án triển khai cơ chế "Dò tìm Header thông minh" (Dynamic Schema Mapping).

Tại `gs/Utils.js`, hàm `getUsersSchema_(sheet)` sẽ:
1. Đọc toàn bộ Hàng số 1 (Header Row) của trang tính đó.
2. Với mỗi ô, gọi hàm normalize: Xóa khoảng trắng, xóa dấu tiếng Việt, viết thường (Vd: "Tên đăng nhập" -> `tendangnhap`).
3. Khớp chuỗi đã chuẩn hóa với từ điển từ khóa (Keywords Dictionary).
   Ví dụ thuật toán Map:
   ```javascript
   const keywordMap = {
     username: ['username', 'tendangnhap', 'taikhoan', 'user'],
     passwordHash: ['password', 'matkhau', 'matkhauhash', 'pass'],
     role: ['role', 'quyen', 'phanquyen']
   };
   ```
4. Nếu khớp, ghi nhận Index (Tọa độ cột) của cột đó vào Object Schema.
5. Khi truy xuất dữ liệu: Thay vì lấy `row[0]`, hệ thống lấy `row[schema.username]`.
Nhờ vậy, Database hoàn toàn miễn nhiễm với lỗi thay đổi thứ tự cột vật lý của con người.

### 3.2. Lược đồ Dữ liệu (Bảng tính chi tiết)

**1. Bảng `Users` (Quản lý Tài Khoản)**
*Hệ thống dùng hàm `getUsersSchema_` dò tìm header qua các từ khóa dự phòng sau (nếu không tìm thấy sẽ dùng fallback cột mặc định):*
*   **`Username`** (Cột mặc định: A): Khóa chính (PK). Từ khóa nhận diện: `['username', 'user', 'taikhoan', 'tendangnhap']`. Được kiểm tra trùng lặp (Unique constraint) qua LockService trước khi thêm.
*   **`Password_Hash`** (Cột mặc định: B): Mật khẩu băm 2 lớp. Từ khóa nhận diện: `['passwordhash', 'password', 'matkhau', 'pass']`.
*   **`Role`** (Cột mặc định: C): Enum `User` (Học sinh) hoặc `Admin` (Giáo viên). Từ khóa nhận diện: `['role', 'quyen', 'phanquyen', 'vaitro']`.
*   **`FullName`** (Cột mặc định: D): Tên hiển thị. Từ khóa nhận diện: `['fullname', 'hoten', 'name']`.
*   **`AdminPinHash`** (Cột mặc định: E): Mã PIN 6 số dành riêng cho Admin (SHA-256). Từ khóa nhận diện: `['adminpinhash', 'adminpin']`.
*   **`CreatedAt`** (Cột mặc định: F): Thời gian khởi tạo tài khoản. Từ khóa nhận diện: `['createdat', 'createdtime', 'ngaytao']`.
*   **`Email`** (Không có cột mặc định): Thông tin khôi phục. Từ khóa nhận diện: `['email', 'thudientu', 'mail']`.

**2. Bảng `ReferralCodes` (Quản lý Mã Giới Thiệu/Mã Kích Hoạt)**
*Hệ thống dùng hàm `getReferralCodesSchema_` dò tìm header:*
*   **`Code`** (Cột mặc định: A): Khóa chính (PK). Chuỗi ngẫu nhiên 8 ký tự. Từ khóa: `['code', 'magioithieu', 'referralcode']`.
*   **`Status`** (Cột mặc định: B): Enum `Active` (Chưa sử dụng) hoặc `Used` (Đã sử dụng). Từ khóa: `['status', 'trangthai']`.
*   **`UsedBy`** (Cột mặc định: C): Khóa ngoại (FK) trỏ tới `Users.Username`. Từ khóa: `['usedby', 'useby', 'nguoidung']`.
*   **`UsedAt`** (Cột mặc định: D): Thời điểm mã bị tiêu thụ. Từ khóa: `['usedat', 'thoigiandung', 'ngaydung']`.

**3. Bảng `Quiz_List` (Danh mục Bài Thi / Master Data)**
*Hệ thống dùng hàm `getQuizListSchema_` dò tìm header:*
*   **`QuizID`** (Cột mặc định: A): Khóa chính (PK). Định danh bài thi. Từ khóa: `['quizid']`.
*   **`Subject`** (Cột mặc định: B): Phân loại nhóm môn học (VD: Toán, Lý). Từ khóa: `['subject', 'monhoc']`.
*   **`Title`** (Cột mặc định: C): Tên hiển thị bài thi. Từ khóa: `['title', 'tenquiz']`.
*   **`Description`** (Cột mặc định: D): Lời nhắc nhở. Từ khóa: `['description', 'mota']`.
*   **`TimeLimit`** (Cột mặc định: E): Thời gian thi (phút). Từ khóa: `['timelimit', 'thoigian']`.
*   **`Status`** (Cột mặc định: F): Đóng/Mở. Từ khóa: `['status', 'trangthai']`.
*   **`Show_Answer`** (Cột mặc định: G): Chế độ luyện tập. Từ khóa: `['showanswer', 'hienthidapan']`.
*   **`Shuffle`** (Cột mặc định: H): Đảo câu hỏi/đáp án. Từ khóa: `['shuffle', 'daocau']`.
*   **`AntiCheat`** (Cột mặc định: I): Chống gian lận tổng hợp (phiên bản cũ). Từ khóa: `['anticheat', 'chonggianlan']`.
*   **`AutoNext`** (Cột mặc định: J): Chuyển câu tự động. Từ khóa: `['autonext', 'tudongchuyencau']`.
*   **`AllowBack`** (Cột mặc định: K): Cho phép quay lại. Từ khóa: `['allowback', 'chophepquaylai']`.
*   **`AntiCheatTabSwitch`**: Chống đổi Tab. Từ khóa: `['anticheattabswitch', 'tabswitch']`.
*   **`AntiCheatFullscreen`**: Chống thoát Fullscreen. Từ khóa: `['anticheatfullscreen', 'fullscreen']`.
*   **`AntiCheatDevTools`**: Chống mở F12/Inspect. Từ khóa: `['anticheatdevtools', 'devtools', 'chongf12']`.
*   **`RevealCorrectOnWrong`**: Lộ đáp án đúng khi làm sai. Từ khóa: `['revealcorrectonwrong', 'showcorrectonsai', 'lodapandungkhisai']`.
*   **`ShowDetailedResult`**: Hiển thị bảng kết quả chi tiết cuối giờ. Từ khóa: `['showdetailedresult', 'chitietketqua', 'hienthichitietketqua']`.

**4. Bảng `Questions` (Ngân hàng Câu Hỏi)**
*Lược đồ này thường được map tĩnh (Static Indexing) trong Backend để đảm bảo tốc độ cao nhất khi query:*
*   **`QuestionID`** (Cột A - PK): Sinh tự động (Vd: `Q_123456789`).
*   **`QuizID`** (Cột B - FK): Khóa ngoại trỏ về `Quiz_List.QuizID`.
*   **`QuestionText`** (Cột C): Cấu trúc câu hỏi dạng chuỗi thô (có hỗ trợ thẻ xuống dòng `\n`).
*   **`OptionA`, `OptionB`, `OptionC`, `OptionD`** (Cột D, E, F, G): Văn bản tương ứng với 4 đáp án.
*   **`CorrectAnswer`** (Cột H): Chứa đáp án đúng, chỉ nhận giá trị ký tự 'A', 'B', 'C', hoặc 'D'.
*   **`Explanation`** (Cột I): Lời giải hoặc chú thích hiện ra sau khi nộp bài (có thể để trống).

**5. Bảng `Attempt_Logs` (Lịch sử Nộp Bài & Log Vi Phạm)**
*Lược đồ này cũng được map tĩnh theo thứ tự:*
*   **`LogID`** (Cột A - PK): Chuỗi chống trùng dạng `username-quizID-timestamp`.
*   **`Username`** (Cột B - FK): Thí sinh đã làm bài.
*   **`QuizID`** (Cột C - FK): Mã đề thi tương ứng.
*   **`Score`** (Cột D): Điểm số hệ 10. Đặc biệt: Nếu bị hệ thống bắt quả tang cheat quá mức quy định, cột này sẽ in cứng dòng chữ `"CHEAT"`.
*   **`User_Answers`** (Cột E): Chuỗi JSON map ghi lại hành vi tick chọn trong quá trình làm (VD: `{"Q_123":"A","Q_456":"C"}`).
*   **`Timestamp`** (Cột F): Chuỗi thời gian Datetime ISO 8601 lúc nộp bài.

**6. Bảng `Report_Logs` (Nhật ký Báo Lỗi từ User)**
*Bảng này dùng cho tính năng khiếu nại câu hỏi, cấu trúc đơn giản:*
*   **`Username`** (Cột A).
*   **`QuizID`** (Cột B).
*   **`QuestionID`** (Cột C).
*   **`ErrorType`** (Cột D): Phân loại lỗi (Ví dụ: "Sai đáp án", "Lỗi hiển thị").
*   **`Details`** (Cột E): Văn bản mô tả lỗi chi tiết do học sinh gõ trên trình duyệt.
*   **`Timestamp`** (Cột F).

---

<a name="chuong-4"></a>
## CHƯƠNG 4: GIAO TIẾP CLIENT-SERVER & API ENDPOINTS

Kiến trúc API của TsByin Exam không tuân theo chuẩn RESTful (GET, PUT, DELETE, POST riêng biệt) mà sử dụng **RPC (Remote Procedure Call) qua 1 Endpoint duy nhất** (do giới hạn Web App của Google Apps Script). Toàn bộ dữ liệu được gói gọn trong một payload JSON với phương thức `POST`.

### 4.1. Chuẩn Hóa Payload
Frontend gửi đi một khối JSON thống nhất qua hàm `APIClient.request(action, data)`.
Ví dụ Payload:
```json
{
  "action": "submitScore",
  "token": "eyJhbGciOiJIUzI1Ni...",
  "username": "hocsinh1",
  "quizID": "TOAN_01",
  "userAnswers": "{\"Q_123\": \"A\", \"Q_456\": \"D\"}",
  "violationLogs": "[{\"type\": \"tab_switch\", \"time\": 123456789}]"
}
```

### 4.2. Chuẩn Hóa Response
Server trả về kết quả tuân thủ nghiêm ngặt theo format thống nhất thông qua hàm `JsonResponse()` ở Backend:
```json
{
  "success": true,
  "message": "Nộp bài thành công!",
  "score": 8.5,
  "correct": 17,
  "total": 20,
  "reviewItems": [...]
}
```
*   Biến `success` luôn là Boolean để Frontend dễ `if(res.success)`.

### 4.3. Bộ Định Tuyến `doPost(e)`
File `gs/doPost.js` là trái tim của hệ thống mạng. Nó nhận sự kiện POST từ Google, dùng `JSON.parse(e.postData.contents)`, lấy trường `action`, và gọi lệnh `switch`.

**Danh sách đầy đủ 30+ Action:**

**1. Authentication:**
*   `login`: Gửi mật khẩu (đã hash sha256). Nhận lại token JWT.
*   `registerUser`: Yêu cầu kèm ReferralCode. Thêm Row vào Sheets `Users`.
*   `getAccountInfo`: Trả về dữ liệu profile.
*   `changePassword`: Yêu cầu Old Password và New Password. Vô hiệu hóa JWT cũ lập tức.
*   `requestPasswordReset`, `confirmPasswordReset`: Luồng khôi phục quên mật khẩu.

**2. Dashboard & Navigation:**
*   `getDashboardInit`: Khởi tạo dữ liệu màn hình chính (load danh mục môn học, lấy số liệu thống kê điểm số người dùng). Đây là API nặng nhất, rất phụ thuộc vào `CacheService`.
*   `getSubjects`, `getQuizzesBySubject`: Truy vấn danh mục để hiển thị cây thư mục.

**3. Quiz Execution (Thi cử):**
*   `getQuizData`: Nhận danh sách câu hỏi. **Bảo mật**: Server `delete question.CorrectAnswer;` trước khi gửi xuống mạng.
*   `verifyAnswer` & `resolveCorrectOption`: API gọi đơn lẻ dành cho bài thi ở chế độ Show_Answer (Luyện tập).
*   `submitScore`: Action tối quan trọng. Nhận toàn bộ bài làm, chạy hàm Grading, lưu log, và trả về điểm.
*   `reportQuestionError`: Ghi lỗi lên Sheets `Report_Logs` và bắn Notification Telegram.

**4. Admin Panel:**
*   `verifyAdminPin`: Đăng nhập cấp độ MFA. Lấy `adminPinProof`.
*   `getAdminData`: Lấy bộ dữ liệu tổng quan cho trang Dashboard Admin (DB Health, Thống kê, Báo cáo lỗi).
*   `batchUpdateQuizSettings`: Nhận một mảng Object chứa các thay đổi thuộc tính Quiz. Kích hoạt LockService, đọc toàn bộ Sheet `Quiz_List` 1 lần, tìm kiếm các ID tương ứng, sửa trên mảng 2 chiều (2D Array) và `setValues()` ghi lại 1 lần duy nhất vào Sheets. Điều này giảm số lần gọi API Sheets từ 100 lần xuống còn 1 lần, cứu hệ thống khỏi cảnh sập nguồn vì Quota Limit.
*   `bulkUpload`: Đẩy hàng trăm câu hỏi Aiken vào Database.
*   `generateReferralCodes`: Tạo mã kích hoạt và append vào Sheets.
*   `updateQuizStatus`, `updateShowAnswer`, `updateShuffle`...: Các API lẻ để toggle Switch nhanh trên bảng Admin.

---

<a name="chuong-5"></a>
## CHƯƠNG 5: BẢO MẬT HỆ THỐNG & XÁC THỰC (SECURITY & AUTH)

Chương này giải mã câu hỏi: "Tại sao một hệ thống chạy trên Google Sheets lại có thể an toàn trước các cuộc tấn công thay đổi dữ liệu?".

### 5.1. Password Hashing Nhiều Lớp (Multi-Layer Hashing)
Hệ thống TsByin Exam KHÔNG BAO GIỜ truyền tải mật khẩu ở dạng văn bản thô (Plaintext). Mọi luồng đăng nhập đều áp dụng mã hóa 2 chiều một phía (One-way encryption).
1. **Tầng Client (Trình duyệt)**: Khi người dùng gõ mật khẩu "123456", Javascript gọi hàm Native `crypto.subtle.digest('SHA-256', data)`. Payload gửi qua mạng POST HTTP là một chuỗi băm Hex 64 ký tự. Điều này loại bỏ hoàn toàn nguy cơ bị Sniffing mạng.
2. **Tầng Server (Apps Script)**: Khi nhận chuỗi băm từ Client, Server không lưu ngay lập tức. Server sẽ lấy chuỗi đó nối thêm với một chuỗi `SALT` cố định bí mật (lưu trong Google Script Properties, không nằm trong code). Sau đó, Server thực hiện SHA-256 lần thứ hai: `Hash(Hash_Client + SALT)`.
**Kết quả**: Chuỗi cuối cùng được lưu vào Google Sheets an toàn tuyệt đối. Kể cả Hacker xâm nhập được tài khoản Google, lấy trộm file Sheets, họ cũng không có cách nào dịch ngược ra Password của người dùng, vì họ không biết `SALT` giấu trong thiết lập môi trường.

### 5.2. JSON Web Token (JWT) Không Trạng Thái & Revocation
Để hệ thống Serverless không cần dùng Session/Cookie rườm rà, JWT là lựa chọn hoàn hảo.
*   Đăng nhập thành công, Server tạo ra Token JWT.
*   `Signature`: Ký điện tử bằng `HMAC-SHA256` với khóa `QUIZ_JWT_SECRET_CURRENT`.
*   `Payload`: Chứa `{ username, role, timestamp, sessionId }`.

**Xóa Session Tức thời (Immediate Revocation)**: 
Nhược điểm lớn của JWT là một khi đã cấp phát, nó có giá trị sử dụng cho đến khi hết hạn (Vd: 24h), kể cả khi tài khoản đó bị Admin cấm.
TsByin Exam khắc phục điều này bằng cách:
*   Mỗi lần đăng nhập, sinh một UUID ngẫu nhiên tên là `sessionId`.
*   Lưu `sessionId` đó vào bộ nhớ đệm tốc độ cao của Server (`CacheService` với key là `session_nguyenvana`).
*   Nhúng `sessionId` đó vào trong cấu trúc JWT.
*   Tại mọi Request tiếp theo, Server giải mã JWT, lấy `sessionId` bên trong và đem đối chiếu với `sessionId` đang tồn tại trong CacheService.
*   **Kết quả:** Khi User Đổi Mật Khẩu, Admin xóa tài khoản, hoặc User muốn Đăng xuất mọi thiết bị, Server chỉ cần gọi `Cache.remove('session_nguyenvana')`. Lập tức, JWT nằm trên máy tính của kẻ gian trở thành mẩu giấy vụn vô giá trị.

### 5.3. Secret Rotation (Xoay Vòng Khóa Không Gián Đoạn)
Tiêu chuẩn bảo mật ISO yêu cầu đổi Khóa bí mật ký JWT (`QUIZ_JWT_SECRET`) định kỳ.
Nhưng trên các hệ thống cũ, đổi Khóa đồng nghĩa với toàn bộ hệ thống bị sập (Downtime) trong thời gian ngắn, mọi người dùng đều bị văng ra trang Login.
**TsByin Exam hỗ trợ Zero-Downtime Rotation**:
*   Script Properties lưu 2 biến: `QUIZ_JWT_SECRET_CURRENT` (Khóa Chính) và `QUIZ_JWT_SECRET_PREVIOUS` (Khóa Cũ).
*   Trong quá trình Validate Token, Server giải mã bằng Khóa Chính. Nếu báo lỗi Signature Invalid, Server không vội từ chối, mà thử tiếp bằng Khóa Cũ.
*   Khi Admin muốn đổi khóa, họ đưa Khóa Chính xuống thành Khóa Cũ, và gắn Khóa Chính bằng một chuỗi mới. Học sinh đang làm bài thi (đang cầm JWT ký bằng khóa cũ) vẫn tiếp tục nộp bài thành công. Trong khi đó, người mới đăng nhập sẽ được cấp phát Token từ Khóa Chính mới. Quá trình bảo mật diễn ra vô hình với người dùng.

### 5.4. LockService & Rate Limiting (Chống Brute-Force)
*   **Rate Limiting**: `gs/Auth.js` có hàm `registerRateLimitFailure_`. Mỗi lần đăng nhập sai, nó cộng biến đếm trong `CacheService` lên 1. Nếu `attempts > 5`, Server trả về lỗi Blocked. Tài khoản bị đóng băng đăng nhập trong 15 phút. Ngăn chặn tuyệt đối Tool dò pass tự động.
*   **LockService (Chống Race Condition Database)**: Khi 2 request cùng gọi hàm `appendRow()` lên Google Sheets ở cùng 1 giây, dữ liệu bị vỡ cấu trúc. Lệnh `LockService.getScriptLock().tryLock(15000)` đảm bảo chỉ duy nhất 1 luồng xử lý được thao tác Write tại một thời điểm, các luồng khác tự động chuyển sang chế độ hàng đợi (Queue) chờ tối đa 15 giây.

---

<a name="chuong-6"></a>
## CHƯƠNG 6: HỆ THỐNG CHỐNG GIAN LẬN (ANTI-CHEAT ENGINE)

Nếu như Backend xử lý Logic tĩnh, thì Frontend `assets/anticheating.js` là một chiến trường thực sự giữa Hệ thống và Hacker. Script dài hàng trăm dòng này chia thành 4 lớp bảo vệ.

### 6.1. Tầng 1: Ngăn Chặn Giao Diện Cơ Bản (Basic UI Block)
Bất kỳ học sinh nào cố gắng chép đề hoặc xem mã nguồn đều bị chặn ngay từ cổng.
*   Lắng nghe sự kiện `keydown` ở **Capture Phase**.
*   Vô hiệu hóa: `F12`, `Ctrl+U`, `Ctrl+S`, `Ctrl+P`, `Ctrl+C`, `Ctrl+V`, `Ctrl+X`.
*   Vô hiệu hóa toàn bộ Menu Chuột Phải qua thuộc tính `oncontextmenu`.
*   Chống bôi đen (Highlight Text): Gắn thẻ `<style>` ép class `user-select: none !important;` lên toàn bộ giao diện bài thi. Mọi nỗ lực kéo chuột bôi đen câu hỏi đều thất bại.
*   **Cơ chế Anti-Screenshot**: Rất nhiều học sinh dùng phím `PrintScreen` hoặc công cụ Snipping Tool để chụp ảnh hỏi bạn bè. Hệ thống lắng nghe các tổ hợp phím này. Ngay khi bấm, màn hình ngay lập tức phủ thêm class CSS `.anti-cheat-blur` làm nội dung nhòe xám xịt trong 2000ms. Kết quả học sinh chỉ chụp được một màn hình bị nhòe không thể đọc được chữ.

### 6.2. Tầng 2 & 3: Giám Sát Cửa Sổ (Window Focus & Tab Switch)
Một hình thức gian lận phổ biến là chuyển tab Google Search hoặc mở tài liệu Word để tra đáp án.
*   **Page Visibility API**: Sử dụng `document.addEventListener('visibilitychange')`. Bất cứ khi nào trình duyệt không còn nằm ở Foreground (Thu nhỏ lại, bấm sang Tab khác), thuộc tính `document.hidden` trở thành `true`. Hệ thống bắt ngay lập tức 1 Violation Log.
*   **Fullscreen API**: Nếu bài thi thiết lập `antiCheatFullscreen = true`, hệ thống yêu cầu trình duyệt vào chế độ Toàn Màn Hình. Nếu học sinh bấm phím ESC để thoát ra hòng thao tác thanh Taskbar, sự kiện `fullscreenchange` kích hoạt và bắt lỗi ngay.

### 6.3. Tầng 4: Chống Kỹ Sư Dịch Ngược (Anti-Reverse Engineering)
Lớp này nhắm tới những học sinh chuyên IT mở DevTools (Bằng cách qua mặt Tầng 1).
*   **Lexical Scope Monkey-Patching Protection**: Một hacker có thể mở Console gõ: `window.sessionStorage.setItem = function() { // Hack passed }` để vô hiệu hóa việc lưu Log lỗi. Để chống lại, ngay từ dòng code đầu tiên, hệ thống đã lưu trữ hàm gốc vào một hằng số bí mật (Closure variables):
    ```javascript
    const originalPerformance = window.performance;
    const originalSessionSet = window.sessionStorage.setItem.bind(window.sessionStorage);
    ```
    Dù `window` có bị đè hàm khác, mã nguồn Anti-Cheat vẫn gọi thông qua `originalSessionSet` ẩn danh, vượt mặt kỹ thuật vá lỗi khỉ (Monkey Patching).
*   **Mutation Observer Tự Vệ**: Nếu Hacker cố gắng mở Tab Element, xóa cái thẻ `<style>` chặn bôi đen đi thì sao? Hệ thống cài đặt `MutationObserver` theo dõi biến động DOM. Nếu phát hiện thẻ ID `#antiCheatSelectionBlocker` bị xóa khởi DOM, hệ thống tự hiểu "Đang có kẻ chọc ngoáy giao diện", ép lệnh `window.location.reload()` để reset bài thi.
*   **DevTools Debugger Trap**: Hệ thống tạo một vòng lặp `setInterval(..., 1500)`. Bên trong chạy lệnh `debugger;`. Hàm dùng `performance.now()` đo thời gian trước và sau.
    Bình thường, bỏ qua lệnh này chỉ tốn `1ms`. Nhưng nếu DevTools ĐANG MỞ, trình duyệt bị "Pause on debugger", và thời gian chạy vòng lặp bị kéo dài. Nếu `Delta Time > 100ms`, hệ thống đánh giá F12 đang mở và ghi nhận 1 lỗi gian lận siêu hạng.

### 6.4. Trừng Phạt Kép & MD5 Dynamic Checksum
Trạng thái vi phạm được lưu trong `SessionStorage` (VD: `{ count: 2, logs: [...] }`).
Làm sao ngăn chặn Hacker vào Storage chỉnh `count` về `0`?
*   Hệ thống dùng Băm 32-bit (MD5 / CRC) tạo ra biến Checksum.
*   `Dynamic Salt = username_quizID_BME_PROTECT`. 
*   `Checksum = Hash(count + logs + DynamicSalt)`.
Mỗi lần tải lại trang (Bấm F5), mã nguồn load dữ liệu từ Storage, lấy `count` và `logs` băm lại lần nữa so với Checksum. Nếu ai đó sửa tay `count`, Checksum sẽ KHÔNG KHỚP (Data Tampering). Bài thi tự hủy với điểm 0.

**Trừng Phạt Kép Client-Server:**
Khi số lần vi phạm chạm mức tối đa (Ví dụ: 3 lần):
1. **Client**: Tự động chặn màn hình, gọi API khẩn cấp đưa mảng câu trả lời rỗng gửi lên Server, đính kèm `violationLogs`.
2. **Server**: Server nhận báo cáo vi phạm, tự động lưu số đếm vào `CacheService`. Tại sao phải lưu? Phòng trường hợp Client gửi đi gói tin "Tôi vi phạm 0 lần" (Packet Forging).
3. Khi Server tính điểm cuối cùng, nó chạy lệnh: `effectiveCheatCount = Math.max(serverCheatCount, clientCheatCount)`. Server luôn nắm đằng chuôi. Nếu `>= 3`, Server ép `Score = "CHEAT"` và gửi trả về 0 điểm không cho bào chữa.

---

<a name="chuong-7"></a>
## CHƯƠNG 7: CƠ CHẾ CACHING & TỐI ƯU HIỆU NĂNG

Mặc dù Google Sheets rất mạnh, nhưng tốc độ I/O cực chậm (trung bình 2 giây). Để xử lý 100 học sinh nộp bài cùng lúc, hệ thống TsByin Exam dựa hoàn toàn vào bộ nhớ đệm In-Memory.

### 7.1. Phân Loại Tần Suất Caching (Time to Live)
Sử dụng API `CacheService.getScriptCache()`, chia làm 4 loại bộ đệm chính:
1.  **Cache Master Data Bài Thi (`quiz_snapshot_v*`) - TTL: 300 giây (5 phút)**:
    Khi Học sinh A bấm vào bài thi Toán, Server gọi Sheets API mất 2.5 giây để đọc hàng trăm câu hỏi, parse thành JSON, và `cache.put()` lưu vào RAM của Google.
    Khi Học sinh B đến Z bấm vào sau đó, Server kéo thẳng từ RAM, độ trễ giảm xuống còn **0.05 giây**. Hiệu năng tăng gấp 50 lần.
2.  **Cache Dashboard Chuyên Biệt (`dashboard_init_v*_${username}`) - TTL: 90 giây**:
    Mỗi học sinh có điểm số khác nhau, tiến độ khác nhau. Việc truy vấn toàn bộ bảng `Attempt_Logs` mỗi lần về trang chủ cực kỳ lãng phí tài nguyên máy tính. Hệ thống lưu kết quả query vào Cache với TTL ngắn (90s). Đảm bảo mượt mà nhưng cập nhật khá nhanh chóng.
3.  **Cache Thống Kê Admin (`admin_data_cache`) - TTL: 300 giây**:
    Trang Admin cần tính toán tỷ lệ làm sai (Wrong Rate) của hàng ngàn Attempt_Logs để tìm ra "Câu hỏi khó". Quá trình tính toán For-loop 2 chiều tốn rất nhiều CPU. Bộ đệm này giúp giảm nhiệt cho Server.
4.  **Cache Phiên Đăng Nhập (`session_${username}`) - TTL: 21600 giây (6 tiếng)**:
    Dùng cho Security Revocation. Lấy ID từ JWT so sánh siêu tốc.

### 7.2. Xóa Cache Thông Minh (Cache Invalidation)
Bài toán kinh điển trong khoa học máy tính: *Làm sao biết khi nào dữ liệu Cache đã cũ (Stale) và cần bỏ đi?*
TsByin giải quyết bằng Event-Driven Invalidation:
*   **Sự kiện "Nộp Bài Thành Công"**: Hành động ghi điểm mới vào Sheets hoàn thành -> Hàm `handleSubmitScore` kích hoạt -> Gọi lệnh `invalidateDashboardStatsCacheForUser_(username)`. Cache Dashboard của riêng cậu học sinh đó bị xóa ngay lập tức. Cậu ta bấm quay lại sảnh sẽ thấy ngay số điểm vừa nộp.
*   **Sự kiện "Cập nhật Cài đặt Admin"**: Giáo viên đổi môn Toán từ "Mở" sang "Khóa" -> Hàm `batchUpdateQuizSettings` kích hoạt -> Xóa sạch toàn bộ `admin_data_cache` và `quiz_snapshot_v*`. Điều này ép Server phải đọc lại Database trong request ngay tiếp theo, tránh tình trạng "Đã khóa mà học sinh vẫn thấy bài thi trên màn hình".

---

<a name="chuong-8"></a>
## CHƯƠNG 8: QUẢN LÝ BÀI THI & CHẤM ĐIỂM THỰC THI

Đây là luồng tương tác thực tế từ khi học sinh bắt đầu đến lúc nhận kết quả.

### 8.1. Luồng tải Đề thi An toàn (Safe Quiz Fetching)
1. Thí sinh nhấn "Bắt đầu làm bài" trên giao diện.
2. `APIClient.request('getQuizData', {quizID})` truyền tín hiệu lên Backend.
3. Server lấy cấu trúc đề từ `quiz_snapshot` (Từ Cache hoặc DB).
4. **Bảo mật tối thượng (Sanitization):** Máy chủ chủ động duyệt qua mảng đối tượng câu hỏi, dùng toán tử `delete question.CorrectAnswer;` và `delete question.Explanation;`. 
5. Phản hồi JSON gửi về mạng của trường học là một bảng câu hỏi hoàn toàn rỗng ruột (Blank answers). Kẻ gian dùng Wireshark, BurpSuite chặn bắt HTTP cũng vô phương.
6. **Xáo Trộn Cục Bộ (Fisher-Yates Shuffle)**: Nếu bảng Admin cài đặt `Shuffle = true`, Backend xáo trộn ngẫu nhiên vị trí phần tử trong mảng câu hỏi, đồng thời hoán vị giá trị của các option `A, B, C, D`.

### 8.2. Động cơ Chấm điểm Phía Server (Server-side Grading Engine)
Mọi cơ chế chấm điểm bằng Client Javascript đều mang rủi ro bị sửa đổi bộ nhớ (Cheat Engine). TsByin Exam thực thi 100% logic này ở Server.
Lõi thuật toán nằm ở `gs/Grading.js`:
1. Hết giờ hoặc Thí sinh bấm Nộp.
2. Client đóng gói map Object đáp án: `{"Q_123": "A", "Q_456": "D"}` thành String và gửi POST lên server.
3. Hàm Backend `handleSubmitScore()` load lại mảng Master Quiz (Bản gốc có chứa CorrectAnswer bảo mật).
4. Khởi tạo `correctCount = 0`, `totalQuestions = masterList.length`.
5. Vòng lặp đối chiếu: `if (userAnswer === masterQuestion.CorrectAnswer) correctCount++;`
6. Tính toán điểm quy chuẩn hệ 10: `computedScore = (correctCount / totalQuestions) * 10`. Điểm được làm tròn 2 chữ số thập phân.
7. Viết Log lên Sheets bao gồm thời gian nộp, Username, Score.
8. Trả về Frontend mảng cấu trúc `ReviewItems` (Lúc này mới gửi đầy đủ CorrectAnswer và Giải Thích) để giao diện Render màn hình "Review Kết Quả".

---

<a name="chuong-9"></a>
## CHƯƠNG 9: TRÌNH BIÊN DỊCH AIKEN (AIKEN PARSER)

Nhập từng câu hỏi lên Google Sheets bằng tay rất dễ sinh lỗi con người. Dự án tích hợp khả năng nhập liệu dạng thô (Raw text) theo chuẩn **Aiken Format**.

### 9.1. Định dạng Aiken là gì?
Aiken là chuẩn trắc nghiệm quốc tế đơn giản nhất, thân thiện với con người, thường áp dụng bởi Moodle và Canvas LMS.
```text
Trái Đất là hành tinh thứ mấy tính từ Hệ Mặt Trời?
A) Thứ hai
B) Thứ ba
C) Thứ tư
D) Thứ năm
ANSWER: B
EXP: Trái Đất nằm ở vị trí thứ 3 trong Hệ Mặt Trời.
```

### 9.2. Cơ chế Hoạt động của Trình Biên Dịch
Logic được xử lý bằng Client-Side CPU (Trình duyệt) qua class `AikenParser` trong `assets/script.js` để giảm tải tính toán cho Server.
*   **Lọc nhiễu**: Thay thế toàn bộ mã xuống dòng `\r\n` (chuẩn Windows) thành `\n` (chuẩn Unix) và `trim()`.
*   **Tách khối câu hỏi**: Dùng Regular Expression `/\n\s*\n+/` để tìm các cụm dòng trắng kép phân tách giữa các câu hỏi với nhau.
*   **Phân tích ngữ pháp (Syntax Parsing)**:
    *   Đọc theo từng dòng.
    *   Dùng biểu thức Regex `/^([A-D])[\.)]\s*(.*)$/i` để bắt các cụm phương án. Nếu thấy dòng bắt đầu bằng `A.` hoặc `A)`, nó tự tách thành một Option Buffer riêng.
    *   Khớp từ khóa `/^ANSWER\s*:\s*([A-D])/i` để lưu vị trí đáp án chuẩn xác.
*   **Xử lý văn bản nhiều dòng (Multi-line Paragraphs)**: Nhiều câu hỏi ngữ văn dài hơn 1 dòng. Cơ chế Buffer thông minh sẽ lưu và gộp toàn bộ các dòng không khớp với Option hay Answer vào trường `questionText`. Không bị lỗi mất chữ.
*   Cuối cùng, chuyển 100 câu hỏi văn bản thành một Mảng JSON, gửi qua API `bulkUpload`. Server sẽ thực hiện thao tác Append hàng loạt (Batch append) vào cuối Sheet `Questions`, hoàn tất trong chưa đầy 3 giây cho 100 câu.

---

<a name="chuong-10"></a>
## CHƯƠNG 10: TÍCH HỢP DỊCH VỤ MỞ RỘNG (TELEGRAM BOT)

Hệ thống có tính năng "Báo Lỗi Câu Hỏi" (Flag Error) đặt ở góc mỗi câu trắc nghiệm. Khi học sinh thấy câu này "Sai chính tả", "Không có đáp án đúng", hoặc "Hình bị vỡ", họ có quyền khiếu nại ngay trong lúc làm.

### 10.1. Telegram Notification Flow
Để Admin/Giáo viên nắm bắt sự cố ngay lập tức mà không cần mở máy tính, dự án có tích hợp Push Notification qua Telegram.
*   Client gửi lỗi qua API `reportQuestionError`.
*   Server tiếp nhận, ghi 1 Row vào bảng DB `Report_Logs` để lưu trữ vĩnh viễn kiểm toán.
*   Chuyển quyền điều khiển sang file module phụ trợ `gs/Report.js`.
*   Module này gọi hàm `PropertiesService.getScriptProperties().getProperty('TELEGRAM_API_TOKEN')`.
*   Nếu có Token, sử dụng `UrlFetchApp.fetch()` gửi 1 yêu cầu HTTP POST tới mây của ứng dụng Telegram: `https://api.telegram.org/bot<TOKEN>/sendMessage`.
*   **Định dạng Tin Nhắn Telegram (HTML Parsing Mode)**: 
    ```text
    🚨 <b>[TsByin Exam] BÁO LỖI CÂU HỎI</b>
    Môn thi: Lịch Sử Lớp 12
    Người dùng: truongvanb
    Phân loại: Sai Đáp Án
    Chi tiết: Câu hỏi ghi Quang Trung lên ngôi năm nào, nhưng đáp án không có 1788.
    ```
*   Nhờ cơ chế này, hệ thống giao tiếp theo thời gian thực (Real-time Feedback) với giáo viên vô cùng hiệu quả.

---

<a name="chuong-11"></a>
## CHƯƠNG 11: QUY TRÌNH TRIỂN KHAI & VẬN HÀNH (DEPLOYMENT)

Phần này đặc tả chi tiết cách tạo ra toàn bộ hệ thống cho người lần đầu cài đặt.

### 11.1. Các Bước Thiết lập Hạ tầng Google Cloud
1. **Khởi tạo Database Vật Lý**: Truy cập Google Drive cá nhân. Nhấp tạo một "Bảng tính Google" (Google Sheets) mới tinh.
2. **Setup Schema**: Mở bảng tính ra, thêm chính xác 6 trang tính (Tabs) ở góc dưới cùng màn hình với đúng cái tên: `Users`, `ReferralCodes`, `Quiz_List`, `Questions`, `Attempt_Logs`, `Report_Logs`. Điền các Tên Cột vào Hàng số 1 của từng Sheet dựa theo thiết kế Schema ở Chương 3.
3. **Môi trường Serverless (Backend)**: Bấm chọn menu `Tiện ích mở rộng` -> `Apps Script`. 
    Trình soạn thảo mã mở ra. Hãy tạo các file đuôi `.gs` (hoặc `.js` trong source code) lần lượt tương ứng với thư mục `/gs` của dự án, rồi Copy/Paste toàn bộ mã nguồn vào.
    Hoặc cách chuyên nghiệp: Sử dụng công cụ `clasp` của Google qua NodeJS. Chạy lệnh `clasp push` tại màn hình dòng lệnh máy tính cá nhân để tự động đồng bộ code lên Cloud.
4. **Phát hành API (Deploy)**: 
    *   Bấm nút *Triển khai (Deploy)* > *Tùy chọn triển khai mới*. 
    *   Kiểu loại: *Ứng dụng web (Web App)*.
    *   Thực thi dưới quyền: **Tôi (Me)** (Cực kỳ quan trọng để hệ thống có quyền đọc G-Sheets nội bộ).
    *   Ai có quyền truy cập: **Bất kỳ ai (Anyone)**.
    *   Triển khai và Sao chép đường dẫn (URL) dạng `https://script.google.com/macros/s/.../exec`.
5. **Cấu hình Secret Vault**: Ở giao diện Apps Script, bấm Cài đặt hình bánh răng (Project Settings). Cuộn xuống Script Properties, thêm 2 hằng số bí mật sau:
    *   `SALT`: Điền một dãy ký tự ngẫu nhiên kỳ lạ bất kỳ để bảo vệ băm mật khẩu.
    *   `QUIZ_JWT_SECRET_CURRENT`: Mật khẩu cực mạnh (256-bit) để ký JSON Web Token.

### 11.2. Đóng Gói và Phát Hành Frontend
Frontend là tổ hợp HTML, JS, CSS, chạy trực tiếp trên thiết bị của học sinh.
1. Mở file `assets/script.js` trên máy tính cục bộ. Tìm cấu trúc tĩnh `APIClient.GAS_URL` và dán cái URL Web App vừa lấy ở bước trên vào.
2. Dự án Frontend yêu cầu có `Node.js` để Build Code. Tại Terminal mở ở thư mục nguồn, gõ: `npm install`.
3. Khởi chạy bộ đóng gói: `npm run build:quiz`.
4. Trình biên dịch (Esbuild/Webpack) sẽ đi rà soát và hợp nhất các file. Nó thực hiện Minify (nén nhỏ code) toàn bộ thư viện JS, gỡ bỏ các hàm kiểm tra `console.log()` rườm rà. Đặc biệt, nó chạy trình Obfuscate làm rối loạn ngữ nghĩa file `anticheating.js` để hacker rất vất vả khi cố dịch ngược lại logic.
5. Code sau khi biên dịch xuất hiện trong thư mục `dist/`.
6. Tải toàn bộ nội dung trong `dist/` đó đưa lên dịch vụ Hosting tĩnh miễn phí như GitHub Pages, Netlify, hoặc Vercel. Hoặc ném vào Share Hosting Apache truyền thống cũng chạy ngon lành.

---

<a name="chuong-12"></a>
## CHƯƠNG 12: PHÂN TÍCH UI/UX & GIAO DIỆN NGƯỜI DÙNG

Tính năng kỹ thuật dù tốt đến đâu cũng trở nên vô nghĩa nếu học sinh không biết cách bấm. TsByin Exam tập trung xây dựng trải nghiệm người dùng hiện đại, tối giản.

### 12.1. Glassmorphism Design
Giao diện ứng dụng không sử dụng màu sắc đồng nhất nhàm chán (Flat design), mà áp dụng ngôn ngữ "Glassmorphism" (Kính mờ) đang thịnh hành.
*   Các Box chứa câu hỏi hay Dashboard đều có CSS `backdrop-filter: blur(16px);`.
*   Kết hợp viền trong suốt `border: 1px solid rgba(255,255,255, 0.1)`.
*   Tạo cảm giác thẻ nổi (Floating Cards) lơ lửng trên một hình nền Gradient động chuyển màu mịn màng phía dưới.

### 12.2. CSS Variables và Theming Tự Động
Khả năng chuyển đổi "Chế độ Sáng/Tối" (Light/Dark Mode) mượt mà mà không giật trang.
*   Toàn bộ mã màu (Color hex) được khai báo trên `:root` trong `style.css` dưới dạng biến `--bg-color`, `--text-main`, `--accent-color`.
*   Khi người dùng bấm nút Icon Mặt Trời/Mặt Trăng ở góc, JS chỉ việc Toggle (bật/tắt) thẻ class `light-theme` lên thẻ `<body>`. Trình duyệt sẽ tái cấu trúc DOM ngay trong chớp mắt và sơn lại toàn bộ màu cho UI mà không cần tải thêm bất kỳ file CSS nào khác.
*   Giao diện sẽ tự nhớ (LocalStorage) trạng thái Light/Dark mode của User vào lần đăng nhập kế tiếp.

### 12.3. SwiperJS cho Trải Nghiệm Cảm Ứng Di Động
Màn hình thi `quiz.html` không hiện một danh sách dọc kéo dài 100 câu hỏi (Gây mỏi tay scroll và dễ nhầm lẫn). Hệ thống nhúng thư viện `SwiperJS`.
*   Mỗi câu hỏi được đưa vào 1 Slide riêng biệt.
*   Học sinh chỉ tập trung xử lý một câu tại một thời điểm trên màn hình thiết bị di động. Vuốt sang trái/phải để chuyển câu (Swipe gestures).
*   Thanh điều hướng số lượng câu ở cạnh bên (Pagination Matrix) giúp click nhảy nhanh tới câu mong muốn.

---

<a name="chuong-13"></a>
## CHƯƠNG 13: XỬ LÝ LỖI & KHẮC PHỤC SỰ CỐ (TROUBLESHOOTING)

Mọi hệ thống đều sẽ có lỗi trong quá trình vận hành, dưới đây là bộ tài liệu hỗ trợ chẩn đoán (Diagnostic).

### 13.1. Các Lỗi Phổ Biến

| Mã lỗi / Hiện tượng | Nguyên nhân gốc rễ (Root Cause) | Giải pháp xử lý |
| :--- | :--- | :--- |
| `TypeError: Cannot read property...` khi đăng nhập | Header của Google Sheets bị sửa, bị thay thế bằng tiếng Anh hoặc thêm ký tự đặc biệt khiến hàm `getUsersSchema_` dò tìm sai Index. | Trả lại Header theo đúng chuẩn. Xóa cách ký hiệu kỳ dị khỏi Hàng số 1. |
| Học sinh đăng nhập thấy xoay vòng (Loading) mãi không vào | Request bị kẹt bởi LockService do hệ thống đang bận ghi dữ liệu, Timeout sau 15 giây. | Yêu cầu học sinh đợi vài phút rồi bấm F5. Tình trạng này rất hiếm trừ khi có >100 user bấm nút ở cùng 1 phần nghìn giây. |
| Màn hình hiển thị "Invalid Token" | Token JWT hết hạn, session bị hủy, hoặc Admin vừa thực hiện Rotate Secret (đổi key) và khóa cũ đã bị đẩy lùi quá 2 phiên bản. | Đăng xuất và đăng nhập lại bằng mật khẩu để xin cấp phát Session mới. |
| Admin bấm "Lưu Thay Đổi Hàng Loạt" thất bại | Payload mảng thay đổi (Changes) rỗng, hoặc có chứa khóa câu hỏi không tồn tại. | F5 làm mới lại trang Admin để Cache load lại danh sách ID Câu hỏi mới nhất từ DB. |
| Form đăng ký báo lỗi "Mã giới thiệu không đúng" | Mã đã bị chuyển sang trạng thái `Used`, hoặc hết hạn, hoặc nhập sai chữ O thành chữ số 0. | Cấp lại mã ngẫu nhiên qua trang Admin. |
| Lỗi CROS (Cross-Origin Resource Sharing) Policy | URL của Google Apps Script bị khóa ở phía Server, Google từ chối gửi pre-flight OPTIONS request do thiết lập quyền. | Chắc chắn `Who has access` là `Anyone` khi triển khai Web App. |

---

<a name="chuong-14"></a>
## CHƯƠNG 14: ĐÁNH GIÁ & MỞ RỘNG TƯƠNG LAI

### 14.1. Đánh giá Khả năng Cạnh tranh
*   **Ưu điểm vượt trội**:
    *   Tối ưu chi phí bằng Zero (Miễn phí vĩnh viễn với tài khoản Google thông thường).
    *   Cấu trúc Backend phân rã (Modular Code) dễ hiểu, dễ sửa đổi, không lo lỗi Spaghetti Code.
    *   Chế độ phòng bị Anti-Cheat tinh ranh với Punishment Algorithm.
    *   Aiken Parser hỗ trợ công tác Import câu hỏi siêu tốc.
*   **Nhược điểm cơ hữu (Hệ thống Serverless)**:
    *   Tốc độ khởi động máy chủ chậm (Cold start của Google Apps Script có thể tốn 1.5s cho luồng request đầu tiên).
    *   Google Quota: Apps Script giới hạn `URL Fetch Calls: 20,000/day` và thời gian thực thi (Execution Time) `6 minutes/request`. Nếu tổ chức kỳ thi 10,000 học sinh cấp trường cùng thời điểm, hệ thống chắc chắn sẽ đình công.

### 14.2. Lộ trình phát triển (Roadmap Next Version)
Các bản nâng cấp tiếp theo (Version 5.x) có thể mở rộng:
1.  **Chế độ Khôi phục Offline (Auto-Save State)**: Lưu tiến độ làm bài thi (Map Option) tạm thời vào LocalStorage của trình duyệt cứ mỗi 10 giây. Trong trường hợp học sinh bị rớt mạng Internet cục bộ hoặc cúp điện, trình duyệt reload lại tự động nhặt dữ liệu cũ lên tiếp tục bài thi.
2.  **Hệ thống Multimedia**: Tích hợp hình ảnh và công thức Toán Học (MathJax/KaTeX). Ảnh sẽ được lưu trữ qua link Base64 hoặc dịch vụ CDN ngoài (như Imgur/Google Drive Public) rồi chèn vào trường Câu hỏi dạng thẻ HTML.
3.  **Xuất báo cáo PDF/Excel**: Xây dựng nút `Export` cho trang Admin, tổng hợp dữ liệu bảng JSON thành định dạng CSV tải trực tiếp về máy cục bộ, phục vụ lưu trữ văn bản sổ điểm theo chuẩn của Bộ Giáo Dục.
4.  **Tích hợp SSO (Single Sign-On)**: Đăng nhập trực tiếp bằng Google ID (OAuth 2.0) để bỏ qua bước Register thủ công, phù hợp áp dụng bằng email nội bộ @edu.vn của nhà trường.

*(Kết thúc tài liệu phân tích tổng quan hệ thống phần mềm TsByin Exam. Tài sản trí tuệ và cấu trúc mã nguồn thuộc bản quyền bảo hộ bởi đội ngũ thiết kế.)*
