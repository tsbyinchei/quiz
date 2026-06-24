function redirectIfAuthenticated() {
    if (!AuthManager.isAuthenticated()) {
        return false;
    }

    window.location.replace(AuthManager.isAdmin() ? 'admin.html' : 'dashboard.html');
    return true;
}

const redirectedFromLogin = redirectIfAuthenticated();

function bindPasswordPeek() {
    const passwordInput = document.getElementById('password');
    const peekButton = document.getElementById('peekPasswordBtn');
    if (!passwordInput || !peekButton) {
        return;
    }

    const revealPassword = () => {
        passwordInput.type = 'text';
        peekButton.classList.add('is-active');
    };

    const hidePassword = () => {
        passwordInput.type = 'password';
        peekButton.classList.remove('is-active');
    };

    peekButton.addEventListener('click', (event) => {
        event.preventDefault();
    });

    peekButton.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        if (peekButton.setPointerCapture && event.pointerId !== undefined) {
            peekButton.setPointerCapture(event.pointerId);
        }
        revealPassword();
    });

    ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach((eventName) => {
        peekButton.addEventListener(eventName, hidePassword);
    });

    peekButton.addEventListener('touchstart', (event) => {
        event.preventDefault();
        revealPassword();
    }, { passive: false });

    peekButton.addEventListener('touchend', hidePassword);
    peekButton.addEventListener('touchcancel', hidePassword);
}

function bindSessionGuard() {
    const passwordInput = document.getElementById('password');
    const usernameInput = document.getElementById('username');
    const loginSubmitButton = document.querySelector('#loginForm .btn-login');
    const unlockLoginBtn = document.getElementById('unlockLoginBtn');
    const errorDiv = document.getElementById('errorMessage');

    if (!passwordInput || !usernameInput || !loginSubmitButton || !unlockLoginBtn || !errorDiv) {
        return;
    }

    const hasActiveSession = () => AuthManager.isAuthenticated() && !!AuthManager.getUsername();

    const setLoginLocked = (locked) => {
        usernameInput.disabled = locked;
        passwordInput.disabled = locked;
        loginSubmitButton.disabled = locked;
        unlockLoginBtn.classList.toggle('hidden', !locked);

        if (locked) {
            const currentUser = AuthManager.getUsername();
            const currentRole = AuthManager.getRole();
            errorDiv.textContent = `Bạn đang đăng nhập với ${currentUser} (${currentRole}). Hãy đăng xuất trước khi đổi tài khoản.`;
        } else {
            errorDiv.textContent = '';
        }
    };

    setLoginLocked(hasActiveSession());

    unlockLoginBtn.addEventListener('click', () => {
        AuthManager.clearAuth();
        setLoginLocked(false);
    });
}

function bindLoginSubmit() {
    document.getElementById('loginForm').addEventListener('submit', async function(e) {
        e.preventDefault();

        if (AuthManager.isAuthenticated() && AuthManager.getUsername()) {
            document.getElementById('errorMessage').textContent = 'Bạn đang đăng nhập tài khoản khác. Vui lòng đăng xuất trước khi đăng nhập lại.';
            return;
        }

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('errorMessage');
        const loadingOverlay = document.getElementById('loadingOverlay');

        errorDiv.textContent = '';
        loadingOverlay.classList.add('is-visible');
        loadingOverlay.setAttribute('aria-hidden', 'false');

        try {
            const result = await APIClient.request('login', {
                username,
                password
            });

            if (result.success) {
                AuthManager.setAuth(result.token, result.role, result.username, result.fullName || '');
                sessionStorage.removeItem('adminPinVerified');
                sessionStorage.removeItem('adminPinVerifiedFor');
                sessionStorage.removeItem('adminPinProof');
                
                window.location.href = result.role === 'Admin' ? 'admin.html' : 'dashboard.html';
            } else {
                errorDiv.textContent = result.message || 'Đăng nhập thất bại!';
                if (result.blockedUntil || (result.message && result.message.toLowerCase().includes('tạm thời bị khóa'))) {
                    startRateLimitCountdown(result.blockedUntil || (Date.now() + 5 * 60 * 1000));
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            errorDiv.textContent = 'Lỗi kết nối. Vui lòng thử lại!';
        } finally {
            loadingOverlay.classList.remove('is-visible');
            loadingOverlay.setAttribute('aria-hidden', 'true');
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (redirectedFromLogin) {
        return;
    }

    if (window.antiCheat && typeof window.antiCheat.enable === 'function') {
        window.antiCheat.enable(false);
    }

    bindSessionGuard();
    bindPasswordPeek();
    bindLoginSubmit();
});
