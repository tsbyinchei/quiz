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
            const email = String(account.email || '').trim() || '(Chưa cập nhật Email)';
            const totalAttempts = Number(stats.totalAttempts || 0);

            if (elFullName) elFullName.textContent = fullName;
            if (elUsername) elUsername.textContent = '@' + username;
            if (document.getElementById('infoEmail')) document.getElementById('infoEmail').textContent = email;
            if (elTotalAttempts) elTotalAttempts.textContent = Number.isFinite(totalAttempts) ? String(totalAttempts) : '0';

            currentAccountInfo = account;

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

    let currentAccountInfo = null;

    // Edit Modal Logic
    const btnEditInfo = document.getElementById('btnEditInfo');
    const editInfoModal = document.getElementById('editInfoModal');
    const editInfoForm = document.getElementById('editInfoForm');
    const confirmSavePopup = document.getElementById('confirmSavePopup');
    const editInfoError = document.getElementById('editInfoError');

    if (btnEditInfo) {
        btnEditInfo.addEventListener('click', () => {
            if (!currentAccountInfo) return;
            document.getElementById('editFullName').value = currentAccountInfo.fullName || '';
            document.getElementById('editUsername').value = currentAccountInfo.username || '';
            document.getElementById('editEmail').value = currentAccountInfo.email || '';
            editInfoError.textContent = '';
            editInfoModal.classList.remove('hidden');
        });
    }

    if (document.getElementById('btnCancelEdit')) {
        document.getElementById('btnCancelEdit').addEventListener('click', () => {
            editInfoModal.classList.add('hidden');
        });
    }

    if (document.getElementById('btnSaveEdit')) {
        document.getElementById('btnSaveEdit').addEventListener('click', () => {
            if (!editInfoForm.checkValidity()) {
                editInfoForm.reportValidity();
                return;
            }
            editInfoModal.classList.add('hidden');
            confirmSavePopup.classList.remove('hidden');
        });
    }

    if (document.getElementById('btnCancelConfirm')) {
        document.getElementById('btnCancelConfirm').addEventListener('click', () => {
            confirmSavePopup.classList.add('hidden');
            editInfoModal.classList.remove('hidden');
        });
    }

    if (document.getElementById('btnConfirmSave')) {
        document.getElementById('btnConfirmSave').addEventListener('click', async () => {
            const newFullName = document.getElementById('editFullName').value;
            const newEmail = document.getElementById('editEmail').value;
            
            confirmSavePopup.classList.add('hidden');
            setFeedback('Đang cập nhật...', false);

            try {
                const result = await APIClient.updateUserInfo(newFullName, newEmail);
                if (result.success) {
                    if (result.token) {
                        AuthManager.setAuth(result.token, result.account.role, result.account.username, result.account.fullName);
                    }
                    setFeedback('Cập nhật thông tin thành công!', false);
                    fetchInfo();
                } else {
                    setFeedback(result.message || 'Cập nhật thất bại.', true);
                }
            } catch (error) {
                setFeedback('Lỗi kết nối.', true);
            }
        });
    }

    fetchInfo().then(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('action') === 'updateEmail' && btnEditInfo) {
            btnEditInfo.click();
            // clean up url
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    });
});
