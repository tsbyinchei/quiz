// quiz/assets/pages/forgot.js - Interaction logic for password recovery

document.addEventListener('DOMContentLoaded', () => {
    // Theme initialization
    if (typeof window.initThemeControls === 'function') {
        window.initThemeControls();
    } else if (window.antiCheat && typeof window.antiCheat.enable === 'function') {
        window.antiCheat.enable(false);
    }

    const tabEmailBtn = document.getElementById('tabEmailBtn');
    const tabReferralBtn = document.getElementById('tabReferralBtn');
    const sectionEmail = document.getElementById('sectionEmail');
    const sectionReferral = document.getElementById('sectionReferral');

    const emailRequestForm = document.getElementById('emailRequestForm');
    const emailVerifyForm = document.getElementById('emailVerifyForm');
    const referralRecoveryForm = document.getElementById('referralRecoveryForm');

    const dotStep1 = document.getElementById('dotStep1');
    const dotStep2 = document.getElementById('dotStep2');
    const stepBar = document.getElementById('stepBar');
    const btnBackToStep1 = document.getElementById('btnBackToStep1');

    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');

    const authTabs = document.getElementById('authTabs');
    const pageHeader = document.getElementById('pageHeader');
    const otpInput = document.getElementById('otpInput');
    const displayEmail = document.getElementById('displayEmail');

    let currentUsername = '';
    let currentEmail = '';

    // Clear feedback messages
    function clearMessages() {
        errorDiv.textContent = '';
        if (successDiv) {
            successDiv.style.display = 'none';
            successDiv.textContent = '';
        }
    }

    function showLoading(text) {
        loadingText.textContent = text || 'Đang xử lý...';
        loadingOverlay.classList.add('is-visible');
        loadingOverlay.setAttribute('aria-hidden', 'false');
    }

    function hideLoading() {
        loadingOverlay.classList.remove('is-visible');
        loadingOverlay.setAttribute('aria-hidden', 'true');
    }

    // Tab switcher
    tabEmailBtn.addEventListener('click', () => {
        if (tabEmailBtn.classList.contains('active')) return;
        clearMessages();
        tabEmailBtn.classList.add('active');
        tabReferralBtn.classList.remove('active');
        sectionEmail.classList.remove('hidden');
        sectionReferral.classList.add('hidden');
    });

    tabReferralBtn.addEventListener('click', () => {
        if (tabReferralBtn.classList.contains('active')) return;
        clearMessages();
        tabReferralBtn.classList.add('active');
        tabEmailBtn.classList.remove('active');
        sectionReferral.classList.remove('hidden');
        sectionEmail.classList.add('hidden');
    });

    // Password Peek visibility toggles
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

    // OTP Input validation (only numbers)
    if (otpInput) {
        otpInput.addEventListener('keypress', (e) => {
            if (!/[0-9]/.test(e.key)) {
                e.preventDefault();
            }
        });
    }

    // Back to Step 1
    if (btnBackToStep1) {
        btnBackToStep1.addEventListener('click', () => {
            clearMessages();
            emailVerifyForm.classList.add('hidden');
            emailRequestForm.classList.remove('hidden');
            
            authTabs.style.display = 'flex';
            pageHeader.style.display = 'block';
            
            // Reset fields
            otpInput.value = '';
            document.getElementById('emailNewPassword').value = '';
            document.getElementById('emailConfirmNewPassword').value = '';
        });
    }

    // Step 1 Submit: Request OTP via Email
    emailRequestForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearMessages();

        currentUsername = document.getElementById('emailUsername').value.trim();
        currentEmail = document.getElementById('emailAddress').value.trim();

        if (!currentUsername || !currentEmail) {
            errorDiv.textContent = 'Vui lòng nhập tên đăng nhập và địa chỉ email.';
            return;
        }

        showLoading('Đang kiểm tra tài khoản và gửi mã xác nhận...');

        try {
            const result = await APIClient.requestPasswordReset(currentUsername, currentEmail);
            hideLoading();

            if (result.success) {
                // Transition to Step 2
                emailRequestForm.classList.add('hidden');
                emailVerifyForm.classList.remove('hidden');
                
                authTabs.style.display = 'none';
                pageHeader.style.display = 'none';
                displayEmail.value = currentEmail;
                
                // Focus on OTP input
                setTimeout(() => {
                    otpInput.focus();
                }, 100);
            } else {
                errorDiv.textContent = result.message || 'Gửi mã xác nhận thất bại.';
            }
        } catch (err) {
            hideLoading();
            console.error('Request reset error:', err);
            errorDiv.textContent = 'Lỗi kết nối máy chủ. Vui lòng thử lại sau.';
        }
    });

    // Step 2 Submit: Confirm OTP & reset password
    emailVerifyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearMessages();

        const otp = otpInput.value.trim();
        const newPassword = document.getElementById('emailNewPassword').value;
        const confirmPassword = document.getElementById('emailConfirmNewPassword').value;

        if (otp.length !== 6) {
            errorDiv.textContent = 'Vui lòng nhập đầy đủ mã xác nhận gồm 6 số.';
            return;
        }

        if (newPassword.length < 6) {
            errorDiv.textContent = 'Mật khẩu mới phải có ít nhất 6 ký tự.';
            return;
        }

        if (newPassword !== confirmPassword) {
            errorDiv.textContent = 'Mật khẩu xác nhận không trùng khớp.';
            return;
        }

        showLoading('Đang xác nhận mã OTP và đổi mật khẩu...');

        try {
            const result = await APIClient.confirmPasswordReset(currentUsername, otp, newPassword);
            hideLoading();

            if (result.success) {
                errorDiv.style.color = '#10b981';
                errorDiv.textContent = result.message || 'Khôi phục mật khẩu thành công. Đang chuyển hướng...';
                emailVerifyForm.reset();

                // Redirect to login page
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            } else {
                errorDiv.style.color = '#ef4444';
                errorDiv.textContent = result.message || 'Xác thực OTP thất bại.';
            }
        } catch (err) {
            hideLoading();
            console.error('Confirm reset error:', err);
            errorDiv.style.color = '#ef4444';
            errorDiv.textContent = 'Lỗi kết nối máy chủ. Vui lòng thử lại sau.';
        }
    });

    // Referral Recovery Submit
    referralRecoveryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearMessages();

        const username = document.getElementById('refUsername').value.trim();
        const referralCode = document.getElementById('refReferralCode').value.trim();
        const newPassword = document.getElementById('refNewPassword').value;
        const confirmPassword = document.getElementById('refConfirmNewPassword').value;

        if (!username || !referralCode || !newPassword || !confirmPassword) {
            errorDiv.textContent = 'Vui lòng nhập đầy đủ thông tin.';
            return;
        }

        if (newPassword.length < 6) {
            errorDiv.textContent = 'Mật khẩu mới phải có ít nhất 6 ký tự.';
            return;
        }

        if (newPassword !== confirmPassword) {
            errorDiv.textContent = 'Mật khẩu xác nhận không trùng khớp.';
            return;
        }

        showLoading('Đang xác minh mã giới thiệu và đổi mật khẩu...');

        try {
            const result = await APIClient.resetPasswordViaReferral(username, referralCode, newPassword);
            hideLoading();

            if (result.success) {
                successDiv.textContent = result.message || 'Khôi phục mật khẩu thành công.';
                successDiv.style.display = 'block';
                referralRecoveryForm.reset();

                // Redirect to login page
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            } else {
                errorDiv.textContent = result.message || 'Thông tin khôi phục không khớp.';
            }
        } catch (err) {
            hideLoading();
            console.error('Referral recovery error:', err);
            errorDiv.textContent = 'Lỗi kết nối máy chủ. Vui lòng thử lại sau.';
        }
    });
});
