let selectedSubject = '';
let allSubjects = [];

function getQuizCacheStore() {
    try {
        const stored = JSON.parse(sessionStorage.getItem('quizBySubjectCache') || '{}');
        if (stored._timestamp && Date.now() - stored._timestamp > 7200000) {
            sessionStorage.removeItem('quizBySubjectCache');
            return {};
        }
        return stored.data || stored;
    } catch (error) {
        return {};
    }
}

function setQuizCacheStore(cacheStore) {
    const dataToStore = {
        _timestamp: Date.now(),
        data: cacheStore || {}
    };
    sessionStorage.setItem('quizBySubjectCache', JSON.stringify(dataToStore));
}

function isAuthErrorResult(result) {
    const message = String((result && result.message) || '').toLowerCase();
    return message.includes('invalid token') || message.includes('unauthorized');
}

function getStatsCacheKey() {
    const username = localStorage.getItem('quizUsername') || 'anonymous';
    return `quizStatsCache:${username}`;
}

// Kiểm tra authentication
function checkAuth() {
    const token = AuthManager.getToken();
    const username = AuthManager.getUsername();
    const role = AuthManager.getRole();

    if (!token || !username) {
        window.location.href = 'login.html';
        return;
    }

    if (role === 'Admin') {
        window.location.href = 'admin.html';
        return;
    }

    const fullName = localStorage.getItem('quizFullName') || '';
    const displayName = fullName || username;
    
    const sidebarUserName = document.getElementById('sidebarUserName');
    if (sidebarUserName) {
        sidebarUserName.textContent = displayName;
    }

    const sidebarAvatar = document.getElementById('sidebarAvatar');
    if (sidebarAvatar) {
        sidebarAvatar.textContent = displayName.charAt(0).toUpperCase();
    }

    loadDashboard();
}

// Load dữ liệu Dashboard
async function loadDashboard() {
    const username = localStorage.getItem('quizUsername');
    const cachedSubjects = sessionStorage.getItem('quizSubjectsCache');
    const cachedStats = sessionStorage.getItem(getStatsCacheKey());

    if (cachedSubjects) {
        try {
            const subjects = JSON.parse(cachedSubjects);
            renderSubjects(subjects);
            allSubjects = subjects;
        } catch (error) {
            sessionStorage.removeItem('quizSubjectsCache');
        }
    }

    if (cachedStats) {
        try {
            renderUserStats(JSON.parse(cachedStats));
        } catch (error) {
            sessionStorage.removeItem(getStatsCacheKey());
        }
    }

    await refreshDashboardInit(username);
}

async function refreshDashboardInit(username, forceRefresh = false) {
    try {
        const result = await APIClient.getDashboardInit(username, forceRefresh);

        if (!result.success) {
            if (isAuthErrorResult(result)) {
                AuthManager.clearAuth();
                window.location.href = 'login.html';
                return;
            }
            await fallbackLoadDashboardData(username);
            return;
        }

        const subjects = result.subjects || [];
        const stats = result.stats || null;
        const quizzesBySubject = result.quizzesBySubject || {};

        allSubjects = subjects;
        sessionStorage.setItem('quizSubjectsCache', JSON.stringify(subjects));
        renderSubjects(subjects);

        if (quizzesBySubject && typeof quizzesBySubject === 'object') {
            setQuizCacheStore(quizzesBySubject);
        }

        if (stats) {
            sessionStorage.setItem(getStatsCacheKey(), JSON.stringify(stats));
            renderUserStats(stats);
        }

        const currentView = sessionStorage.getItem('dashboardCurrentView');

        const lastSub = sessionStorage.getItem('quizLastSubject');
        if (lastSub && subjects.includes(lastSub)) {
            selectSubject(lastSub, false);
        } else if (subjects.length > 0) {
            selectSubject(subjects[0], false);
        }

        if (currentView === 'stats') {
            switchDashboardTab('stats');
        }
    } catch (error) {
        console.error('Error refreshing dashboard init:', error);
        await fallbackLoadDashboardData(username);
    }
}

async function fallbackLoadDashboardData(username) {
    try {
        const [subjectResult, statsResult] = await Promise.all([
            APIClient.getSubjects(),
            APIClient.getUserStats(username)
        ]);

        if (isAuthErrorResult(subjectResult) || isAuthErrorResult(statsResult)) {
            AuthManager.clearAuth();
            window.location.href = 'login.html';
            return;
        }

        if (subjectResult && subjectResult.success) {
            const subjects = subjectResult.subjects || [];
            allSubjects = subjects;
            sessionStorage.setItem('quizSubjectsCache', JSON.stringify(subjects));
            renderSubjects(subjects);
        }

        if (statsResult && statsResult.success && statsResult.stats) {
            sessionStorage.setItem(getStatsCacheKey(), JSON.stringify(statsResult.stats));
            renderUserStats(statsResult.stats);
        }
    } catch (fallbackError) {
        console.error('Fallback dashboard load failed:', fallbackError);
    }
}

        // Render danh sách môn học
