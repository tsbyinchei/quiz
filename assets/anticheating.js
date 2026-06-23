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
(() => {
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
        this.isPunishing = false;
        this.lastViolationAt = 0;
        this.violationCooldownMs = 1200;
        this.violationLogs = []; // Chứa mảng log vi phạm thay vì gửi trực tiếp
        
        this._tabVisibilityHandler = null;
        this._fullscreenHandler = null;
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

    ensureCheatStyle() {
        if (!document.getElementById('antiCheatDialogStyle')) {
            const style = document.createElement('style');
            style.id = 'antiCheatDialogStyle';
            style.textContent = `
                .anti-cheat-blur {
                    filter: blur(10px) grayscale(100%);
                    pointer-events: none;
                    user-select: none;
                }
                .anti-cheat-toast {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 999999;
                    background: linear-gradient(135deg, #ef4444, #dc2626);
                    color: #fff;
                    padding: 12px 20px;
                    border-radius: 8px;
                    box-shadow: 0 10px 25px rgba(239, 68, 68, 0.4);
                    font-family: inherit;
                    font-weight: 600;
                    font-size: 0.9rem;
                    border-left: 4px solid #7f1d1d;
                    animation: slideInToast 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                @keyframes slideInToast {
                    from { opacity: 0; transform: translateY(-20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes fadeOutToast {
                    from { opacity: 1; transform: translateX(0); }
                    to { opacity: 0; transform: translateX(20px); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    showToastViolation(message) {
        this.ensureCheatStyle();
        
        let container = document.getElementById('antiCheatToastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'antiCheatToastContainer';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 999999;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
            `;
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = 'anti-cheat-toast';
        toast.style.position = 'static'; // Bỏ fixed tĩnh để thả vào Flex Container
        toast.style.pointerEvents = 'auto';
        toast.textContent = message;
        
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'fadeOutToast 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
                if (container.childElementCount === 0) {
                    if (container.parentNode) {
                        container.parentNode.removeChild(container);
                    }
                }
            }, 300);
        }, 3500);
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
        this._selectionStyleElement.id = 'antiCheatSelectionBlocker';
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
            if (!this.enabled || !this.isQuizMode) {
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
        if (!this.enabled || !this.isQuizMode || !this.monitorFullscreenEnabled) {
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
        if (!this.enabled || !this.isQuizMode || !this.monitorTabSwitchEnabled) {
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
        // Disabled by default to avoid spam
    }

    /**
     * Hiển thị alert cảnh báo
     */
    showCheatAlert(message) {
        this.showToastViolation(message);
    }

    /**
     * Xử phạt: Tự động nộp bài với điểm 0
     */
    executePunishment() {
        if (!this.isQuizMode || this.isPunishing) return;

        this.isPunishing = true;
        this.enabled = false;

        this.showToastViolation('❌ Vi phạm quy tắc kiểm tra 3 lần!\nBài thi sẽ tự động nộp với điểm 0.');

        if (typeof window.submitQuiz === 'function') {
            window.submitQuiz(true, true);
        } else {
            console.error("Critical: window.submitQuiz is not defined. Force redirecting.");
            window.location.href = 'dashboard.html';
        }

        // Đã bỏ dòng logCheatViolation('auto_submit_punishment') để tránh trùng lặp log
    }

    /**
     * Ghi log vi phạm lên Backend (GAS)
     */
    logCheatViolation(violationType) {
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

        // Ghi nhận log vào mảng cục bộ thay vì spam network
        this.violationLogs.push(logData);
        console.log('📝 Cheat violation recorded locally:', violationType);
    }

    disable() {
        // [Vulnerability Fix] - Không cho phép vô hiệu hóa từ Console khi đang thi
        if (this.isQuizMode) {
            console.warn('🔒 Action blocked: Cannot disable Anti-Cheat while in Quiz Mode.');
            return;
        }

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

    const instance = new AntiCheat();

    // 1. Facade Pattern & Object.freeze
    const antiCheatFacade = {
        enable: (isQuiz, options) => {
            instance.ensureCheatStyle();
            instance.enable(isQuiz, options);
        },
        disable: () => instance.disable(),
        monitorFullscreen: () => {
            if (instance.enabled && instance.monitorFullscreenEnabled) {
                instance.monitorFullscreen();
            }
        },
        setDialogOpen: (val) => { instance.isDialogOpen = !!val; },
        getViolationLogs: () => [...instance.violationLogs], // Trả về bản sao của mảng log
        get monitorFullscreenEnabled() { return instance.monitorFullscreenEnabled; },
        get isDialogOpen() { return instance.isDialogOpen; }
    };

    Object.freeze(antiCheatFacade);
    window.antiCheat = antiCheatFacade;

    // 2. MutationObserver
    const observer = new MutationObserver((mutations) => {
        if (!instance.enabled) return;
        for (let mutation of mutations) {
            if (mutation.type === 'childList') {
                mutation.removedNodes.forEach(node => {
                    if (node.nodeType === 1 && (
                        node.id === 'antiCheatDialogStyle' || 
                        node.id === 'antiCheatSelectionBlocker' ||
                        node.classList.contains('anti-cheat-dialog-overlay') || 
                        node.classList.contains('anti-cheat-blur'))) {
                        console.error('Security Violation: Core AntiCheat element removed.');
                        window.location.reload();
                    }
                });
            }
            if (mutation.type === 'attributes' && mutation.target.classList) {
                if (mutation.target.classList.contains('anti-cheat-blur')) {
                    const style = mutation.target.getAttribute('style') || '';
                    if (style.replace(/\s+/g, '').includes('filter:none') || style.replace(/\s+/g, '').includes('display:none')) {
                        console.error('Security Violation: AntiCheat style bypassed.');
                        window.location.reload();
                    }
                }
            }
        }
    });
    
    // Đảm bảo DOM đã sẵn sàng trước khi observe toàn bộ Document
    if (document.documentElement) {
        observer.observe(document.documentElement, { 
            childList: true, 
            subtree: true, 
            attributes: true, 
            attributeFilter: ['style', 'class'] 
        });
    }

    // 3. Debugger Trap & CSSOM Observer
    setInterval(() => {
        if (!instance.enabled || !instance.isQuizMode) return;
        
        // Kiểm tra CSSOM: Thẻ style chặn bôi đen có bị hacker disable không?
        const blockStyle = document.getElementById('antiCheatSelectionBlocker');
        if (blockStyle && blockStyle.sheet && blockStyle.sheet.disabled) {
            console.error('Security Violation: Selection Blocker CSSOM disabled.');
            window.location.reload();
        }

        const start = performance.now();
        
        // Trap DevTools
        (function() { debugger; })(); 
        
        const end = performance.now();
        
        if (end - start > 1000) {
            console.warn("DevTools detected via Timing Analysis!");
            instance.cheatCount++;
            
            if (instance.cheatCount >= instance.maxCheatAttempts) {
                instance.executePunishment();
            } else {
                instance.showCheatAlert(
                    `⚠️ Cảnh báo!\n\nPhát hiện công cụ dành cho nhà phát triển (DevTools).\n\nVi phạm lần ${instance.cheatCount}/${instance.maxCheatAttempts}.\n\nNếu tiếp tục sẽ bị khóa bài thi!`
                );
            }
            instance.logCheatViolation('devtools_timing_analysis');
        }
    }, 2000);

})();
