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
        this._dialogOverlay = null;
        this._dialogMessage = null;
        this._dialogOkButton = null;
    }

    ensureCheatDialog() {
        if (!document.getElementById('antiCheatDialogStyle')) {
            const style = document.createElement('style');
            style.id = 'antiCheatDialogStyle';
            style.textContent = `
                .anti-cheat-dialog-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(7, 10, 20, 0.64);
                    display: none;
                    align-items: center;
                    justify-content: center;
                    z-index: 10001;
                    padding: 1rem;
                }

                .anti-cheat-dialog-overlay.is-open {
                    display: flex;
                }

                .anti-cheat-dialog {
                    width: min(520px, 95vw);
                    border-radius: 18px;
                    border: 1px solid color-mix(in srgb, var(--line, rgba(255, 255, 255, 0.18)) 60%, rgba(255, 255, 255, 0.12));
                    background: color-mix(in srgb, var(--surface, rgba(10, 28, 48, 0.9)) 94%, transparent);
                    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.28);
                    padding: 1.2rem 1.2rem 1rem;
                    color: var(--text, #eef3ff);
                }

                .anti-cheat-dialog-title {
                    margin: 0;
                    font-size: 1.05rem;
                    font-weight: 700;
                }

                .anti-cheat-dialog-message {
                    margin: 0.85rem 0 1.15rem;
                    white-space: pre-line;
                    line-height: 1.5;
                    color: var(--text-light, rgba(236, 244, 255, 0.92));
                }

                .anti-cheat-dialog-actions {
                    display: flex;
                    justify-content: flex-end;
                }

                .anti-cheat-dialog-btn {
                    border: none;
                    border-radius: 10px;
                    padding: 0.6rem 1rem;
                    cursor: pointer;
                    font-weight: 600;
                    background: linear-gradient(135deg, #37d4ff, #4f7dff);
                    color: #04121f;
                }

                body.light-theme .anti-cheat-dialog-overlay {
                    background: rgba(15, 23, 42, 0.32);
                }
            `;
            document.head.appendChild(style);
        }

        if (this._dialogOverlay && this._dialogOverlay.isConnected) {
            return;
        }

        const overlay = document.createElement('div');
        overlay.className = 'anti-cheat-dialog-overlay';
        overlay.setAttribute('aria-hidden', 'true');

        const dialog = document.createElement('div');
        dialog.className = 'anti-cheat-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'antiCheatDialogTitle');

        const title = document.createElement('h3');
        title.id = 'antiCheatDialogTitle';
        title.className = 'anti-cheat-dialog-title';
        title.textContent = 'Thông báo';

        const message = document.createElement('p');
        message.className = 'anti-cheat-dialog-message';

        const actions = document.createElement('div');
        actions.className = 'anti-cheat-dialog-actions';

        const okButton = document.createElement('button');
        okButton.type = 'button';
        okButton.className = 'anti-cheat-dialog-btn';
        okButton.textContent = 'OK';

        actions.appendChild(okButton);
        dialog.appendChild(title);
        dialog.appendChild(message);
        dialog.appendChild(actions);
        overlay.appendChild(dialog);

        (document.body || document.documentElement).appendChild(overlay);

        this._dialogOverlay = overlay;
        this._dialogMessage = message;
        this._dialogOkButton = okButton;
    }

    openCheatDialog(message) {
        this.ensureCheatDialog();

        return new Promise((resolve) => {
            const closeDialog = () => {
                this._dialogOverlay.classList.remove('is-open');
                this._dialogOverlay.setAttribute('aria-hidden', 'true');
                resolve(true);
            };

            const onEscape = (event) => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    document.removeEventListener('keydown', onEscape, true);
                    closeDialog();
                }
            };

            this._dialogMessage.textContent = message;
            this._dialogOkButton.onclick = () => {
                document.removeEventListener('keydown', onEscape, true);
                closeDialog();
            };

            this._dialogOverlay.classList.add('is-open');
            this._dialogOverlay.setAttribute('aria-hidden', 'false');
            document.addEventListener('keydown', onEscape, true);
            this._dialogOkButton.focus();
        });
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

            if (e.key === 'PrintScreen' ||
                e.key === 'F12' || 
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
                await window.showInAppAlert(message, 'Cảnh báo Anti-Cheat');
            } else {
                await this.openCheatDialog(message);
            }
        } catch (error) {
            console.error('Error showing anti-cheat dialog:', error);
            alert(message);
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
