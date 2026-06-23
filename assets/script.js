/**
 * Quiz Lab - Core JavaScript Module
 * Cung cấp logic cơ bản cho hệ thống Quiz
 * 
 * Features:
 * - SHA-256 Hashing cho bảo mật đáp án
 * - Authentication & Token Management
 * - Quiz Grading Logic (Hybrid)
 * - Aiken Format Parser
 */

/**
 * ==================== SHA-256 HASHING ====================
 * Sử dụng Web Crypto API cho hashing đáp án
 */

async function sha256(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

const QUIZ_PASSWORD_SALT = 'TsByinChei';

async function hashPasswordWithSalt(password) {
    return sha256(`${String(password || '')}${QUIZ_PASSWORD_SALT}`);
}

/**
 * ==================== AUTHENTICATION ====================
 */

class AuthManager {
    static getToken() {
        const sessionToken = typeof sessionStorage !== 'undefined'
            ? sessionStorage.getItem('quizToken')
            : null;

        if (sessionToken) {
            return sessionToken;
        }

        return localStorage.getItem('quizToken');
    }

    static getDecodedToken() {
        const token = this.getToken();
        if (!token || token.indexOf('.') === -1) {
            return null;
        }

        try {
            const payloadB64 = token.split('.')[0];
            return JSON.parse(atob(payloadB64));
        } catch (error) {
            return null;
        }
    }

    static getRole() {
        const decoded = this.getDecodedToken();
        return decoded ? decoded.role : null;
    }

    static getUsername() {
        const decoded = this.getDecodedToken();
        return decoded ? decoded.username : null;
    }

    static getFullName() {
        return localStorage.getItem('quizFullName') || '';
    }

    static isAuthenticated() {
        return !!this.getDecodedToken();
    }

    static isAdmin() {
        return this.getRole() === 'Admin';
    }

    static setAuth(token, role, username, fullName = '') {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('quizToken', token);
        }
        localStorage.setItem('quizToken', token);
        localStorage.setItem('quizRole', role);
        localStorage.setItem('quizUsername', username);
        localStorage.setItem('quizFullName', String(fullName || ''));
    }

    static clearAuth() {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('quizToken');
        }
        localStorage.removeItem('quizToken');
        localStorage.removeItem('quizRole');
        localStorage.removeItem('quizUsername');
        localStorage.removeItem('quizFullName');
        localStorage.removeItem('currentQuizID');
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('adminPinVerified');
            sessionStorage.removeItem('adminPinVerifiedFor');
            sessionStorage.removeItem('adminPinProof');
        }
    }

    static syncSessionTokenFromLocal() {
        if (typeof sessionStorage === 'undefined') {
            return;
        }

        const localToken = localStorage.getItem('quizToken');
        if (localToken) {
            sessionStorage.setItem('quizToken', localToken);
            return;
        }

        sessionStorage.removeItem('quizToken');
    }

    static initStorageSync() {
        this.syncSessionTokenFromLocal();

        if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
            return;
        }

        window.addEventListener('storage', (event) => {
            if (event.key !== 'quizToken') {
                return;
            }

            if (typeof sessionStorage !== 'undefined') {
                if (event.newValue) {
                    sessionStorage.setItem('quizToken', event.newValue);
                } else {
                    sessionStorage.removeItem('quizToken');
                    sessionStorage.removeItem('adminPinVerified');
                    sessionStorage.removeItem('adminPinVerifiedFor');
                    sessionStorage.removeItem('adminPinProof');
                }
            }
        });
    }
}

AuthManager.initStorageSync();

/**
 * ==================== QUIZ GRADING LOGIC ====================
 * Hybrid Grading: Client-side validation + Server-side verification
 */

class GradingEngine {
    /**
     * Validasi đáp án cục bộ (chế độ luyện tập)
     * @param {string} questionID - ID câu hỏi
     * @param {string} userAnswer - Đáp án của user (A/B/C/D)
     * @param {string} answerHash - Hash từ server
     * @returns {Promise<boolean>} True nếu đúng
     */
    static async validateAnswer(quizID, questionID, userAnswer) {
        if (!quizID || !questionID || !userAnswer) {
            return false;
        }

        const result = await APIClient.verifyAnswer(quizID, questionID, userAnswer);
        return !!(result && result.success && result.correct);
    }

