# 📋 INTEGRATION GUIDE: ANTI-CHEAT MODULE (PART 6)

## ✅ Hoàn Thành

Đã create:
- ✅ `assets/anticheating.js` - Module anti-cheat độc lập (220+ dòng)
- ✅ `icon.ico` reference thêm vào tất cả HTML files
- ✅ SEO meta tags & theme-color

## 📝 Cần Làm: Thêm 2 dòng vào Tác vụ sau đây

### **1. Trong `login.html` - Trang Đăng Nhập**

#### Trước dòng `</head>`:
```html
    <meta name="theme-color" content="#0a0e27">
    <link rel="icon" type="image/x-icon" href="icon.ico">
    <title>Đăng Nhập - Quiz Lab</title>
    <link rel="stylesheet" href="assets/style.css">
</head>
```

#### Trước `</body>`:
```html
    <!-- Anti-Cheat Module -->
    <script src="assets/anticheating.js"></script>
    
    <script src="assets/script.js"></script>
    <script>
        // Kích hoạt Anti-Cheat cho trang Login
        document.addEventListener('DOMContentLoaded', () => {
            antiCheat.enable(false); // false = không phải quiz page
        });

        // Login form handler
        document.getElementById('loginForm').addEventListener('submit', async function(e) {
            // ... code hiện tại ...
        });
    </script>
</body>
```

---

### **2. Trong `quiz.html` - Trang Làm Bài**

#### Trước `<!-- Swiper JS -->`:
```html
    <!-- Anti-Cheat Module -->
    <script src="assets/anticheating.js"></script>

    <!-- Swiper JS -->
    <script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>
```

#### Trong `<script>` phần `initQuiz()` function, thêm dòng này:
```javascript
    async function initQuiz() {
        // Kích hoạt Anti-Cheat cho trang Quiz
        antiCheat.enable(true); // true = quiz page (giám sát chuyển tab)

        // Kiểm tra authentication
        const token = localStorage.getItem('quizToken');
        if (!token) {
            window.location.href = 'login.html';
            return;
        }
        // ... code hiện tại ...
    }
```

---

## 🛡️ Features của Anti-Cheat Module

### ✅ Chặn Phím Tắt
- F12 (DevTools)
- Ctrl+Shift+I (DevTools Inspector)
- Ctrl+Shift+J (DevTools Console)
- Ctrl+U (View Source)
- Ctrl+S (Save Page)
- Ctrl+P (Print)
- Ctrl+C/X/V (Copy/Cut/Paste)

### ✅ Chặn Tương Tác Chuột
- Chuột phải (Right-click)
- Copy event
- Cut event
- Paste event
- Double-click selection

### ✅ Chặn Text Selection
- Không thể bôi đen text bằng chuột
- CSS `user-select: none` áp dụng toàn trang
- Input/Textarea vẫn cho phép chọn (cho phép nhập dữ liệu)

### ✅ Giám Sát Chuyển Tab (Chỉ Quiz Mode)
- Phát hiện khi user chuyển sang tab khác
- Lần 1-2: Cảnh báo
- Lần 3: Tự động nộp bài với điểm 0 + log violation

### ✅ Logging
- Ghi lại tất cả vi phạm lên Backend (GAS)
- Log fields: username, quizID, violationType, timestamp, userAgent

---

## 📊 Anti-Cheat Statistics

| Feature | Status | Complexity |
|---------|--------|-----------|
| Keyboard Blocking | ✅ | Low |
| Mouse Blocking | ✅ | Low |
| Text Selection | ✅ | Medium |
| Tab Monitoring | ✅ | Medium |
| Auto-Punishment | ✅ | High |
| Logging | ✅ | High |

---

## 🔧 Configuration

```javascript
class AntiCheat {
    maxCheatAttempts = 3;      // 3 cảnh báo trước khi xử phạt
    cheatCount = 0;             // Counter hiện tại
    isQuizMode = false;         // Tự động set khi gọi enable()
}
```

---

## 📝 Example Usage

```javascript
// Kích hoạt cho Login page
antiCheat.enable(false);
// → Chặn phím tắt, copy/paste, selection

// Kích hoạt cho Quiz page  
antiCheat.enable(true);
// → Chặn + giám sát chuyển tab
// → Tự động submit nếu cheat 3 lần

// Vô hiệu hóa (nếu cần)
antiCheat.disable();
```

---

## 🔐 Additional Security (Optional)

### Để tăng thêm bảo mật, có thể thêm:

1. **DevTools Detection** (phương pháp nâng cao):
```javascript
// Trong anticheating.js thêm:
antiCheat.startPeriodicCheck(); // Check DevTools mỗi 2 giây
```

2. **Network Monitoring**:
```javascript
// Giám sát requests được gửi ra khỏi page
```

3. **Screenshot Prevention** (Desktop only):
```javascript
// Chặn Print Screen key
```

---

## ⚠️ Giới Hạn & Lưu Ý

| Limitation | Reason | Solution |
|------------|--------|----------|
| Không chặn được được inspect via Browser Extension | Browser extensions vượt qua DOM security | Sử dụng Server-Side Validation |
| Có thể vượt qua nếu user hiểu JS | Source code public | Hybrid grading mode + Server validation |
| Mobile không có DevTools | Different environment | Tab monitoring vẫn hoạt động |

---

## 📋 Testing Checklist

- [ ] F12 bị chặn trên Login/Quiz page
- [ ] Right-click hiển thị cảnh báo
- [ ] Không thể copy text khỏi Quiz content
- [ ] Sau 3 lần chuyển tab → Auto submit
- [ ] Log vi phạm lưu vào Backend
- [ ] Input fields vẫn cho phép nhập

---

## 🚀 Next Steps

1. **Update login.html** - Thêm anticheating.js + enable(false)
2. **Update quiz.html** - Thêm anticheating.js + enable(true)
3. **Update Backend** - Thêm `logCheatViolation` action vào GAS
4. **Test** - Verify tất cả features hoạt động
5. **Monitor** - Checck logs khi users làm bài

---

**Hệ thống Anti-Cheat sẵn sàng! 🛡️**
