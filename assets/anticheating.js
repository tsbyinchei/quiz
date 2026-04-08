/**
 * ==================== ANTI-CHEAT MODULE ====================
 * Cơ chế bảo mật client-side cho login.html & quiz.html
 * 
 * Features:
 * - Chặn phím tắt devtools (F12, Ctrl+Shift+I, Ctrl+U, etc.)
 * - Chặn chuột phải, copy/paste, text selection
 * - Giám sát chuyển tab với Page Visibility API
 * - Xử phạt tự động nếu cheat >= 3 lần
 */

class AntiCheat {
    constructor() {
        this.enabled = false;
        this.cheatCount = 0;
        this.maxCheatAttempts = 3;
        this.isQuizMode = false;
        this.quizStartTime = null;
        this.isDialogOpen = false;
        this.isPunishing = false;
        this.lastViolationAt = 0;
        this.violationCooldownMs = 1200;
        this._tabVisibilityHandler = null;
    }

    /**
     * Khởi động Anti-Cheat cho trang login/quiz
     * @param {boolean} isQuiz - true nếu là trang quiz.html
     */
    enable(isQuiz = false) {
        this.disable();

        this.enabled = true;
        this.isQuizMode = isQuiz;
        this.cheatCount = 0;

        this.blockKeyboardShortcuts();
        this.blockMouseInteractions();
        this.blockTextSelection();
        
        if (isQuiz) {
            this.monitorTabVisibility();
            this.quizStartTime = Date.now();
        }

        console.log('🛡️ Anti-Cheat Module Activated');
    }

    /**
     * 1. Chặn Phím tắt & Trình duyệt
     */
    blockKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