    /**
     * Tính điểm hoàn chỉnh
     * @param {Array} questions - Danh sách câu hỏi
     * @param {Object} userAnswers - Đáp án của user
     * @returns {Promise<Object>} {score, correct, total}
     */
    static async calculateScore(quizID, questions, userAnswers) {
        let correct = 0;

        for (const question of questions) {
            const qId = question.questionID;
            const userAnswer = Object.prototype.hasOwnProperty.call(userAnswers, qId) ? userAnswers[qId] : undefined;
            if (userAnswer) {
                const isCorrect = await this.validateAnswer(
                    quizID,
                    question.questionID,
                    userAnswer
                );
                if (isCorrect) correct++;
            }
        }

        const total = questions.length;
        const scorePercent = (correct / total) * 10;

        return {
            score: scorePercent,
            correct: correct,
            total: total
        };
    }
}

/**
 * ==================== AIKEN FORMAT PARSER ====================
 * Parse định dạng Aiken thành cấu trúc câu hỏi
 * 
 * Định dạng:
 * Question text?
 * A) Answer A
 * B) Answer B
 * C) Answer C
 * D) Answer D
 * ANSWER: B
 * EXP: Explanation text
 */

class AikenParser {
    static parse(content) {
        const questions = [];
        const normalized = (content || '').replace(/\r\n/g, '\n').trim();
        const blocks = normalized
            .split(/\n\s*\n+/)
            .map(block => block.trim())
            .filter(block => block !== '');

        blocks.forEach(block => {
            const question = this.parseBlock(block);
            if (question) {
                questions.push(question);
            }
        });

        return questions;
    }

    static sanitizeQuestionText(text) {
        return String(text || '')
            .replace(/^(?:cau|câu)\s*\d+[\.\:\)]?\s*|^\d+[\.\:\)]?\s*/i, '')
            .trim();
    }

    static parseBlock(block) {
        const lines = (block || '')
            .split('\n')
            .map((line) => line.replace(/\s+$/g, ''))
            .filter((line) => line.trim() !== '');

        if (lines.length < 6) {
            return null;
        }

        const optionBuffers = { A: [], B: [], C: [], D: [] };
        const questionBuffer = [];
        const explanationBuffer = [];
        let currentOption = '';
        let answerKey = '';

        for (const rawLine of lines) {
            const line = rawLine.trim();

            const optionMatch = line.match(/^([A-D])[\.)]\s*(.*)$/i);
            if (optionMatch) {
                currentOption = optionMatch[1].toUpperCase();
                const firstText = optionMatch[2].trim();
                if (firstText) {
                    optionBuffers[currentOption].push(firstText);
                }
                continue;
            }

            const answerMatch = line.match(/^ANSWER\s*:\s*([A-D])\s*$/i);
            if (answerMatch) {
                answerKey = answerMatch[1].toUpperCase();
                currentOption = '';
                continue;
            }

            const expMatch = line.match(/^EXP\s*:\s*(.*)$/i);
            if (expMatch) {
                currentOption = '';
                const expText = expMatch[1].trim();
                if (expText) {
                    explanationBuffer.push(expText);
                }
                continue;
            }

            if (currentOption) {
                optionBuffers[currentOption].push(line);
            } else if (answerKey || explanationBuffer.length > 0) {
                explanationBuffer.push(line);
            } else {
                questionBuffer.push(line);
            }
        }

        const questionText = this.sanitizeQuestionText(questionBuffer.join(' ').trim());
        const optionA = optionBuffers.A.join(' ').trim();
        const optionB = optionBuffers.B.join(' ').trim();
        const optionC = optionBuffers.C.join(' ').trim();
        const optionD = optionBuffers.D.join(' ').trim();
        const explanation = explanationBuffer.join(' ').trim();

        if (questionText && optionA && optionB && optionC && optionD && /^[A-D]$/.test(answerKey)) {
            return {
                questionText,
                optionA,
                optionB,
                optionC,
                optionD,
                correctAnswer: answerKey,
                explanation
            };
        }

        return null;
    }

    /**
     * Validate cấu trúc Aiken
     * @param {string} content - Nội dung Aiken
     * @returns {Array} Danh sách lỗi (rỗng nếu hợp lệ)
     */
    static validate(content) {
        const errors = [];
        const normalized = (content || '').replace(/\r\n/g, '\n').trim();
        const blocks = normalized
            .split(/\n\s*\n+/)
            .map(block => block.trim())
            .filter(block => block !== '');

        blocks.forEach((block, index) => {
            const parsed = this.parseBlock(block);
            if (!parsed) {
                errors.push(`Block ${index + 1}: Sai định dạng Aiken hoặc thiếu dữ liệu bắt buộc.`);
            }
        });

        return errors;
    }
}

