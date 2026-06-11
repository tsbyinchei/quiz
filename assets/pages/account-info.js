function goBack() {
    window.location.href = AuthManager.isAdmin() ? 'admin.html' : 'dashboard.html';
}

function logout() {
    AuthManager.clearAuth();
    window.location.href = 'login.html';
}

function setFeedback(message, type = '') {
    const feedback = document.getElementById('infoFeedback');
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
            'go-back': goBack,
            'logout': logout
        };

        const handler = actionMap[action];
        if (typeof handler === 'function') {
            handler();
        }
    });
}

async function loadAccountInfo() {
    if (!AuthManager.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    setFeedback('');

    try {
        const result = await APIClient.getAccountInfo();
        if (!result || !result.success) {
            setFeedback((result && result.message) || 'Không thể tải thông tin tài khoản.', 'incorrect');
            return;
        }

        const account = result.account || {};
        const stats = result.statsSnapshot || {};

        const fullName = String(account.fullName || '').trim();
        const username = String(account.username || '').trim();
        const totalScore = Number(stats.totalScore || 0);
        const totalAttempts = Number(stats.totalAttempts || 0);

        document.getElementById('infoFullName').textContent = fullName || '(Chưa cập nhật)';
        document.getElementById('infoUsername').textContent = username || '(Không xác định)';
        document.getElementById('infoTotalScore').textContent = Number.isFinite(totalScore) ? totalScore.toFixed(2) : '0.00';
        document.getElementById('infoTotalAttempts').textContent = Number.isFinite(totalAttempts) ? String(totalAttempts) : '0';
    } catch (error) {
        setFeedback('Lỗi kết nối khi tải thông tin.', 'incorrect');
    }
}

bindActions();
loadAccountInfo();
