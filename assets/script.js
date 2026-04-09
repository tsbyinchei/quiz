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

const SECRET_KEY = 'TsByinChei';

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

/**
 * ==================== AUTHENTICATION ====================
 */

class AuthManager {
    static getToken() {
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

    static isAuthenticated() {
        return !!this.getDecodedToken();
    }

    static isAdmin() {
        return this.getRole() === 'Admin';
    }

    static setAuth(token, role, username) {
        localStorage.setItem('quizToken', token);
        localStorage.setItem('quizRole', role);
        localStorage.setItem('quizUsername', username);
    }

    static clearAuth() {
        localStorage.removeItem('quizToken');
        localStorage.removeItem('quizRole');
        localStorage.removeItem('quizUsername');
        localStorage.removeItem('currentQuizID');
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('adminPinVerified');
            sessionStorage.removeItem('adminPinVerifiedFor');
            sessionStorage.removeItem('adminPinProof');
        }
    }
}

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
    static async validateAnswer(questionID, userAnswer, answerHash) {
        const computedHash = await sha256(questionID + userAnswer + SECRET_KEY);
        return computedHash === answerHash;
    }

    /**
     * Tính điểm hoàn chỉnh
     * @param {Array} questions - Danh sách câu hỏi
     * @param {Object} userAnswers - Đáp án của user
     * @returns {Promise<Object>} {score, correct, total}
     */
    static async calculateScore(questions, userAnswers) {
        let correct = 0;

        for (const question of questions) {
            const userAnswer = userAnswers[question.questionID];
            if (userAnswer) {
                const isCorrect = await this.validateAnswer(
                    question.questionID,
                    userAnswer,
                    question.answerHash
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
    static GAS_URL = 'https://script.google.com/macros/s/AKfycbwFuUIJGsZ1y4voIjdhUR471Ocw63mpq0ZChEmtHJmHOnkERryTxU6GrUkLQh433CBs/exec';

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

            return await response.json();
        } catch (error) {
            console.error(`API Error (${action}):`, error);
            throw error;
        }
    }

    static async login(username, passwordHash) {
        return this.request('login', { username, passwordHash });
    }

    static async getSubjects() {
        return this.request('getSubjects');
    }

    static async getDashboardInit(username) {
        return this.request('getDashboardInit', { username });
    }

    static async getQuizzesBySubject(subject) {
        return this.request('getQuizzesBySubject', { subject });
    }

    static async getQuizData(quizID) {
        return this.request('getQuizData', { quizID });
    }

    static async submitScore(username, quizID, score, userAnswers) {
        return this.request('submitScore', {
            username,
            quizID,
            score,
            userAnswers: JSON.stringify(userAnswers)
        });
    }

    static async getUserStats(username) {
        return this.request('getUserStats', { username });
    }

    static async getAdminData() {
        return this.request('getAdminData');
    }

    static async updateQuizStatus(quizID, status) {
        return this.request('updateQuizStatus', { quizID, status });
    }

    static async updateShowAnswer(quizID, showAnswer) {
        return this.request('updateShowAnswer', { quizID, showAnswer });
    }

    static async updateShuffle(quizID, shuffle) {
        return this.request('updateShuffle', { quizID, shuffle });
    }

    static async updateAntiCheat(quizID, antiCheat) {
        return this.request('updateAntiCheat', { quizID, antiCheat });
    }

    static async updateAutoNext(quizID, autoNext) {
        return this.request('updateAutoNext', { quizID, autoNext });
    }

    static async updateAllowBack(quizID, allowBack) {
        return this.request('updateAllowBack', { quizID, allowBack });
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
 * ==================== EXPORT MODULES ====================
 */

// Các hàm chính được tách riêng để dễ dùng

window.sha256 = sha256;
window.GradingEngine = GradingEngine;
window.AikenParser = AikenParser;
window.APIClient = APIClient;
window.AuthManager = AuthManager;
window.Utils = Utils;

function updateThemeToggleIcons_() {
    const isLight = document.body.classList.contains('light-theme');
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');

    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
        button.textContent = isLight ? '☀️' : '🌙';
        button.setAttribute('aria-label', isLight ? 'Đổi sang Dark Mode' : 'Đổi sang Light Mode');
        button.setAttribute('title', isLight ? 'Light Mode' : 'Dark Mode');
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
