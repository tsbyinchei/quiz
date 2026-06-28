// assets/pages/password.js — Logic for password

document.addEventListener('DOMContentLoaded', () => {
    if (!AuthManager || !AuthManager.isAuthenticated()) {
        window.location.href = 'login';
        return;
    }

    const form = document.getElementById('passwordForm');
    const elFeedback = document.getElementById('passwordFeedback');
    const btnBack = document.getElementById('btnBack');

    // Back button
    if (btnBack) {
        btnBack.addEventListener('click', () => {
            window.location.href = AuthManager.isAdmin() ? 'admin' : 'dashboard';
        });
    }

    // Toggle password visibility
    const peekButtons = document.querySelectorAll('.password-peek');
    peekButtons.forEach((peekBtn) => {
        peekBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const wrap = peekBtn.closest('.password-field-wrap');
            if (!wrap) return;
            const input = wrap.querySelector('input');
            if (!input) return;

            const isVisible = input.type === 'text';
            input.type = isVisible ? 'password' : 'text';
            peekBtn.textContent = isVisible ? 'Hiện' : 'Ẩn';
            peekBtn.classList.toggle('is-active', !isVisible);
        });
    });

    function setFeedback(msg, type) {
        if (!elFeedback) return;
        elFeedback.className = ('feedback ' + (type || '')).trim();
        elFeedback.textContent = msg || '';
    }

    // Form submit
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            setFeedback('');

            if (!currentPassword || !newPassword || !confirmPassword) {
                setFeedback('Vui lòng nhập đầy đủ thông tin.', 'incorrect');
                return;
            }

            if (newPassword.length < 6) {
                setFeedback('Mật khẩu mới phải có ít nhất 6 ký tự.', 'incorrect');
                return;
            }

            if (newPassword !== confirmPassword) {
                setFeedback('Mật khẩu mới nhập lại không khớp.', 'incorrect');
                return;
            }

            if (newPassword === currentPassword) {
                setFeedback('Mật khẩu mới phải khác mật khẩu hiện tại.', 'incorrect');
                return;
            }

            try {
                const result = await APIClient.changePassword(currentPassword, newPassword);
                if (!result || !result.success) {
                    setFeedback((result && result.message) || 'Không thể đổi mật khẩu.', 'incorrect');
                    return;
                }

                setFeedback('Đổi mật khẩu thành công.', 'correct');
                form.reset();
            } catch (err) {
                setFeedback('Lỗi kết nối khi đổi mật khẩu.', 'incorrect');
            }
        });
    }
});