            if (e.key === 'F12' || 
                (ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) ||
                (ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) ||
                (ctrlKey && (e.key === 'U' || e.key === 'u')) ||
                (ctrlKey && (e.key === 'S' || e.key === 's')) ||
                (ctrlKey && (e.key === 'P' || e.key === 'p')) ||
                (ctrlKey && (e.key === 'c' || e.key === 'C' || e.key === 'x' || e.key === 'X' || e.key === 'v' || e.key === 'V'))) {
                
                e.preventDefault();
                this.triggerCheatWarning();
                return false;
            }
        });
    }

    /**
     * 2. Chặn Tương tác Chuột & Sao chép
     */
    blockMouseInteractions() {
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.triggerCheatWarning();
            return false;
        });

        document.addEventListener('mousedown', (e) => {
            if (e.button === 2) {
                e.preventDefault();
                this.triggerCheatWarning();
                return false;
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (e.button === 2) {
                e.preventDefault();
                return false;
            }
        });

        document.addEventListener('copy', (e) => {
            e.preventDefault();
            this.triggerCheatWarning();
            return false;
        });

        document.addEventListener('cut', (e) => {
            e.preventDefault();
            this.triggerCheatWarning();
            return false;
        });

        document.addEventListener('paste', (e) => {
            e.preventDefault();
            this.triggerCheatWarning();
            return false;
        });
    }

    /**
     * 3. Chặn Text Selection & Bôi đen
     */
    blockTextSelection() {
        document.addEventListener('selectstart', (e) => {
            e.preventDefault();
            return false;
        });

        const style = document.createElement('style');
        style.textContent = `
            body, body * {
                -webkit-user-select: none !important;
                user-select: none !important;
                -webkit-user-drag: none !important;
            }
            input, textarea, [contenteditable="true"] {
                -webkit-user-select: text !important;
                user-select: text !important;
            }
        `;
        document.head.appendChild(style);

        document.addEventListener('mousedown', (e) => {
            if (e.detail > 1) {
                e.preventDefault();
            }
        });
    }

    /**
     * 4. Giám sát Chuyển Tab (Page Visibility API)
     */
    monitorTabVisibility() {
        this._tabVisibilityHandler = () => {
            if (!this.enabled || !this.isQuizMode || this.isDialogOpen) {
                return;
            }

            if (document.hidden || !document.hasFocus()) {
                const now = Date.now();
                if (now - this.lastViolationAt < this.violationCooldownMs) {
                    return;
                }
                this.lastViolationAt = now;
                this.handleTabSwitch();
            }
        };

        document.addEventListener('visibilitychange', this._tabVisibilityHandler);
        window.addEventListener('blur', this._tabVisibilityHandler);
    }

    /**
     * Xử lý khi user chuyển tab
     */
    async handleTabSwitch() {
        if (!this.enabled || !this.isQuizMode || this.isDialogOpen) {
            return;
        }

        this.cheatCount++;
        
        if (this.cheatCount < this.maxCheatAttempts) {
            await this.showCheatAlert(
                `⚠️ Cảnh báo!\n\nBạn đã rời khỏi màn hình làm bài.\n\nVi phạm lần ${this.cheatCount}/${this.maxCheatAttempts}.\n\nNếu tiếp tục sẽ bị khóa bài thi!`
            );
        } else {
            await this.executePunishment();
        }

        this.logCheatViolation('tab_switch');
    }

    /**
     * Cảnh báo gian lận
     */
    triggerCheatWarning() {
        if (this.isDialogOpen) {
            return;
        }

        this.showCheatAlert(
            '🚫 Hành động này bị cấm!\n\nVui lòng không cố gắng sử dụng DevTools hoặc copy dữ liệu.'
        );
    }

    /**
     * Hiển thị alert cảnh báo
     */
    async showCheatAlert(message) {
        this.isDialogOpen = true;

        try {
            if (typeof window.showInAppAlert === 'function') {
                await window.showInAppAlert(message);
            } else {
                alert(message);
            }
        } finally {
            this.isDialogOpen = false;
        }
    }

    /**
     * Xử phạt: Tự động nộp bài với điểm 0
     */
    async executePunishment() {
        if (!this.isQuizMode || this.isPunishing) return;

        this.isPunishing = true;
        this.enabled = false;

        await this.showCheatAlert('❌ Vi phạm quy tắc kiểm tra 3 lần!\n\nBài thi sẽ tự động nộp với điểm 0.');

        if (typeof submitQuiz === 'function') {
            submitQuiz(true, true);
        } else {
            window.location.href = 'dashboard.html';
        }

        this.logCheatViolation('auto_submit_punishment');
    }

    /**
     * Ghi log vi phạm lên Backend (GAS)
     */
    async logCheatViolation(violationType) {
        const username = localStorage.getItem('quizUsername');
        const quizID = localStorage.getItem('currentQuizID');
        const timestamp = new Date().toISOString();

        const logData = {
            username: username,
            quizID: quizID,
            violationType: violationType,
            cheatCount: this.cheatCount,
            timestamp: timestamp,
            userAgent: navigator.userAgent
        };

        try {
            if (typeof APIClient !== 'undefined' && typeof APIClient.logCheatViolation === 'function') {
                await APIClient.logCheatViolation(logData);
            } else {
                if (typeof APIClient === 'undefined' || !APIClient.GAS_URL) {
                    return;
                }

                await fetch(APIClient.GAS_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'logCheatViolation',
                        token: localStorage.getItem('quizToken'),
                        ...logData
                    })
                });
            }

            console.log('📝 Cheat violation logged:', violationType);
        } catch (error) {
            console.error('Error logging cheat violation:', error);
        }
    }

    disable() {
        if (this._tabVisibilityHandler) {
            document.removeEventListener('visibilitychange', this._tabVisibilityHandler);
            window.removeEventListener('blur', this._tabVisibilityHandler);
            this._tabVisibilityHandler = null;
        }

        this.enabled = false;
        this.isQuizMode = false;
        this.isDialogOpen = false;
        this.isPunishing = false;
        console.log('🔓 Anti-Cheat Module Disabled');
    }
}

// Global instance
window.antiCheat = new AntiCheat();
