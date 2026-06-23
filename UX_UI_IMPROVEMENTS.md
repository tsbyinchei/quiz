# Cải tiến UX / UI — Quiz Lab (Mobile & PC)

Ngày: 13/05/2026

Tóm tắt ngắn
- Mục tiêu: xác định vấn đề UX/UI trên cả Mobile và PC, ưu tiên sửa nhanh, và đề xuất bước tiếp theo.

Vấn đề chính đã phát hiện
- Thiếu quy tắc responsive tập trung (một số breakpoint nằm rải rác trong `admin.html`).
- Nhiều style chỉ dùng `:hover` (không có `:focus`/`:active`) → kém tương tác trên thiết bị cảm ứng và bàn phím.
- Topbar cố định cao (`--h: 64px`) gây chật ở màn hình nhỏ và padding global `body.has-topbar` không co lại đủ.
- Một vài nút/element có min-width/min-height cứng, làm tràn hoặc khó thao tác trên điện thoại.
- Thiếu focus styles rõ ràng (a11y), và một số tap target nhỏ hơn khuyến nghị (44px).

Ưu tiên khuyến nghị (theo thứ tự)
1. Tap targets & focus: thêm min-height/padding cơ bản, thêm `:focus` cho các selector `:hover`. (High, 10–30 phút)
2. Topbar responsive: giảm `--h` trên màn nhỏ và điều chỉnh `body.has-topbar` tương ứng. (High, 10–20 phút)
3. Relax min-width/min-height cứng: chuyển sang kích thước tương thích `min(180px, 45%)` hoặc unset trên breakpoint nhỏ. (Medium, 20–40 phút)
4. Tập trung breakpoint: di chuyển các media queries từ file HTML inline vào `assets/style.css` và thêm biến breakpoints `--bp-sm`, `--bp-md`. (Medium, 30–60 phút)
5. Accessibility: đảm bảo mọi `:hover` có `:focus`/`:active`, thêm outline rõ ràng cho keyboard. (Medium, 20–40 phút)

Hành động nhanh (tối ưu ngay)
- A: Thêm CSS sau vào `assets/style.css` (tap targets + focus fallback + small topbar):

  - Tăng min tap target cho `button`, `.btn`, `.site-nav a`, `.account-menu-btn`.
  - Thêm `:focus, :active` cho các rule `:hover` chính.
  - Giảm `--h` cho `max-width:640px`.

Kiểm tra & xác thực
- Đã chạy build production và kiểm tra tĩnh: build chạy ổn (5 lần), không lỗi cú pháp CSS/JS cho các file đã sửa.
- Phần kiểm tra hành vi cross-tab đã để ở bước manual (yêu cầu trình duyệt để mở 2 tab).

Next steps đề xuất (mình có thể làm ngay)
1. Áp A+B+C (quick fixes) vào `assets/style.css`, chạy build và test UI trên mobile emulator. (Mình có thể làm ngay.)
2. Di chuyển media queries từ `admin.html` vào `assets/style.css` và chuẩn hóa breakpoints. (tốt cho maintainability)
3. Viết 1 kịch bản Playwright cơ bản để kiểm tra: (a) topbar hiển thị đúng trên 360×800, (b) tap-targets >= 44px, (c) nút nhận `:focus` khi tab. (optional)

Bạn muốn mình triển khai ngay phần Quick fixes (A+B+C) không? Nếu đồng ý, mình sẽ apply patch vào `assets/style.css`, build và kiểm tra nhanh trên emulator.
