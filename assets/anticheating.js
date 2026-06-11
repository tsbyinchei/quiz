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
        this.monitorTabSwitchEnabled = false;
        this.monitorFullscreenEnabled = false;
        this.quizStartTime = null;
        this.isDialogOpen = false; 
        this.isAntiCheatDialogOpen = false; 
        this.isPunishing = false;
        this.lastViolationAt = 0;
        this.violationCooldownMs = 1200;
        this._tabVisibilityHandler = null;
        this._fullscreenHandler = null;
        this._dialogOverlay = null;
        this._dialogMessage = null;
        this._dialogOkButton = null;
        this._keyboardHandler = null;
        this._contextMenuHandler = null;
        this._mouseDownHandler = null;
        this._mouseUpHandler = null;
        this._copyHandler = null;
        this._cutHandler = null;
        this._pasteHandler = null;
        this._selectStartHandler = null;
        this._multiClickBlockHandler = null;
        this._selectionStyleElement = null;
    }

    getDialogHostElement() {
        return (
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement ||
            document.body ||
            document.documentElement
        );
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
                    border: 1px solid rgba(248, 113, 113, 0.5);
                    background: color-mix(in srgb, #ef4444 6%, var(--surface, rgba(10, 28, 48, 0.9)));
                    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.28), 0 0 40px rgba(239, 68, 68, 0.15);
                    padding: 1.2rem 1.2rem 1rem;
                    color: var(--text, #eef3ff);
                    font-family: inherit;
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
                    font-weight: 700;
                    font-family: inherit;
                    background: linear-gradient(135deg, #f87171, #ef4444);
                    color: #fff;
                }

                body.light-theme .anti-cheat-dialog-overlay {
                    background: rgba(15, 23, 42, 0.32);
                }

                .anti-cheat-blur {
                    filter: blur(10px) grayscale(100%);
                    pointer-events: none;
                    user-select: none;
                }
            `;
            document.head.appendChild(style);
        }

        if (this._blurHandler) {
            window.removeEventListener('blur', this._blurHandler);
            window.removeEventListener('focus', this._focusHandler);
        }
        document.body.classList.remove('anti-cheat-blur');
        
        if (this._dialogOverlay && this._dialogOverlay.isConnected) {
            const host = this.getDialogHostElement();
            if (host && this._dialogOverlay.parentElement !== host) {
                host.appendChild(this._dialogOverlay);
            }
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

        this.getDialogHostElement().appendChild(overlay);

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
     * Khởi động Anti-Cheat cho trang login/quiz.
     *
     * Backward compatibility:
     * - enable(true, true)  => bật tab + fullscreen
     * - enable(true, false) => chỉ chặn keyboard/mouse/copy (không monitor tab/fullscreen)
     *
     * New mode:
     * - enable(true, { tabSwitch: true|false, fullscreen: true|false })
     */
    enable(isQuiz = false, strictModeOrOptions = true) {
        this.disable();

        this.enabled = true;
        this.isQuizMode = isQuiz;
        this.cheatCount = 0;

        let tabSwitch = false;
        let fullscreen = false;

        if (typeof strictModeOrOptions === 'object' && strictModeOrOptions !== null) {
            tabSwitch = !!strictModeOrOptions.tabSwitch;
            fullscreen = !!strictModeOrOptions.fullscreen;
        } else {
            const strictMode = !!strictModeOrOptions;
            tabSwitch = !!(isQuiz && strictMode);
            fullscreen = !!(isQuiz && strictMode);
        }

        this.monitorTabSwitchEnabled = !!(isQuiz && tabSwitch);
        this.monitorFullscreenEnabled = !!(isQuiz && fullscreen);

        // Luôn chặn DevTools, clipboard, mouse interactions, text selection
        this.blockKeyboardShortcuts();
        this.blockMouseInteractions();
        this.blockTextSelection();
        this.monitorWindowFocus();
        
        if (this.monitorTabSwitchEnabled) {
            this.monitorTabVisibility();
            this.quizStartTime = Date.now();
        }

        if (this.monitorFullscreenEnabled) {
            this.monitorFullscreen();
        }

        let mode = 'BASIC (DevTools/Clipboard Only)';
        if (this.monitorTabSwitchEnabled && this.monitorFullscreenEnabled) {
            mode = 'STRICT (Tab + Fullscreen Monitoring)';
        } else if (this.monitorTabSwitchEnabled) {
            mode = 'TAB ONLY (Tab Monitoring)';
        } else if (this.monitorFullscreenEnabled) {
            mode = 'FULLSCREEN ONLY (Fullscreen Monitoring)';
        }

        console.log(`🛡️ Anti-Cheat Module Activated - ${mode}`);
    }

    /**
     * 1. Chặn Phím tắt & Trình duyệt
     */
    blockKeyboardShortcuts() {
        if (this._keyboardHandler) {
            document.removeEventListener('keydown', this._keyboardHandler);
        }

        this._keyboardHandler = (e) => {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const ctrlKey = isMac ? e.metaKey : e.ctrlKey;
            const key = e.key.toLowerCase(); // Chuyển về chữ thường để so sánh chuẩn xác

            // Phân rã logic để dễ bảo trì và tối ưu hiệu suất đọc
            const isPrintScreen = key === 'printscreen' || key === 'os'; 
            const isF12 = key === 'f12';
            const isDevTools = ctrlKey && e.shiftKey && (key === 'i' || key === 'j');
            const isBrowserShortcuts = ctrlKey && !e.shiftKey && ['u', 's', 'p', 'c', 'x', 'v'].includes(key);
            
            // Bắt sự kiện chụp màn hình OS (Chỉ hiện cảnh báo, không thể chặn OS chụp ảnh)
            const isWinSnip = e.metaKey && e.shiftKey && key === 's'; // Win + Shift + S
            const isMacSnip = isMac && e.metaKey && e.shiftKey && ['3', '4', '5'].includes(key); // Cmd + Shift + 3/4/5

            if (isPrintScreen || isF12 || isDevTools || isBrowserShortcuts || isWinSnip || isMacSnip) {
                e.preventDefault();
                this.triggerCheatWarning();
                return false;
            }
        };

        document.addEventListener('keydown', this._keyboardHandler);
    }

    /**
     * Chống chụp màn hình bằng cách làm mờ giao diện khi mất focus
     */
    monitorWindowFocus() {
        if (this._blurHandler) {
            window.removeEventListener('blur', this._blurHandler);
            window.removeEventListener('focus', this._focusHandler);
        }

        this._blurHandler = () => {
            if (!this.enabled || !this.isQuizMode) return;
            // Làm mờ toàn bộ body để chống Sniping Tool / Screenshot shortcuts
            document.body.classList.add('anti-cheat-blur');
        };

        this._focusHandler = () => {
            if (!this.enabled || !this.isQuizMode) return;
            document.body.classList.remove('anti-cheat-blur');
        };

        window.addEventListener('blur', this._blurHandler);
        window.addEventListener('focus', this._focusHandler);
    }

    /**
     * 2. Chặn Tương tác Chuột & Sao chép
     */
    blockMouseInteractions() {
        this._contextMenuHandler = (e) => {
            e.preventDefault();
            this.triggerCheatWarning();
            return false;
        };

        this._mouseDownHandler = (e) => {
            if (e.button === 2) {
                e.preventDefault();
                this.triggerCheatWarning();
                return false;
            }
        };

        this._mouseUpHandler = (e) => {
            if (e.button === 2) {
                e.preventDefault();
                return false;
            }
        };

        this._copyHandler = (e) => {
            e.preventDefault();
            this.triggerCheatWarning();
            return false;
        };

        this._cutHandler = (e) => {
            e.preventDefault();
            this.triggerCheatWarning();
            return false;
        };

        this._pasteHandler = (e) => {
            e.preventDefault();
            this.triggerCheatWarning();
            return false;
        };

        document.addEventListener('contextmenu', this._contextMenuHandler);
        document.addEventListener('mousedown', this._mouseDownHandler);
        document.addEventListener('mouseup', this._mouseUpHandler);
        document.addEventListener('copy', this._copyHandler);
        document.addEventListener('cut', this._cutHandler);
        document.addEventListener('paste', this._pasteHandler);
    }

    /**
     * 3. Chặn Text Selection & Bôi đen
     */
    blockTextSelection() {
        this._selectStartHandler = (e) => {
            e.preventDefault();
            return false;
        };

        document.addEventListener('selectstart', this._selectStartHandler);

        if (this._selectionStyleElement && this._selectionStyleElement.isConnected) {
            this._selectionStyleElement.remove();
        }

        this._selectionStyleElement = document.createElement('style');
        this._selectionStyleElement.textContent = `
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
        document.head.appendChild(this._selectionStyleElement);

        this._multiClickBlockHandler = (e) => {
            if (e.detail > 1) {
                e.preventDefault();
            }
        };

        document.addEventListener('mousedown', this._multiClickBlockHandler);
    }

    removeProtectionListeners() {
        if (this._keyboardHandler) {
            document.removeEventListener('keydown', this._keyboardHandler);
            this._keyboardHandler = null;
        }

        if (this._contextMenuHandler) {
            document.removeEventListener('contextmenu', this._contextMenuHandler);
            this._contextMenuHandler = null;
        }

        if (this._mouseDownHandler) {
            document.removeEventListener('mousedown', this._mouseDownHandler);
            this._mouseDownHandler = null;
        }

        if (this._mouseUpHandler) {
            document.removeEventListener('mouseup', this._mouseUpHandler);
            this._mouseUpHandler = null;
        }

        if (this._copyHandler) {
            document.removeEventListener('copy', this._copyHandler);
            this._copyHandler = null;
        }

        if (this._cutHandler) {
            document.removeEventListener('cut', this._cutHandler);
            this._cutHandler = null;
        }

        if (this._pasteHandler) {
            document.removeEventListener('paste', this._pasteHandler);
            this._pasteHandler = null;
        }

        if (this._selectStartHandler) {
            document.removeEventListener('selectstart', this._selectStartHandler);
            this._selectStartHandler = null;
        }

        if (this._multiClickBlockHandler) {
            document.removeEventListener('mousedown', this._multiClickBlockHandler);
            this._multiClickBlockHandler = null;
        }

        if (this._selectionStyleElement && this._selectionStyleElement.isConnected) {
            this._selectionStyleElement.remove();
        }
        this._selectionStyleElement = null;
    }

    /**
     * 4. Giám sát Chuyển Tab (Page Visibility API)
     */
    monitorTabVisibility() {
        this._tabVisibilityHandler = () => {
            if (!this.enabled || !this.isQuizMode || this.isAntiCheatDialogOpen) {
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
     * 5. Giám sát Fullscreen (Fullscreen API)
     */
    monitorFullscreen() {
        if (this._fullscreenHandler) {
            document.removeEventListener('fullscreenchange', this._fullscreenHandler);
            document.removeEventListener('webkitfullscreenchange', this._fullscreenHandler);
            document.removeEventListener('mozfullscreenchange', this._fullscreenHandler);
            document.removeEventListener('MSFullscreenChange', this._fullscreenHandler);
        }

        this._fullscreenHandler = () => {
            if (!this.enabled || !this.isQuizMode) {
                return;
            }

            // Check if not in fullscreen (user exited fullscreen)
            const isCurrentlyFullscreen = !!(document.fullscreenElement || 
                                             document.webkitFullscreenElement || 
                                             document.mozFullScreenElement || 
                                             document.msFullscreenElement);

            if (!isCurrentlyFullscreen && this.isQuizMode) {
                const now = Date.now();
                if (now - this.lastViolationAt < this.violationCooldownMs) {
                    return;
                }
                this.lastViolationAt = now;
                this.handleFullscreenExit();
            }
        };

        document.addEventListener('fullscreenchange', this._fullscreenHandler);
        document.addEventListener('webkitfullscreenchange', this._fullscreenHandler);
        document.addEventListener('mozfullscreenchange', this._fullscreenHandler);
        document.addEventListener('MSFullscreenChange', this._fullscreenHandler);
    }

    /**
     * Xử lý khi user thoát fullscreen
     */
    async handleFullscreenExit() {
        if (!this.enabled || !this.isQuizMode || !this.monitorFullscreenEnabled || this.isAntiCheatDialogOpen) {
            return;
        }

        this.cheatCount++;
        
        if (this.cheatCount < this.maxCheatAttempts) {
            await this.showCheatAlert(
                `⚠️ Cảnh báo!\n\nBạn đã thoát chế độ toàn màn hình.\n\nVi phạm lần ${this.cheatCount}/${this.maxCheatAttempts}.\n\nNếu tiếp tục sẽ bị khóa bài thi!`
            );
            
            // Show fullscreen prompt to user to re-enter
            if (typeof showFullscreenButton !== 'undefined') {
                showFullscreenButton();
            }
        } else {
            await this.executePunishment();
        }

        this.logCheatViolation('fullscreen_exit');
    }

    /**
     * Xử lý khi user chuyển tab
     */
    async handleTabSwitch() {
        if (!this.enabled || !this.isQuizMode || !this.monitorTabSwitchEnabled || this.isAntiCheatDialogOpen) {
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
        if (this.isAntiCheatDialogOpen) {
            return;
        }

        // this.showCheatAlert(
        //     '🚫 Hành động này bị cấm!\n\nVui lòng không cố gắng sử dụng DevTools, right-click hoặc copy dữ liệu.'
        // );
    }

    /**
     * Hiển thị alert cảnh báo
     */
    async showCheatAlert(message) {
        this.isAntiCheatDialogOpen = true;

        try {
            await this.openCheatDialog(message);
        } catch (error) {
            console.error('Error showing anti-cheat dialog:', error);
            alert(message);
        } finally {
            this.isAntiCheatDialogOpen = false;
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
                        token: (typeof AuthManager !== 'undefined' && AuthManager.getToken)
                            ? AuthManager.getToken()
                            : (typeof sessionStorage !== 'undefined'
                                ? sessionStorage.getItem('quizToken')
                                : localStorage.getItem('quizToken')),
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
        this.removeProtectionListeners();

        if (this._tabVisibilityHandler) {
            document.removeEventListener('visibilitychange', this._tabVisibilityHandler);
            window.removeEventListener('blur', this._tabVisibilityHandler);
            this._tabVisibilityHandler = null;
        }

        if (this._fullscreenHandler) {
            document.removeEventListener('fullscreenchange', this._fullscreenHandler);
            document.removeEventListener('webkitfullscreenchange', this._fullscreenHandler);
            document.removeEventListener('mozfullscreenchange', this._fullscreenHandler);
            document.removeEventListener('MSFullscreenChange', this._fullscreenHandler);
            this._fullscreenHandler = null;
        }

        this.enabled = false;
        this.isQuizMode = false;
        this.monitorTabSwitchEnabled = false;
        this.monitorFullscreenEnabled = false;
        this.isAntiCheatDialogOpen = false;
        this.isDialogOpen = false;
        this.isPunishing = false;
        console.log('🔓 Anti-Cheat Module Disabled');
    }
}

// Global instance
window.antiCheat = new AntiCheat();
