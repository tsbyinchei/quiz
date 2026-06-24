/**
 * ==================== ADVANCED ANTI-CHEAT MODULE ====================
 * Cơ chế bảo mật client-side cho login.html & quiz.html
 * 
 * Features:
 * - Chặn phím tắt devtools (F12, Ctrl+Shift+I, Ctrl+U, v.v.)
 * - Chặn chuột phải, copy/paste, text selection
 * - Giám sát chuyển tab với Page Visibility API
 * - Mã hóa trạng thái Session Storage bằng Checksum (Salt động) chống Tampering
 * - Ngăn chặn Bypass qua Race Condition (khi tải lại trang)
 * - Tối ưu hóa mờ giao diện an toàn (phòng vệ OS-level Screen Capture)
 */
(() => {
    // 1. Lexical Scope Caching (Anti Monkey-patching)
    const originalPerformance = window.performance;
    const safePerformanceNow = (originalPerformance && typeof originalPerformance.now === 'function')
        ? originalPerformance.now.bind(originalPerformance)
        : () => Date.now();

    const NativeMutationObserver = window.MutationObserver || window.WebKitMutationObserver;

    const originalSessionGet = window.sessionStorage.getItem.bind(window.sessionStorage);
    const originalSessionSet = window.sessionStorage.setItem.bind(window.sessionStorage);
    const originalSessionRemove = window.sessionStorage.removeItem.bind(window.sessionStorage);
    const originalLocalGet = window.localStorage.getItem.bind(window.localStorage);

    class AdvancedAntiCheat {
        constructor() {
            this.enabled = false;
            this.maxCheatAttempts = 3;
            this.isQuizMode = false;
            this.monitorTabSwitchEnabled = false;
            this.monitorFullscreenEnabled = false;
            this.quizStartTime = null;

            // State
            this.username = null;
            this.quizID = null;
            this.storageKey = null;
            this.isReloading = false;
            this.isPunishing = false;

            this.violationCooldownMs = 1200;
            this.lastViolationAt = 0;

            // Event handler references for cleanup
            this._tabVisibilityHandler = null;
            this._fullscreenHandler = null;
            this._keyboardHandler = null;
            this._beforeUnloadHandler = null;
            this._contextMenuHandler = null;
            this._mouseDownHandler = null;
            this._mouseUpHandler = null;
            this._copyHandler = null;
            this._cutHandler = null;
            this._pasteHandler = null;
            this._selectStartHandler = null;
            this._multiClickBlockHandler = null;
            this._selectionStyleElement = null;
            this._blurHandler = null;
            this._focusHandler = null;
            this._devToolsInterval = null;
            this._observer = null;
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
            toast.style.position = 'static';
            toast.style.pointerEvents = 'auto';
            toast.textContent = message;

            container.appendChild(toast);

            setTimeout(() => {
                toast.style.animation = 'fadeOutToast 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
                setTimeout(() => {
                    if (toast.parentNode) toast.parentNode.removeChild(toast);
                    if (container.childElementCount === 0 && container.parentNode) {
                        container.parentNode.removeChild(container);
                    }
                }, 300);
            }, 3500);
        }

        generateChecksum(count, logsArray) {
            const dynamicSalt = `${this.username}_${this.quizID}_BME_PROTECT`;
            const logsString = JSON.stringify(logsArray);
            const rawString = `${count}|${logsString}|${dynamicSalt}`;

            let hash = 0;
            for (let i = 0; i < rawString.length; i++) {
                const chr = rawString.charCodeAt(i);
                hash = ((hash << 5) - hash) + chr;
                hash |= 0;
            }
            return (hash >>> 0).toString(16);
        }

        initSessionState() {
            this.username = originalLocalGet('quizUsername') || 'anonymous';
            this.quizID = originalLocalGet('currentQuizID') || 'default';
            this.storageKey = `antiCheatData_${this.quizID}`;

            let isPageReload = false;
            if (originalPerformance && typeof originalPerformance.getEntriesByType === 'function') {
                const navEntries = originalPerformance.getEntriesByType('navigation');
                if (navEntries.length > 0 && navEntries[0].type === 'reload') {
                    isPageReload = true;
                }
            } else if (originalPerformance && originalPerformance.navigation) {
                if (originalPerformance.navigation.type === 1) {
                    isPageReload = true;
                }
            }

            const rawData = originalSessionGet(this.storageKey);

            if (isPageReload) {
                if (!rawData) {
                    console.error("Tamper Detected: Storage cleared on reload!");
                    this.executePunishment("storage_cleared_on_reload");
                    return;
                }

                try {
                    const state = JSON.parse(rawData);
                    const expectedChecksum = this.generateChecksum(state.count, state.logs);

                    if (state.checksum !== expectedChecksum) {
                        console.error("Tamper Detected: Checksum mismatch!");
                        this.executePunishment("storage_checksum_mismatch");
                        return;
                    }
                    console.log("🛡️ State successfully restored and verified.");
                } catch (e) {
                    console.error("Tamper Detected: Corrupted JSON data!");
                    this.executePunishment("storage_corrupted");
                    return;
                }
            } else {
                this.saveState(0, []);
            }
        }

        saveState(count, logs) {
            const checksum = this.generateChecksum(count, logs);
            const stateData = { count, logs, started: true, checksum };
            originalSessionSet(this.storageKey, JSON.stringify(stateData));
        }

        getState() {
            try {
                const raw = originalSessionGet(this.storageKey);
                if (!raw) return { count: 0, logs: [] };
                return JSON.parse(raw);
            } catch (e) {
                return { count: 0, logs: [] };
            }
        }

        enable(isQuiz = false, strictModeOrOptions = true) {
            this.disable();

            this.enabled = true;
            this.isQuizMode = isQuiz;
            this.isReloading = false;

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

            if (this.isQuizMode) {
                this.initSessionState();
                if (!this.enabled) return; // Bị phạt ngay trong initSessionState
            }

            this.blockKeyboardShortcuts();
            this.blockMouseInteractions();
            this.blockTextSelection();
            this.monitorWindowFocus();

            if (this.isQuizMode) {
                this.initPageLeaveProtection();
                this.initDevToolsTrap();
                this.initMutationObserver();
            }

            if (this.monitorTabSwitchEnabled) {
                this.monitorTabVisibility();
                this.quizStartTime = Date.now();
            }

            if (this.monitorFullscreenEnabled) {
                this.monitorFullscreen();
            }

            let mode = 'BASIC';
            if (this.monitorTabSwitchEnabled && this.monitorFullscreenEnabled) mode = 'STRICT';
            else if (this.monitorTabSwitchEnabled) mode = 'TAB ONLY';
            else if (this.monitorFullscreenEnabled) mode = 'FULLSCREEN ONLY';

            console.log(`🛡️ Advanced Anti-Cheat Activated - ${mode}`);
        }

        blockKeyboardShortcuts() {
            if (this._keyboardHandler) {
                document.removeEventListener('keydown', this._keyboardHandler, true);
            }

            const blockedKeys = new Set(['u', 's', 'p', 'c', 'x', 'v', 'i', 'j']);

            this._keyboardHandler = (e) => {
                if (!this.enabled) return;

                const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
                const ctrlKey = isMac ? e.metaKey : e.ctrlKey;
                const key = e.key.toLowerCase();

                const isPrintScreen = key === 'printscreen' || key === 'os';
                const isF12 = key === 'f12';
                const isDevTools = ctrlKey && e.shiftKey && (key === 'i' || key === 'j');
                const isBrowserShortcuts = ctrlKey && !e.shiftKey && blockedKeys.has(key);
                const isWinSnip = e.metaKey && e.shiftKey && key === 's';
                const isMacSnip = isMac && e.metaKey && e.shiftKey && ['3', '4', '5'].includes(key);

                if (isPrintScreen || isF12 || isDevTools || isBrowserShortcuts || isWinSnip || isMacSnip) {
                    e.preventDefault();
                    e.stopPropagation();

                    // Defense in depth for screenshot shortcuts
                    if (isPrintScreen || isWinSnip || isMacSnip) {
                        document.body.classList.add('anti-cheat-blur');
                        setTimeout(() => {
                            if (document.hasFocus()) {
                                document.body.classList.remove('anti-cheat-blur');
                            }
                        }, 2000);
                    }
                    return false;
                }

                // Chặn Reload F5, Ctrl+R, Cmd+R và kích hoạt cờ Race Condition
                if (key === 'f5' || (ctrlKey && key === 'r')) {
                    this.isReloading = true;
                    this.triggerCancelReloadDetector();
                }
            };

            // Sử dụng Capture phase để chặn sớm nhất
            document.addEventListener('keydown', this._keyboardHandler, true);
        }

        initPageLeaveProtection() {
            if (this._beforeUnloadHandler) {
                window.removeEventListener('beforeunload', this._beforeUnloadHandler);
            }

            this._beforeUnloadHandler = (e) => {
                if (!this.enabled || !this.isQuizMode) return;

                this.isReloading = true;
                this.triggerCancelReloadDetector();

                e.preventDefault();
                e.returnValue = 'Hành vi rời trang sẽ bị lưu vết.';
                return e.returnValue;
            };

            window.addEventListener('beforeunload', this._beforeUnloadHandler);
        }

        triggerCancelReloadDetector() {
            setTimeout(() => {
                this.isReloading = false;
            }, 1000);
        }

        monitorWindowFocus() {
            if (this._blurHandler) {
                window.removeEventListener('blur', this._blurHandler);
                window.removeEventListener('focus', this._focusHandler);
            }

            this._blurHandler = () => {
                if (!this.enabled || !this.isQuizMode || this.isReloading) return;
                // Chỉ làm mờ, KHÔNG đếm vi phạm (tránh False Positive từ hộp thoại trình duyệt)
                document.body.classList.add('anti-cheat-blur');
            };

            this._focusHandler = () => {
                if (!this.enabled || !this.isQuizMode) return;
                document.body.classList.remove('anti-cheat-blur');
            };

            window.addEventListener('blur', this._blurHandler);
            window.addEventListener('focus', this._focusHandler);
        }

        monitorTabVisibility() {
            if (this._tabVisibilityHandler) {
                document.removeEventListener('visibilitychange', this._tabVisibilityHandler);
            }

            this._tabVisibilityHandler = () => {
                if (!this.enabled || !this.isQuizMode || !this.monitorTabSwitchEnabled || this.isReloading) {
                    return;
                }

                // visibilitychange với hidden = true xác định chính xác hành vi chuyển tab
                if (document.hidden) {
                    const now = Date.now();
                    if (now - this.lastViolationAt < this.violationCooldownMs) return;
                    this.lastViolationAt = now;

                    this.handleViolation('tab_switch');
                }
            };

            document.addEventListener('visibilitychange', this._tabVisibilityHandler);
        }

        monitorFullscreen() {
            if (this._fullscreenHandler) {
                document.removeEventListener('fullscreenchange', this._fullscreenHandler);
                document.removeEventListener('webkitfullscreenchange', this._fullscreenHandler);
                document.removeEventListener('mozfullscreenchange', this._fullscreenHandler);
                document.removeEventListener('MSFullscreenChange', this._fullscreenHandler);
            }

            this._fullscreenHandler = () => {
                if (!this.enabled || !this.isQuizMode || !this.monitorFullscreenEnabled || this.isReloading) {
                    return;
                }

                const isCurrentlyFullscreen = !!(document.fullscreenElement ||
                    document.webkitFullscreenElement ||
                    document.mozFullScreenElement ||
                    document.msFullscreenElement);

                if (!isCurrentlyFullscreen) {
                    const now = Date.now();
                    if (now - this.lastViolationAt < this.violationCooldownMs) return;
                    this.lastViolationAt = now;

                    this.handleViolation('fullscreen_exit');

                    if (typeof showFullscreenButton !== 'undefined') {
                        showFullscreenButton();
                    }
                }
            };

            document.addEventListener('fullscreenchange', this._fullscreenHandler);
            document.addEventListener('webkitfullscreenchange', this._fullscreenHandler);
            document.addEventListener('mozfullscreenchange', this._fullscreenHandler);
            document.addEventListener('MSFullscreenChange', this._fullscreenHandler);
        }

        handleViolation(type) {
            const state = this.getState();
            state.count++;
            state.logs.push({
                type,
                time: new Date().toISOString(),
                userAgent: navigator.userAgent
            });

            this.saveState(state.count, state.logs);

            // Gửi log trực tiếp về máy chủ để phòng ngừa thao túng Client-side
            if (typeof window !== 'undefined' && window.APIClient && typeof window.APIClient.logCheatViolation === 'function') {
                window.APIClient.logCheatViolation({
                    quizID: this.quizID,
                    violationType: type,
                    cheatCount: state.count,
                    userAgent: navigator.userAgent
                }).catch(err => console.warn('AntiCheat API log err:', err));
            }

            if (state.count >= this.maxCheatAttempts) {
                this.executePunishment("max_violations_exceeded");
            } else {
                let msg = `⚠️ Cảnh báo!\n\nBạn đã vi phạm quy định làm bài (${type === 'tab_switch' ? 'rời màn hình' : 'thoát toàn màn hình' || 'hành vi cấm'}).\n\nVi phạm lần ${state.count}/${this.maxCheatAttempts}.\n\nNếu tiếp tục sẽ bị khóa bài thi!`;
                this.showToastViolation(msg);
            }
        }

        executePunishment(reason = "max_violations_exceeded") {
            if (this.isPunishing) return;
            this.isPunishing = true;
            this.enabled = false;

            console.error(`❌ Automatic Punishment Triggered. Reason: ${reason}`);
            this.showToastViolation('❌ Phát hiện vi phạm nghiêm trọng!\nBài thi sẽ tự động nộp với điểm 0.');

            if (typeof window.submitQuiz === 'function') {
                window.submitQuiz(true, true);
            } else {
                window.location.replace('dashboard.html');
            }
        }

        initDevToolsTrap() {
            if (this._devToolsInterval) clearInterval(this._devToolsInterval);

            this._devToolsInterval = setInterval(() => {
                if (!this.enabled || !this.isQuizMode || this.isReloading) return;

                const start = safePerformanceNow();
                (() => { debugger; })();
                const end = safePerformanceNow();

                if (end - start > 100) {
                    const now = Date.now();
                    if (now - this.lastViolationAt < this.violationCooldownMs) return;
                    this.lastViolationAt = now;

                    this.handleViolation('devtools_detected');
                }
            }, 1500);
        }

        initMutationObserver() {
            if (this._observer) {
                this._observer.disconnect();
            }

            if (!NativeMutationObserver) return;

            this._observer = new NativeMutationObserver((mutations) => {
                if (!this.enabled) return;
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

            if (document.documentElement) {
                this._observer.observe(document.documentElement, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['style', 'class']
                });
            }
        }

        blockMouseInteractions() {
            this._contextMenuHandler = (e) => {
                e.preventDefault();
                return false;
            };

            this._mouseDownHandler = (e) => {
                if (e.button === 2) {
                    e.preventDefault();
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
                return false;
            };

            this._cutHandler = (e) => {
                e.preventDefault();
                return false;
            };

            this._pasteHandler = (e) => {
                e.preventDefault();
                return false;
            };

            document.addEventListener('contextmenu', this._contextMenuHandler);
            document.addEventListener('mousedown', this._mouseDownHandler);
            document.addEventListener('mouseup', this._mouseUpHandler);
            document.addEventListener('copy', this._copyHandler);
            document.addEventListener('cut', this._cutHandler);
            document.addEventListener('paste', this._pasteHandler);
        }

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
                document.removeEventListener('keydown', this._keyboardHandler, true);
                this._keyboardHandler = null;
            }
            if (this._beforeUnloadHandler) {
                window.removeEventListener('beforeunload', this._beforeUnloadHandler);
                this._beforeUnloadHandler = null;
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
            if (this._devToolsInterval) {
                clearInterval(this._devToolsInterval);
                this._devToolsInterval = null;
            }
            if (this._observer) {
                this._observer.disconnect();
                this._observer = null;
            }
        }

        disable() {
            if (this.isQuizMode && !this.isPunishing) {
                console.warn('🔒 Action blocked: Cannot disable Anti-Cheat while in Quiz Mode.');
                return;
            }

            this.removeProtectionListeners();

            if (this._tabVisibilityHandler) {
                document.removeEventListener('visibilitychange', this._tabVisibilityHandler);
                this._tabVisibilityHandler = null;
            }

            if (this._blurHandler) {
                window.removeEventListener('blur', this._blurHandler);
                window.removeEventListener('focus', this._focusHandler);
                this._blurHandler = null;
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
            this.isPunishing = false;
            this.isReloading = false;
            console.log('🔓 Advanced Anti-Cheat Module Disabled');
        }
    }

    const instance = new AdvancedAntiCheat();

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
        getViolationLogs: () => {
            const state = instance.getState();
            return Array.isArray(state.logs) ? [...state.logs] : [];
        },
        clearState: () => {
            if (instance.storageKey) {
                originalSessionRemove(instance.storageKey);
            }
        },
        set isDialogOpen(val) { instance.isReloading = !!val; }, 
        get isDialogOpen() { return instance.isReloading; },
        get monitorFullscreenEnabled() { return instance.monitorFullscreenEnabled; },
        get isPunishing() { return instance.isPunishing; }
    };

    Object.freeze(antiCheatFacade);
    window.antiCheat = antiCheatFacade;
})();
