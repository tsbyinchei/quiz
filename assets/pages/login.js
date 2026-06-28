function redirectIfAuthenticated() {
            if (!AuthManager.isAuthenticated()) {
                return false;
            }

            window.location.replace(AuthManager.isAdmin() ? 'admin' : 'dashboard');
            return true;
        }

        const redirectedFromLogin = redirectIfAuthenticated();

        // Kích hoạt Anti-Cheat (Chế độ Login - Không bắt lỗi chuyển tab)
        document.addEventListener('DOMContentLoaded', () => {
            if (redirectedFromLogin) {
                return;
            }

            if (window.antiCheat && typeof window.antiCheat.enable === 'function') {
                window.antiCheat.enable(false);
            }

            const passwordInput = document.getElementById('password');
            const peekButton = document.getElementById('peekPasswordBtn');
            const usernameInput = document.getElementById('username');
            const loginSubmitButton = document.querySelector('#loginForm .btn-login');
            const unlockLoginBtn = document.getElementById('unlockLoginBtn');
            const errorDiv = document.getElementById('errorMessage');

            const hasActiveSession = () => {
                return AuthManager.isAuthenticated() && !!AuthManager.getUsername();
            };

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

            let isPasswordVisible = false;

            const togglePassword = (event) => {
                event.preventDefault();
                isPasswordVisible = !isPasswordVisible;
                if (isPasswordVisible) {
                    passwordInput.type = 'text';
                    peekButton.classList.add('is-active');
                    peekButton.textContent = 'Ẩn';
                } else {
                    passwordInput.type = 'password';
                    peekButton.classList.remove('is-active');
                    peekButton.textContent = 'Hiện';
                }
            };

            peekButton.addEventListener('click', togglePassword);
        });

        let countdownInterval;
        function startRateLimitCountdown(blockedUntil) {
            const loginBtn = document.querySelector('#loginForm .btn-login');
            const errorDiv = document.getElementById('errorMessage');
            
            clearInterval(countdownInterval);
            
            const updateTimer = () => {
                const now = Date.now();
                const remaining = blockedUntil - now;
                
                if (remaining <= 0) {
                    clearInterval(countdownInterval);
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'Đăng Nhập';
                    if (errorDiv.textContent.includes('tạm thời bị khóa')) {
                        errorDiv.textContent = '';
                    }
                    localStorage.removeItem('loginBlockedUntil');
                    return;
                }
                
                loginBtn.disabled = true;
                const minutes = Math.floor(remaining / 60000);
                const seconds = Math.floor((remaining % 60000) / 1000);
                loginBtn.textContent = `Thử lại sau ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            };
            
            localStorage.setItem('loginBlockedUntil', blockedUntil);
            updateTimer();
            countdownInterval = setInterval(updateTimer, 1000);
        }

        document.addEventListener('DOMContentLoaded', () => {
            const savedBlockedUntil = localStorage.getItem('loginBlockedUntil');
            if (savedBlockedUntil && Number(savedBlockedUntil) > Date.now()) {
                startRateLimitCountdown(Number(savedBlockedUntil));
                const errorDiv = document.getElementById('errorMessage');
                if (!errorDiv.textContent) {
                    errorDiv.textContent = 'Tài khoản của bạn đang bị khóa tạm thời. Vui lòng đợi hết thời gian.';
                }
            } else {
                localStorage.removeItem('loginBlockedUntil');
            }
        });

        // Login form handler
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
                // Remove client-side hashing
                const result = await APIClient.request('login', {
                    username,
                    password
                });

                if (result.success) {
                    AuthManager.setAuth(result.token, result.role, result.username, result.fullName || '');
                    sessionStorage.removeItem('adminPinVerified');
                    sessionStorage.removeItem('adminPinVerifiedFor');
                    sessionStorage.removeItem('adminPinProof');
                    
                    // Redirect theo vai trò
                    window.location.href = result.role === 'Admin' ? 'admin' : 'dashboard';
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
