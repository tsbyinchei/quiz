<div align="center">
  <h1>✨ TsByin Exam ✨</h1>
  <p><strong>Hệ thống thi trắc nghiệm trực tuyến linh hoạt, bảo mật & mạnh mẽ</strong></p>

  <p>
    <a href="#"><img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript" /></a>
    <a href="#"><img src="https://img.shields.io/badge/Google_Apps_Script-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Google Apps Script" /></a>
    <a href="#"><img src="https://img.shields.io/badge/Google_Sheets-34A853?style=for-the-badge&logo=google-sheets&logoColor=white" alt="Google Sheets" /></a>
  </p>
</div>

---

## 📖 Giới thiệu

**TsByin Exam** là một hệ thống thi trắc nghiệm trực tuyến toàn diện, bao gồm đầy đủ luồng nghiệp vụ dành cho Người dùng (Thí sinh) và Quản trị viên (Admin). 

Dự án được xây dựng với kiến trúc **Serverless** sử dụng Google Apps Script làm Backend và Google Sheets làm Database, mang lại khả năng triển khai miễn phí, dễ bảo trì và mở rộng. Giao diện frontend thuần (Vanilla JS) được tối ưu hóa siêu nhẹ, tích hợp chế độ bảo mật Anti-Cheat khắt khe.

---

## 🌟 Tính năng Đột phá

### 1. 🎓 Trải nghiệm Người dùng (User)
- **Đăng nhập & Đăng ký linh hoạt**: Hỗ trợ đăng ký bằng mã giới thiệu. Đăng nhập bằng Password Hash (SHA-256) an toàn thông qua Username hoặc Email.
- **Quản lý Hồ sơ**: Tính năng nhắc nhở bổ sung Email bằng popup *Glassmorphism* hiện đại. Quản lý thông tin cá nhân trực tiếp.
- **Dashboard Thống kê**: Phân loại bài thi theo môn học, hiển thị chi tiết tiến độ, số câu hỏi, điểm số trung bình/cao nhất và lượt làm bài.
- **Làm bài thông minh**: Giao diện làm bài mượt mà với Swiper, đồng hồ đếm ngược, thanh tiến trình và chỉ báo trạng thái câu hỏi. Nộp bài chấm điểm trực tiếp tại backend và trả về review chi tiết (giải thích câu sai).
- **Báo lỗi tức thời**: Tính năng "Báo lỗi" câu hỏi ngay trong lúc thi, dữ liệu được lưu vào Google Sheets và thông báo trực tiếp qua Telegram Bot cho Quản trị viên.

### 2. 🛡️ Quản trị Hệ thống (Admin)
- **Kiểm soát Truy cập**: Chế độ bảo mật kép bằng Role Admin và xác thực bằng Mã PIN (Admin PIN).
- **Quản lý Bài thi & Chức năng**:
  - Giao diện Admin chia Tab hiện đại. Tích hợp Tab "Quản Lý Chức Năng" cho phép thao tác bật/tắt (Toggle) 11 chế độ cùng lúc trên toàn hệ thống (Anti-Cheat, Shuffle, Show Answer, Auto Next, v.v.).
  - Quản lý trạng thái từng bài thi riêng lẻ.
- **Import Câu hỏi Hàng loạt**: Nạp bộ câu hỏi siêu tốc qua định dạng **Aiken** (chấp nhận cả upload `.txt` hoặc paste trực tiếp).
- **Quản lý Mã Giới thiệu (Referral)**: Tạo nhanh từ 10 đến 100 mã kích hoạt định dạng `REF-XXXXXXXX`.

### 3. 🚨 Hệ thống Anti-Cheat Đa tầng
- **Server-side Scoring**: Việc chấm điểm hoàn toàn thực hiện tại Backend, tuyệt đối không tin tưởng dữ liệu từ Client.
- **Ngăn chặn Gian lận Cơ bản**: Chặn phím tắt DevTools (F12), Right-click, Copy/Cut/Paste, Text Selection.
- **Kiểm soát Môi trường Thi**:
  - **Tab Switch & Fullscreen Monitor**: Theo dõi khi người dùng chuyển Tab/Cửa sổ hoặc thoát khỏi chế độ Toàn màn hình.
  - Hỗ trợ nhiều cấp độ giám sát: Basic (chỉ chặn copy), Tab-only, Fullscreen-only, hoặc Strict (cả 2).
- **Trừng phạt tự động**: Vi phạm sẽ kích hoạt thời gian chờ (Cooldown 1200ms). Quá 3 lần vi phạm sẽ **Tự động nộp bài và nhận điểm 0**. Ghi log vi phạm chi tiết về Server.

---

## 🛠️ Kiến trúc & Công nghệ

**Frontend (Client)**
<p align="left">
  <img src="https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5" />
  <img src="https://img.shields.io/badge/css3-%231572B6.svg?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3" />
  <img src="https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E" alt="JavaScript" />
  <img src="https://img.shields.io/badge/Swiper-6332F6?style=for-the-badge&logo=swiper&logoColor=white" alt="Swiper" />
</p>
- Kiến trúc Vanilla JS (siêu nhẹ, không framework cồng kềnh).
- Styling hiện đại: CSS Variables, Glassmorphism, Dark Theme, Responsive Mobile-first.