/**
 * ==================== API REQUEST HELPER ====================
 */

class APIClient {
    static GAS_URL = 'https://script.google.com/macros/s/AKfycbzkUtgCgw5rkOXJcA8NNhZ5K4YorPkoQhO_29oftC4cVxlfVLSttAIACCXV0F3tnHPO/exec';

    static async request(action, data = {}) {
        try {
            const adminPinProof = typeof sessionStorage !== 'undefined'
                ? sessionStorage.getItem('adminPinProof')
                : null;

            const response = await fetch(this.GAS_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: action,
                    token: AuthManager.getToken(),
                    adminPinProof: adminPinProof || undefined,
                    ...data
                })
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API Error (${action}):`, error);
            throw error;
        }
    }

    static async login(username, passwordHash) {
        return this.request('login', { username, passwordHash });
    }

    static async registerUser(payload) {
        return this.request('registerUser', payload || {});
    }

    static async getAccountInfo() {
        return this.request('getAccountInfo');
    }

    static async getDashboardStats(username) {
        return this.request('getDashboardStats', { username });
    }

    static async changePassword(oldPasswordHash, newPasswordHash, oldPasswordHashLegacy) {
        return this.request('changePassword', {
            oldPasswordHash,
            newPasswordHash,
            oldPasswordHashLegacy: oldPasswordHashLegacy || ''
        });
    }

    static async requestPasswordReset(username, email) {
        return this.request('requestPasswordReset', { username, email });
    }

    static async confirmPasswordReset(username, otp, newPasswordHash) {
        return this.request('confirmPasswordReset', { username, otp, newPasswordHash });
    }

    static async resetPasswordViaReferral(username, referralCode, newPasswordHash) {
        return this.request('resetPasswordViaReferral', { username, referralCode, newPasswordHash });
    }

    static async getSubjects() {
        return this.request('getSubjects');
    }

    static async getDashboardInit(username, forceRefresh = false) {
        return this.request('getDashboardInit', { username, forceRefresh });
    }

    static async getQuizzesBySubject(subject) {
        return this.request('getQuizzesBySubject', { subject });
    }

    static async getQuizData(quizID) {
        return this.request('getQuizData', { quizID });
    }

    static async verifyAnswer(quizID, questionID, userAnswer) {
        return this.request('verifyAnswer', { quizID, questionID, userAnswer });
    }

    static async resolveCorrectOption(quizID, questionID) {
        return this.request('resolveCorrectOption', { quizID, questionID });
    }

    static async submitScore(username, quizID, score, userAnswers, violationLogs = []) {
        return this.request('submitScore', {
            username,
            quizID,
            score,
            userAnswers: JSON.stringify(userAnswers),
            violationLogs: JSON.stringify(violationLogs)
        });
    }

    static async getUserStats(username) {
        return this.request('getUserStats', { username });
    }

    static async updateUserInfo(fullName, username, email) {
        return this.request('updateUserInfo', { fullName, username, email });
    }

    static async getAdminData(forceRefresh = false) {
        return this.request('getAdminData', { forceRefresh });
    }

    static async getReferralCodes() {
        return this.request('getReferralCodes');
    }

    static async generateReferralCodes(count = 10) {
        return this.request('generateReferralCodes', { count });
    }

    static async updateQuizStatus(quizID, status) {
        return this.request('updateQuizStatus', { quizID, status });
    }

    static async updateShowAnswer(quizID, showAnswer) {
        return this.request('updateShowAnswer', { quizID, showAnswer });
    }

    static async updateRevealCorrectOnWrong(quizID, revealCorrectOnWrong) {
        return this.request('updateRevealCorrectOnWrong', { quizID, revealCorrectOnWrong });
    }

    static async updateShuffle(quizID, shuffle) {
        return this.request('updateShuffle', { quizID, shuffle });
    }

    static async updateAntiCheat(quizID, antiCheat) {
        return this.request('updateAntiCheat', { quizID, antiCheat });
    }

    static async updateAntiCheatTabSwitch(quizID, antiCheatTabSwitch) {
        return this.request('updateAntiCheatTabSwitch', { quizID, antiCheatTabSwitch });
    }

    static async updateAntiCheatFullscreen(quizID, antiCheatFullscreen) {
        return this.request('updateAntiCheatFullscreen', { quizID, antiCheatFullscreen });
    }

    static async updateAutoNext(quizID, autoNext) {
        return this.request('updateAutoNext', { quizID, autoNext });
    }

    static async updateAllowBack(quizID, allowBack) {
        return this.request('updateAllowBack', { quizID, allowBack });
    }

    static async batchUpdateQuizSettings(changes) {
        return this.request('batchUpdateQuizSettings', { changes });
    }

    static async bulkUpload(quizID, questions) {
        return this.request('bulkUpload', { quizID, questions });
    }

    static async logCheatViolation(logData) {
        return this.request('logCheatViolation', logData || {});
    }
}

/**
 * ==================== UTILITY FUNCTIONS ====================
 */

class Utils {
    /**
     * Format thời gian (giây) -> MM:SS
     */
    static formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    /**
     * Format phần trăm
     */
    static formatPercent(value) {
        return (value || 0).toFixed(2) + '%';
    }

    /**
     * Tạo ID duy nhất
     */
    static generateID() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Lưu dữ liệu vào localStorage (JSON)
     */
    static setLocalStorage(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    /**
     * Lấy dữ liệu từ localStorage (JSON)
     */
    static getLocalStorage(key) {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    }

    /**
     * Xóa dữ liệu khỏi localStorage
     */
    static removeLocalStorage(key) {
        localStorage.removeItem(key);
    }

    /**
     * Copy text vào clipboard
     */
    static async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            console.error('Copy failed:', error);
            return false;
        }
    }

    /**
     * Chuyển đổi sang dark mode (toggle)
     */
    static toggleDarkMode() {
        const isLight = document.body.classList.toggle('light-theme');
        localStorage.setItem('quizTheme', isLight ? 'light' : 'dark');
        return !isLight;
    }

    /**
     * Khôi phục dark mode từ localStorage
     */
    static restoreDarkMode() {
        const legacyDarkMode = localStorage.getItem('darkMode');
        const savedTheme = localStorage.getItem('quizTheme');

        if (savedTheme === 'light' || legacyDarkMode === 'false') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }
    }

    /**
     * Show notification toast
     */
    static showNotification(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
}

/**
 * ==================== GLOBAL IN-APP DIALOG ====================
 * Đồng bộ alert/confirm theo theme cho toàn bộ hệ thống quiz
 */

let inAppDialogState_ = null;

function getDialogHostElement_() {
    return (
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement ||
        document.body ||
        document.documentElement
    );
}

function ensureInAppDialog_() {
    if (inAppDialogState_ && inAppDialogState_.overlay && inAppDialogState_.overlay.isConnected) {
        const host = getDialogHostElement_();
        if (host && inAppDialogState_.overlay.parentElement !== host) {
            host.appendChild(inAppDialogState_.overlay);
        }
        return inAppDialogState_;
    }

    const overlay = document.createElement('div');
    overlay.id = 'globalQuizDialogOverlay';
    overlay.className = 'quiz-dialog-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('aria-hidden', 'true');

    const dialog = document.createElement('div');
    dialog.className = 'quiz-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'globalQuizDialogTitle');

    const titleNode = document.createElement('h3');
    titleNode.id = 'globalQuizDialogTitle';
    titleNode.className = 'quiz-dialog-title';
    titleNode.textContent = 'Thông báo';

    const messageNode = document.createElement('p');
    messageNode.className = 'quiz-dialog-message';

    const actionsNode = document.createElement('div');
    actionsNode.className = 'quiz-dialog-actions';

    dialog.appendChild(titleNode);
    dialog.appendChild(messageNode);
    dialog.appendChild(actionsNode);
    overlay.appendChild(dialog);

    const host = getDialogHostElement_();
    host.appendChild(overlay);

    inAppDialogState_ = {
        overlay,
        titleNode,
        messageNode,
        actionsNode
    };

    return inAppDialogState_;
}

function openInAppDialog_({ title = 'Thông báo', message = '', type = 'alert' }) {
    const { overlay, titleNode, messageNode, actionsNode } = ensureInAppDialog_();

    titleNode.textContent = title;
    messageNode.textContent = String(message || '');
    actionsNode.innerHTML = '';

    return new Promise((resolve) => {
        const close = (result) => {
            overlay.classList.remove('is-open');
            overlay.setAttribute('aria-hidden', 'true');
            document.removeEventListener('keydown', onEscape, true);
            resolve(result);
        };

        const onEscape = (event) => {
            if (event.key !== 'Escape') {
                return;
            }
            event.preventDefault();
            close(type === 'confirm' ? false : true);
        };

        if (type === 'confirm') {
            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'quiz-dialog-btn ghost';
            cancelBtn.textContent = 'Hủy';
            cancelBtn.onclick = () => close(false);

            const okBtn = document.createElement('button');
            okBtn.type = 'button';
            okBtn.className = 'quiz-dialog-btn primary';
            okBtn.textContent = 'Đồng ý';
            okBtn.onclick = () => close(true);

            actionsNode.appendChild(cancelBtn);
            actionsNode.appendChild(okBtn);
            okBtn.focus();
        } else {
            const okBtn = document.createElement('button');
            okBtn.type = 'button';
            okBtn.className = 'quiz-dialog-btn primary';
            okBtn.textContent = 'OK';
            okBtn.onclick = () => close(true);
            actionsNode.appendChild(okBtn);
            okBtn.focus();
        }

        overlay.classList.add('is-open');
        overlay.setAttribute('aria-hidden', 'false');
        document.addEventListener('keydown', onEscape, true);
    });
}

window.showInAppAlert = function (message, title = 'Thông báo') {
    console.error('[Quiz Lab Alert] ' + title + ': ' + message);
    try {
        return openInAppDialog_({ title, message, type: 'alert' });
    } catch (e) {
        console.error('Failed to show in-app alert, falling back to window.alert:', e);
        alert(title + ':\n' + message);
        return Promise.resolve(true);
    }
};

window.showInAppConfirm = function (message, title = 'Xác nhận') {
    return openInAppDialog_({ title, message, type: 'confirm' });
};

/**
 * ==================== EXPORT MODULES ====================
 */

window.insertHtmlSafe = function (element, htmlString) {
    if (element) {
        element.innerHTML = htmlString;
    }
};

window.sha256 = sha256;
window.hashPasswordWithSalt = hashPasswordWithSalt;
window.GradingEngine = GradingEngine;
window.AikenParser = AikenParser;
window.APIClient = APIClient;
window.AuthManager = AuthManager;
window.Utils = Utils;

function updateThemeToggleIcons_() {
    const isLight = document.body.classList.contains('light-theme');
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');

    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
        button.textContent = isLight ? '🌙' : '☀️';
        button.setAttribute('aria-label', isLight ? 'Đổi sang Dark Mode' : 'Đổi sang Light Mode');
        button.setAttribute('title', isLight ? 'Dark Mode' : 'Light Mode');
    });

    if (themeColorMeta) {
        themeColorMeta.setAttribute('content', isLight ? '#e9eef5' : '#0a0e27');
    }
}

function initThemeControls() {
    Utils.restoreDarkMode();
    updateThemeToggleIcons_();

    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
        button.addEventListener('click', () => {
            Utils.toggleDarkMode();
            updateThemeToggleIcons_();
        });
    });
}

window.initThemeControls = initThemeControls;

/**
 * ==================== INITIALIZATION ====================
 */

// Khôi phục dark mode khi load trang (nếu cần)
document.addEventListener('DOMContentLoaded', () => {
    initThemeControls();
});
