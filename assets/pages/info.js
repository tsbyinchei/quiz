// assets/pages/info.js — Logic for info.html

document.addEventListener('DOMContentLoaded', () => {
    if (!AuthManager || !AuthManager.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    const elAvatar = document.getElementById('infoAvatarInitials');
    const elFullName = document.getElementById('infoFullName');
    const elUsername = document.getElementById('infoUsername');
    const elTotalAttempts = document.getElementById('infoTotalAttempts');
    const elFeedback = document.getElementById('infoFeedback');

    // Action buttons
    const btnBack = document.getElementById('btnBack');
    const btnPassword = document.getElementById('btnPassword');
    const btnLogout = document.getElementById('btnLogout');

    if (btnBack) {
        btnBack.addEventListener('click', () => {
            window.location.href = AuthManager.isAdmin() ? 'admin.html' : 'dashboard.html';
        });
    }
    if (btnPassword) {
        btnPassword.addEventListener('click', () => {
            window.location.href = 'password.html';
        });
    }
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            AuthManager.clearAuth();
            window.location.href = 'login.html';
        });
    }

    function setFeedback(msg, isError) {
        if (!elFeedback) return;
        elFeedback.textContent = msg || '';
        elFeedback.className = isError ? 'feedback incorrect' : 'feedback';
    }

    async function fetchInfo() {
        setFeedback('');
        try {
            const result = await APIClient.getAccountInfo();
            if (!result || !result.success) {
                setFeedback((result && result.message) || 'Không thể tải thông tin tài khoản.', true);
                return;
            }

            const account = result.account || {};
            const stats = result.statsSnapshot || {};

            const fullName = String(account.fullName || '').trim() || '(Chưa cập nhật)';
            const username = String(account.username || '').trim() || '(Không xác định)';
            const totalAttempts = Number(stats.totalAttempts || 0);

            if (elFullName) elFullName.textContent = fullName;
            if (elUsername) elUsername.textContent = '@' + username;
            if (elTotalAttempts) elTotalAttempts.textContent = Number.isFinite(totalAttempts) ? String(totalAttempts) : '0';

            // Avatar initial — last word's first character (Vietnamese name convention)
            if (elAvatar && fullName && fullName !== '(Chưa cập nhật)') {
                const words = fullName.trim().split(/\s+/);
                const lastWord = words[words.length - 1] || '';
                elAvatar.textContent = lastWord.charAt(0).toUpperCase() || '?';
            }
        } catch (err) {
            setFeedback('Lỗi kết nối khi tải thông tin.', true);
        }
    }

    fetchInfo();
});