**Backend & Database**
<p align="left">
  <img src="https://img.shields.io/badge/Google_Apps_Script-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Google Apps Script" />
  <img src="https://img.shields.io/badge/Google_Sheets-34A853?style=for-the-badge&logo=google-sheets&logoColor=white" alt="Google Sheets" />
</p>
- Serverless API được host hoàn toàn trên Google Apps Script (Miễn phí, không lo downtime server).
- Database là Google Sheets, cho phép Admin dễ dàng thao tác, kiểm tra dữ liệu trực tiếp khi cần.
- **Hệ thống Caching CacheService**: Tối ưu tốc độ tải với thời gian lưu đệm thông minh (Snapshot 300s, Init 90s, User Stats 120s).

---

## 🚀 Hướng dẫn Cài đặt & Triển khai

Xem chi tiết từng bước tại `SETUP_GUIDE.md`. Tóm tắt cơ bản:

1. **Chuẩn bị Database**: Tạo một Google Sheet có đúng 6 trang tính (Sheets): `Users`, `ReferralCodes`, `Quiz_List`, `Questions`, `Attempt_Logs`, `Report_Logs` với các Cột tương ứng.
2. **Deploy Backend**: 
   - Đẩy toàn bộ thư mục `gs/` lên Google Apps Script bằng công cụ `clasp` hoặc dán code tay.
   - Lưu ý: KHÔNG đưa các file chứa khóa bí mật (`gs/Config.js`, `gs/.clasp.json`) lên Public Repository.
   - Deploy dưới dạng Web App (Execute as: Me, Access: Anyone).
3. **Kết nối Frontend**: Lấy URL của Web App vừa Deploy dán vào hằng số `APIClient.GAS_URL` trong file `assets/script.js`.
4. **Build Frontend (Tùy chọn)**: 
   - Cài đặt `npm install`.
   - Chạy `npm run build:quiz` để tối ưu (minify, obfuscate) mã nguồn vào thư mục `dist/`.

---

## 📚 Google Sheets Schema (Cấu trúc DB)

<details>
<summary>1. Users</summary>

- `Username` | `Password_Hash` | `Role` | `FullName` | `AdminPinHash` | `CreatedAt` | `Email`
</details>

<details>
<summary>2. ReferralCodes</summary>

- `Code` | `Status` (Active/Used) | `UsedBy` | `UsedAt`
</details>

<details>
<summary>3. Quiz_List</summary>

- `QuizID` | `Subject` | `Title` | `Description` | `TimeLimit` | `Status` | `Show_Answer` | `Shuffle` | `AntiCheatTabSwitch` | `AntiCheatFullscreen` | `AutoNext` | `AllowBack`
</details>

<details>
<summary>4. Questions</summary>

- `QuestionID` | `QuizID` | `QuestionText` | `A` | `B` | `C` | `D` | `CorrectAnswer` | `Explanation`
</details>

<details>
<summary>5. Attempt_Logs</summary>

- `LogID` | `Username` | `QuizID` | `Score` (hoặc CHEAT) | `User_Answers` | `Timestamp`
</details>

<details>
<summary>6. Report_Logs</summary>

- `Username` | `QuizID` | `QuestionID` | `ErrorType` | `Details` | `Timestamp`
</details>

---

## 💡 Hướng dẫn Định dạng AIKEN Import

Dễ dàng nhập liệu hàng trăm câu hỏi bằng định dạng Aiken chuẩn quốc tế:
```text
Question text?
A) Option A
B) Option B
C) Option C
D) Option D
ANSWER: B
EXP: Dòng giải thích thêm cho câu hỏi (tùy chọn)
```
*(Chấp nhận cả format `A)` hoặc `A.`)*

---

## 👨‍💻 Tác giả

<p align="center">
  <a href="https://tsbyin.dev">
    <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=22&pause=1000&color=8A2BE2&center=true&vCenter=true&width=600&lines=Hi+there,+I'm+Chei!+%F0%9F%91%8B;IT+Specialist+%7C+Systems+Administrator;Self-hosted+Homelab+%7C+Microservices;Biomedical+Engineering+%40+Phenikaa" alt="Typing SVG" />
  </a>
</p>

<p align="center">
  <a href="https://tsbyin.dev"><img src="https://img.shields.io/badge/Portfolio-tsbyin.dev-8A2BE2?style=flat-square&logo=google-chrome&logoColor=white" /></a>
  <a href="https://tsbyin.dev/CV_NguyenVanTuanSy.pdf"><img src="https://img.shields.io/badge/CV-Download-22c55e?style=flat-square&logo=adobeacrobatreader&logoColor=white" /></a>
  <a href="mailto:chei@tsbyin.dev"><img src="https://img.shields.io/badge/Email-chei@tsbyin.dev-0ea5e9?style=flat-square&logo=gmail&logoColor=white" /></a>
  <a href="https://s.tsbyin.dev/linkedin"><img src="https://img.shields.io/badge/LinkedIn-Connect-0077B5?style=flat-square&logo=linkedin&logoColor=white" /></a>
</p>

Dự án được phát triển và duy trì bởi **TsByin** như một công cụ hỗ trợ cho các tổ chức giáo dục quy mô nhỏ.
- 🔒 **Bản quyền:** 2026 © TsByin. All rights reserved.
- 📜 **License:** Personal project for learning and internal deployment.
