# Anti-Cheat Summary (Updated)

## Muc tieu

Bao ve trang quiz khoi cac thao tac gian lan pho bien, dong thoi tranh false-positive do xung dot su kien popup trinh duyet.

## Trang thai hien tai

- Anti-cheat da tach rieng tai assets/anticheating.js.
- Da tich hop vao login.html va quiz.html.
- Quiz dung in-app modal thay cho alert/confirm de khong bi blur-loop.

## Co che chinh

1. Keyboard protection
- Chan F12, Ctrl+Shift+I/J, Ctrl+U, Ctrl+C/X/V, ...

2. Mouse and clipboard protection
- Chan right-click/context menu.
- Chan copy/cut/paste khi dang lam bai.

3. Selection protection
- Chan selectstart va drag text (ngoai tru input/textarea).

4. Tab/Focus monitoring
- Theo doi visibilitychange + blur.
- Co cooldown de tranh tinh trung 1 hanh vi vi pham.
- Co dialog lock de bo qua trigger khi modal dang mo.

5. Punishment flow
- Canh bao theo so lan vi pham.
- Vi pham qua nguong: auto-submit bai voi force mode.
- Gui log vi pham len backend (action: logCheatViolation).

## Cac fix quan trong da ap dung

- Fix event conflict blur + visibilitychange gay nhay 2-3 canh bao.
- Fix popup loop (alert/confirm tao blur -> bi bat lai).
- Them isPunishing/isDialogOpen de tranh goi submit lap.
- submitQuiz(true, true) khi auto-punish de bo qua confirm.

## Backend logging

- API action: logCheatViolation
- Du lieu log:
  - username
  - quizID
  - violationType
  - cheatCount
  - timestamp
  - userAgent

## Luu y van hanh

- Anti-cheat la lop client-side, khong thay the xac thuc server-side.
- Cham diem van do backend quyet dinh.
- Sau moi thay doi GAS can deploy lai de frontend nhan logic moi.

## Kiem thu de xuat

- Thu tab switch lien tuc (co cooldown, khong cong don bat thuong).
- Thu nop bai bang topbar/btn submit va xac nhan modal.
- Thu auto-submit khi vuot nguong vi pham.
- Thu kiem tra log trong Attempt_Logs.
