function goBack() {
    window.location.href = AuthManager.isAdmin() ? 'admin' : 'dashboard';
}

function setFeedback(message, type = '') {
    const feedback = document.getElementById('passwordFeedback');
    if (!feedback) {
        return;
    }

    feedback.className = `feedback ${type}`.trim();
    feedback.textContent = message || '';
}

function bindActions() {
    document.addEventListener('click', (event) => {
        const actionNode = event.target.closest('[data-action]');
        if (!actionNode) {
            return;
        }

        const action = actionNode.dataset.action;
        const actionMap = {
            'go-back': goBack
        };

        const handler = actionMap[action];
        if (typeof handler === 'function') {
            handler();
        }
    });
}

async function handlePasswordSubmit(event) {
    event.preventDefault();

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
        document.getElementById('passwordForm').reset();
    } catch (error) {
        setFeedback('Lỗi kết nối khi đổi mật khẩu.', 'incorrect');
    }
}

function init() {
    if (!AuthManager.isAuthenticated()) {
        window.location.href = 'login';
        return;
    }

    bindActions();

    const passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
        passwordForm.addEventListener('submit', handlePasswordSubmit);
    }
}

init();
