function enableRegisterAntiCheat() {
    if (window.antiCheat && typeof window.antiCheat.enable === 'function') {
        window.antiCheat.enable(false);
    }
}

function bindClipboardGuards() {
    const clipboardAllowedFieldIds = ['fullName', 'username', 'referralCode'];
    clipboardAllowedFieldIds.forEach((id) => {
        const input = document.getElementById(id);
        if (!input) {
            return;
        }

        input.addEventListener('keydown', (event) => {
            const key = String(event.key || '').toLowerCase();
            const isCmdOrCtrl = event.ctrlKey || event.metaKey;
            if (isCmdOrCtrl && (key === 'c' || key === 'v' || key === 'x')) {
                event.stopPropagation();
            }
        }, true);

        ['copy', 'cut', 'paste'].forEach((eventName) => {
            input.addEventListener(eventName, (event) => {
                event.stopPropagation();
            }, true);
        });

        input.addEventListener('mousedown', (event) => {
            if (event.detail > 1) {
                event.stopPropagation();
            }
        }, true);
    });

    const referralCodeInput = document.getElementById('referralCode');
    if (referralCodeInput) {
        referralCodeInput.addEventListener('dblclick', () => {
            referralCodeInput.select();
        });
    }

    ['password', 'confirmPassword'].forEach((id) => {
        const input = document.getElementById(id);
        if (!input) {
            return;
        }

        ['copy', 'cut', 'paste'].forEach((eventName) => {
            input.addEventListener(eventName, (event) => {
                event.preventDefault();
            });
        });
    });
}

function bindRegisterSubmit() {
    const registerForm = document.getElementById('registerForm');
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    const loadingOverlay = document.getElementById('loadingOverlay');

    if (!registerForm || !errorDiv || !successDiv) {
        return;
    }

    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const fullName = document.getElementById('fullName').value.trim();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const referralCode = document.getElementById('referralCode').value.trim();

        errorDiv.textContent = '';
        successDiv.style.display = 'none';
        successDiv.textContent = '';

        if (!fullName || !username || !password || !confirmPassword || !referralCode) {
            errorDiv.textContent = 'Vui lòng nhập đầy đủ thông tin.';
            return;
        }

        if (username.length < 4) {
            errorDiv.textContent = 'Tên đăng nhập phải có ít nhất 4 ký tự.';
            return;
        }

        if (password.length < 6) {
            errorDiv.textContent = 'Mật khẩu phải có ít nhất 6 ký tự.';
            return;
        }

        if (password !== confirmPassword) {
            errorDiv.textContent = 'Mật khẩu nhập lại không khớp.';
            return;
        }

        if (loadingOverlay) {
            loadingOverlay.classList.add('is-visible');
            loadingOverlay.setAttribute('aria-hidden', 'false');
        }

        try {
            const passwordHash = typeof hashPasswordWithSalt === 'function'
                ? await hashPasswordWithSalt(password)
                : await sha256(`${password}${QUIZ_PASSWORD_SALT || 'TsByinChei'}`);

            const result = await APIClient.registerUser({
                fullName,
                username,
                passwordHash,
                referralCode
            });

            if (!result || !result.success) {
                errorDiv.textContent = (result && result.message) || 'Không thể đăng ký tài khoản.';
                return;
            }

            successDiv.textContent = 'Đăng ký thành công. Hệ thống sẽ chuyển sang trang đăng nhập...';
            successDiv.style.display = 'block';

            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1200);
        } catch (error) {
            console.error('Register error:', error);
            errorDiv.textContent = 'Lỗi kết nối. Vui lòng thử lại.';
        } finally {
            if (loadingOverlay) {
                loadingOverlay.classList.remove('is-visible');
                loadingOverlay.setAttribute('aria-hidden', 'true');
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    enableRegisterAntiCheat();
    bindClipboardGuards();
    bindRegisterSubmit();
});
