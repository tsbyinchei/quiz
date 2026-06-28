document.addEventListener('DOMContentLoaded', () => {
            if (window.antiCheat && typeof window.antiCheat.enable === 'function') {
                window.antiCheat.enable(false);
            }
        });

        const clipboardAllowedFieldIds = ['fullName', 'email', 'username', 'referralCode'];
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

            const wrap = input.closest('.password-field-wrap');
            if (wrap) {
                const peekBtn = wrap.querySelector('.password-peek');
                if (peekBtn) {
                    let isVisible = false;
                    peekBtn.addEventListener('click', (event) => {
                        event.preventDefault();
                        isVisible = !isVisible;
                        if (isVisible) {
                            input.type = 'text';
                            peekBtn.classList.add('is-active');
                            peekBtn.textContent = 'Ẩn';
                        } else {
                            input.type = 'password';
                            peekBtn.classList.remove('is-active');
                            peekBtn.textContent = 'Hiện';
                        }
                    });
                }
            }
        });

        document.getElementById('registerForm').addEventListener('submit', async function (event) {
            event.preventDefault();

            const fullName = document.getElementById('fullName').value.trim();
            const email = document.getElementById('email').value.trim();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const referralCode = document.getElementById('referralCode').value.trim();
            const errorDiv = document.getElementById('errorMessage');
            const successDiv = document.getElementById('successMessage');
            const loadingOverlay = document.getElementById('loadingOverlay');

            errorDiv.textContent = '';
            successDiv.style.display = 'none';
            successDiv.textContent = '';

            if (!fullName || !email || !username || !password || !confirmPassword || !referralCode) {
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
                const result = await APIClient.registerUser({
                    fullName,
                    email,
                    username,
                    password,
                    referralCode
                });

                if (!result || !result.success) {
                    errorDiv.textContent = (result && result.message) || 'Không thể đăng ký tài khoản.';
                    return;
                }

                successDiv.textContent = 'Đăng ký thành công. Hệ thống sẽ chuyển sang trang đăng nhập...';
                successDiv.style.display = 'block';

                setTimeout(() => {
                    window.location.href = 'login';
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