function renderSubjects(subjects) {
    const container = document.getElementById('subjectsList');
    container.innerHTML = '';

    if (!subjects || subjects.length === 0) {
        container.innerHTML = '<p class="empty-state">Không có môn học đang hoạt động.</p>';
        return;
    }

    subjects.forEach(subject => {
        const button = document.createElement('button');
        button.className = 'subject-pill';
        button.type = 'button';
        button.textContent = subject;
        button.addEventListener('click', () => selectSubject(subject));
        container.appendChild(button);
    });
}

function switchDashboardTab(tabName, triggerButton = null) {
    const dashboardMain = document.querySelector('.dashboard-main');

    document.querySelectorAll('.dashboard-tab-btn').forEach(btn => btn.classList.remove('active'));

    const activeButton = triggerButton || document.querySelector(`.dashboard-tab-btn[data-tab="${tabName}"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }

    sessionStorage.setItem('dashboardCurrentView', tabName);

    document.querySelectorAll('.dashboard-stats-tab, .dashboard-quiz-tab').forEach(tab => {
        tab.classList.remove('active-tab');
    });

    if (tabName === 'stats') {
        document.querySelector('.dashboard-stats-tab').classList.add('active-tab');
        if (dashboardMain) {
            dashboardMain.classList.remove('mobile-view-quiz');
            dashboardMain.classList.add('mobile-view-stats');
        }
        document.querySelectorAll('.subject-pill').forEach(btn => {
            btn.classList.remove('is-active');
        });
    } else {
        document.querySelector('.dashboard-quiz-tab').classList.add('active-tab');
        if (dashboardMain) {
            dashboardMain.classList.remove('mobile-view-stats');
            dashboardMain.classList.add('mobile-view-quiz');
        }
    }
}

function openStatsModal() {
    const modal = document.getElementById('statsModalOverlay');
    if (modal) {
        modal.classList.add('show');
    }
}

function closeStatsModal() {
    const modal = document.getElementById('statsModalOverlay');
    if (modal) {
        modal.classList.remove('show');
    }
}

function closeStatsModalOnBackdrop(event) {
    if (event.target && event.target.id === 'statsModalOverlay') {
        closeStatsModal();
    }
}

window.addEventListener('scroll', () => {
    const btn = document.getElementById('back-to-top');
    if (window.scrollY > 300) {
        btn.classList.add('show');
    } else {
        btn.classList.remove('show');
    }
});

function scrollDashboardToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

        // Chọn môn học
async function selectSubject(subject, revalidate = true) {
    selectedSubject = subject;
    document.getElementById('selectedSubjectLabel').textContent = subject;
    sessionStorage.setItem('dashboardCurrentView', 'quiz');
    if (subject !== 'Tất cả') {
        sessionStorage.setItem('quizLastSubject', subject);
    } else {
        sessionStorage.removeItem('quizLastSubject');
    }

    document.querySelectorAll('.subject-pill').forEach((node) => {
        node.classList.toggle('is-active', node.textContent === subject);
    });

    const cachedQuizzes = Reflect.get(quizCacheStore, subject);
    if (Array.isArray(cachedQuizzes)) {
        renderQuizzes(cachedQuizzes);
        handleMobileSubjectSelection();
    }

    if (!revalidate) {
        return;
    }

    try {
        const result = await APIClient.getQuizzesBySubject(subject);

        if (result.success) {
            const quizzes = result.quizzes || [];
            Reflect.set(quizCacheStore, subject, quizzes);
            setQuizCacheStore(quizCacheStore);
            renderQuizzes(quizzes);
            handleMobileSubjectSelection();
        }
    } catch (error) {
        console.error('Error loading quizzes:', error);
    }
}

function handleMobileSubjectSelection() {
    if (window.innerWidth <= 768) {
        switchDashboardTab('quiz');
        setTimeout(() => {
            const quizSection = document.querySelector('.dashboard-quiz-tab');
            if (quizSection) {
                const offsetTop = quizSection.offsetTop - 70;
                window.scrollTo({ top: offsetTop, behavior: 'smooth' });
            }
        }, 50);
    }
}

        // Render danh sách bài quiz
function renderQuizzes(quizzes) {
    const container = document.getElementById('quizList');
    container.innerHTML = '';

    if (quizzes.length === 0) {
        container.innerHTML = '<p class="empty-state">Không có bài quiz nào</p>';
        return;
    }

    quizzes.forEach(quiz => {
        const card = document.createElement('div');
        card.className = 'quiz-card-modern';
        const safeDescription = (quiz.description || 'Không có mô tả.').trim();
        const parsedQuestionCount = Number(quiz.questionCount);
        const questionCount = Number.isFinite(parsedQuestionCount) && parsedQuestionCount >= 0
            ? parsedQuestionCount
            : 0;
        const parsedUserAttempts = Number(quiz.userAttempts);
        const userAttempts = Number.isFinite(parsedUserAttempts) && parsedUserAttempts >= 0
            ? parsedUserAttempts
            : 0;
        const metaRow = document.createElement('div');
        metaRow.className = 'quiz-meta-row';

        const subjectNode = document.createElement('span');
        subjectNode.textContent = String(selectedSubject || quiz.subject || 'Môn học');

        const timeNode = document.createElement('span');
        timeNode.textContent = `⏱ ${String(quiz.timeLimit || '')} phút`;

        metaRow.appendChild(subjectNode);
        metaRow.appendChild(timeNode);

        const titleNode = document.createElement('h4');
        titleNode.textContent = String(quiz.title || 'Quiz');

        const descNode = document.createElement('p');
        descNode.className = 'quiz-desc';
        descNode.textContent = safeDescription;

        const insightRow = document.createElement('div');
        insightRow.className = 'quiz-insight-row';

        const questionInsight = document.createElement('div');
        questionInsight.className = 'quiz-insight';
        questionInsight.innerHTML = '<strong>Số câu hỏi</strong>';
        questionInsight.appendChild(document.createTextNode(String(questionCount)));

        const attemptInsight = document.createElement('div');
        attemptInsight.className = 'quiz-insight';
        attemptInsight.innerHTML = '<strong>Lượt làm</strong>';
        attemptInsight.appendChild(document.createTextNode(String(userAttempts)));

        const startBtn = document.createElement('button');
        startBtn.className = 'btn-start-quiz';
        startBtn.type = 'button';
        startBtn.textContent = 'Bắt Đầu Làm Bài';

        insightRow.appendChild(questionInsight);
        insightRow.appendChild(attemptInsight);

        card.appendChild(metaRow);
        card.appendChild(titleNode);
        card.appendChild(descNode);
        card.appendChild(insightRow);
        card.appendChild(startBtn);
        startBtn.addEventListener('click', () => startQuiz(quiz.quizID));
        container.appendChild(card);
    });
}

        // Bắt đầu làm bài
function startQuiz(quizID) {
    localStorage.setItem('currentQuizID', quizID);
    window.location.href = 'quiz.html';
}

        // Load thống kê cá nhân
function renderUserStats(stats) {
    if (!stats) {
        return;
    }

    document.getElementById('quizStats').style.display = 'block';
    const attempts = stats.attempts || 0;
    const highestScore = (stats.highestScore || 0).toFixed(2);
    const averageScore = (stats.averageScore || 0).toFixed(2);

    document.getElementById('totalAttempts').textContent = attempts;
    document.getElementById('highestScore').textContent = highestScore;
    document.getElementById('averageScore').textContent = averageScore;

    const modalAttempts = document.getElementById('modalTotalAttempts');
    const modalHighest = document.getElementById('modalHighestScore');
    const modalAverage = document.getElementById('modalAverageScore');

    if (modalAttempts) {
        modalAttempts.textContent = attempts;
    }
    if (modalHighest) {
        modalHighest.textContent = highestScore;
    }
    if (modalAverage) {
        modalAverage.textContent = averageScore;
    }

    // Render Highest Scores by Subject
    const container = document.getElementById('subjectStatsContainer');
    if (container) {
        container.innerHTML = '';
        const highestScoresByQuiz = stats.highestScoresByQuiz || {};

        if (Object.keys(highestScoresByQuiz).length > 0) {
            const title = document.createElement('h3');
            title.className = 'subject-stats-title';
            title.textContent = 'Điểm cao nhất theo bài thi';
            container.appendChild(title);

            const grid = document.createElement('div');
            grid.className = 'subject-stats-grid';

            // Map quizID to title
            const quizCache = JSON.parse(sessionStorage.getItem('quizBySubjectCache') || '{}').data || {};
            const quizMap = {};
            if (quizCache) {
                Object.keys(quizCache).forEach(subject => {
                    const quizzes = Reflect.get(quizCache, subject);
                    if (Array.isArray(quizzes)) {
                        quizzes.forEach(q => {
                            Reflect.set(quizMap, q.quizID, { subject: subject, title: q.title });
                        });
                    }
                });
            }

            Object.keys(highestScoresByQuiz).forEach(quizID => {
                const score = Reflect.get(highestScoresByQuiz, quizID);
                const qInfo = Reflect.get(quizMap, quizID) || { title: quizID, subject: 'Khác' };

                const card = document.createElement('div');
                card.className = 'subject-stat-card';

                const cardInfo = document.createElement('div');
                cardInfo.className = 'subject-stat-info';
                
                const statName = document.createElement('div');
                statName.className = 'subject-stat-name';
                statName.textContent = qInfo.title;
                
                const statSub = document.createElement('div');
                statSub.className = 'subject-stat-sub';
                statSub.textContent = qInfo.subject;
                
                cardInfo.appendChild(statName);
                cardInfo.appendChild(statSub);

                const cardScore = document.createElement('div');
                cardScore.className = 'subject-stat-score';
                const scoreSpan = document.createElement('span');
                scoreSpan.textContent = Number(score).toFixed(2);
                cardScore.appendChild(scoreSpan);
                
                card.appendChild(cardInfo);
                card.appendChild(cardScore);

                grid.appendChild(card);
            });

            container.appendChild(grid);
        }
    }
}

// Đăng xuất
function logout() {
    AuthManager.clearAuth();
    window.location.href = 'login.html';
}

function toggleDashboardAccountMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    const menu = document.getElementById('dashboardAccountMenu');
    if (menu) {
        menu.classList.toggle('is-open');
    }
}

function closeDashboardAccountMenu() {
    const menu = document.getElementById('dashboardAccountMenu');
    if (menu) {
        menu.classList.remove('is-open');
    }
}

function goToAccountInfo() {
    window.location.href = 'info.html';
}

function goToChangePassword() {
    window.location.href = 'password.html';
}

function bindDashboardControls() {
    const viewModeSelect = document.getElementById('viewModeSelect');
    if (viewModeSelect) {
        viewModeSelect.addEventListener('change', () => setGridMode(viewModeSelect.value === 'true'));
    }

    const statsModalBtn = document.getElementById('statsModalBtn');
    if (statsModalBtn) {
        statsModalBtn.addEventListener('click', openStatsModal);
    }

    const accountMenuBtn = document.getElementById('dashboardAccountMenuBtn');
    if (accountMenuBtn) {
        accountMenuBtn.addEventListener('click', toggleDashboardAccountMenu);
    }

    const accountMenu = document.getElementById('dashboardAccountMenu');
    if (accountMenu) {
        accountMenu.querySelector('[data-action="account-info"]')?.addEventListener('click', goToAccountInfo);
        accountMenu.querySelector('[data-action="change-password"]')?.addEventListener('click', goToChangePassword);
        accountMenu.querySelector('[data-action="logout"]')?.addEventListener('click', logout);
    }

    document.querySelectorAll('.dashboard-tab-btn').forEach((button) => {
        button.addEventListener('click', () => switchDashboardTab(button.dataset.tab, button));
    });

    const statsModalOverlay = document.getElementById('statsModalOverlay');
    if (statsModalOverlay) {
        statsModalOverlay.addEventListener('click', closeStatsModalOnBackdrop);
    }

    const statsModalClose = document.querySelector('#statsModalOverlay .stats-modal-close');
    if (statsModalClose) {
        statsModalClose.addEventListener('click', closeStatsModal);
    }

    const backToTopBtn = document.getElementById('back-to-top');
    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', scrollDashboardToTop);
    }
}

function updateGridModeSelect(isGridMode) {
    const select = document.getElementById('viewModeSelect');
    if (!select) {
        return;
    }

    select.value = String(!!isGridMode);
}

function setGridMode(isGridMode, silent = false) {
    const normalizedValue = !!isGridMode;
    localStorage.setItem('quizGridMode', String(normalizedValue));

    updateGridModeSelect(normalizedValue);
}

function initGridModeToggle() {
    const select = document.getElementById('viewModeSelect');
    if (!select) {
        return;
    }

    const isGridMode = localStorage.getItem('quizGridMode') === 'true';
    setGridMode(isGridMode, true);
}

// Khởi chạy khi trang load
if (window.antiCheat && typeof window.antiCheat.enable === 'function') {
    window.antiCheat.enable(false);
}

window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeStatsModal();
        closeDashboardAccountMenu();
    }
});

document.addEventListener('click', (event) => {
    const menu = document.getElementById('dashboardAccountMenu');
    if (!menu) {
        return;
    }

    if (event.target.closest('#dashboardAccountMenu')) {
        return;
    }

    closeDashboardAccountMenu();
});

initGridModeToggle();
bindDashboardControls();
checkAuth();

Object.assign(window, {
    openStatsModal,
    closeStatsModal,
    closeStatsModalOnBackdrop,
    scrollDashboardToTop,
    toggleDashboardAccountMenu,
    closeDashboardAccountMenu,
    goToAccountInfo,
    goToChangePassword,
    logout,
    switchDashboardTab,
    checkAuth,
    selectSubject,
    startQuiz
});
