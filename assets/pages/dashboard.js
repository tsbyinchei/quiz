let selectedSubject = '';
        let allSubjects = [];


                function getQuizCacheStore() {
            try {
                const stored = JSON.parse(sessionStorage.getItem('quizBySubjectCache') || '{}');
                // Check TTL (2 hours = 7200000 ms)
                if (stored._timestamp && Date.now() - stored._timestamp > 7200000) {
                    sessionStorage.removeItem('quizBySubjectCache');
                    return {};
                }
                return stored.data || stored; // Fallback for old cache format
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
                window.location.href = 'login';
                return;
            }

            if (role === 'Admin') {
                window.location.href = 'admin';
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

            // Kiểm tra xem có cần cảnh báo thiếu Email không
            try {
                const accountResult = await APIClient.getAccountInfo();
                if (accountResult && accountResult.success && accountResult.account) {
                    const hasEmail = !!accountResult.account.email;
                    const ignoreWarning = localStorage.getItem('quiz_ignore_email_warning') === 'true';
                    const role = AuthManager.getRole();

                    if (!hasEmail && !ignoreWarning && role !== 'Admin') {
                        // Hiển thị popup
                        const noEmailPopup = document.getElementById('noEmailPopup');
                        const confirmIgnorePopup = document.getElementById('confirmIgnorePopup');
                        
                        if (noEmailPopup && confirmIgnorePopup) {
                            document.getElementById('btnUpdateEmailNow').onclick = () => {
                                window.location.href = 'info?action=updateEmail';
                            };
                            
                            document.getElementById('btnRemindLater').onclick = () => {
                                noEmailPopup.classList.add('hidden');
                            };

                            document.getElementById('btnDontRemind').onclick = () => {
                                noEmailPopup.classList.add('hidden');
                                confirmIgnorePopup.classList.remove('hidden');
                            };

                            document.getElementById('btnCancelIgnore').onclick = () => {
                                confirmIgnorePopup.classList.add('hidden');
                                noEmailPopup.classList.remove('hidden');
                            };

                            document.getElementById('btnConfirmIgnore').onclick = () => {
                                localStorage.setItem('quiz_ignore_email_warning', 'true');
                                confirmIgnorePopup.classList.add('hidden');
                            };

                            noEmailPopup.classList.remove('hidden');
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to fetch account info for email warning", err);
            }
        }

        async function refreshDashboardInit(username, forceRefresh = false) {
            try {
                const result = await APIClient.getDashboardInit(username, forceRefresh);

                if (!result.success) {
                    if (isAuthErrorResult(result)) {
                        AuthManager.clearAuth();
                        window.location.href = 'login';
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
                } else {
                    selectSubject('Tất cả', false);
                }
                
                if (currentView === 'stats') {
                    switchDashboardView('stats');
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
                    window.location.href = 'login';
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

        
        
        async function handleDashboardRefresh(btn) {
            if (btn) btn.disabled = true;
            const originalText = btn ? btn.textContent : '';
            if (btn) btn.textContent = '...';
            
            document.body.style.pointerEvents = 'none';
            document.body.style.opacity = '0.7';
            document.body.style.transition = 'opacity 0.2s';
            
            sessionStorage.removeItem('quizBySubjectCache');
            
            const username = AuthManager.getUsername();
            await refreshDashboardInit(username, true);
            
            document.body.style.pointerEvents = '';
            document.body.style.opacity = '';
            
            if (btn) {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }

        
        function toggleDashboardSidebar() {
            if (window.innerWidth <= 768) {
                document.querySelector('.dashboard-sidebar').classList.toggle('is-open');
                const overlay = document.getElementById('dashboardPinOverlay');
                if (overlay) overlay.classList.toggle('is-open');
            } else {
                document.querySelector('.dashboard-layout').classList.toggle('sidebar-closed');
            }
        }

        function switchDashboardView(view) {
            if (window.innerWidth <= 768) {
                document.querySelector('.dashboard-sidebar').classList.remove('is-open');
                const overlay = document.getElementById('dashboardPinOverlay');
                if (overlay) overlay.classList.remove('is-open');
            }
            
            sessionStorage.setItem('dashboardCurrentView', view);
            
            // Update nav links
            document.querySelectorAll('.sidebar-link[data-view]').forEach(btn => {
                btn.classList.remove('active', 'is-active');
                if (btn.getAttribute('data-view') === view) {
                    btn.classList.add('is-active');
                }
            });

            // Update title
            const titleEl = document.getElementById('dashboardViewTitle');
            if (view === 'quiz') {
                titleEl.textContent = 'Tất cả bài thi';
                document.getElementById('quizPanel').classList.remove('is-hidden');
                document.getElementById('statsPanel').classList.add('is-hidden');
                selectSubject('Tất cả', false);
            } else if (view === 'stats') {
                titleEl.textContent = 'Thống kê cá nhân';
                document.getElementById('quizPanel').classList.add('is-hidden');
                document.getElementById('statsPanel').classList.remove('is-hidden');
                document.querySelectorAll('.subject-pill').forEach(btn => {
                    btn.classList.remove('is-active');
                });
            }
        }

        function switchDashboardTab_old(tabName) {
            const dashboardMain = document.querySelector('.dashboard-main');

            document.querySelectorAll('.dashboard-tab-btn').forEach(btn => btn.classList.remove('active'));

            const activeButton = triggerButton || document.querySelector(`.dashboard-tab-btn[data-tab="${tabName}"]`);
            if (activeButton) {
                activeButton.classList.add('active');
            }

            document.querySelectorAll('.dashboard-stats-tab, .dashboard-quiz-tab').forEach(tab => {
                tab.classList.remove('active-tab');
            });

            if (tabName === 'stats') {
                document.querySelector('.dashboard-stats-tab').classList.add('active-tab');
                if (dashboardMain) {
                    dashboardMain.classList.remove('mobile-view-quiz');
                    dashboardMain.classList.add('mobile-view-stats');
                }
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

        document.querySelector('.dashboard-content-area').addEventListener('scroll', () => {
            const btn = document.getElementById('back-to-top');
            if (document.querySelector('.dashboard-content-area').scrollTop > 300) {
                btn.classList.add('show');
            } else {
                btn.classList.remove('show');
            }
        });

        function scrollDashboardToTop() {
            document.querySelector('.dashboard-content-area').scrollTo({ top: 0, behavior: 'smooth' });
        }

        // Chọn môn học
        
        async function selectSubject(subject, revalidate = true) {
            if (window.innerWidth <= 768) {
                document.querySelector('.dashboard-sidebar').classList.remove('is-open');
                const overlay = document.getElementById('dashboardPinOverlay');
                if (overlay) overlay.classList.remove('is-open');
            }
            selectedSubject = subject;
            document.getElementById('selectedSubjectLabel').textContent = subject;
            if (subject !== 'Tất cả') {
                sessionStorage.setItem('quizLastSubject', subject);
            } else {
                sessionStorage.removeItem('quizLastSubject');
            }

            // Dảm bảo luôn hiển thị màn hình quiz khi chọn môn học
            sessionStorage.setItem('dashboardCurrentView', 'quiz');
            document.getElementById('quizPanel').classList.remove('is-hidden');
            document.getElementById('statsPanel').classList.add('is-hidden');
            document.getElementById('dashboardViewTitle').textContent = subject === 'Tất cả' ? 'Tất cả bài thi' : 'Danh sách bài thi';
            
            // Đổi active link trên sidebar về Tất cả bài thi
            document.querySelectorAll('.sidebar-link[data-view]').forEach(btn => {
                btn.classList.remove('active', 'is-active');
                if (btn.getAttribute('data-view') === 'quiz') {
                    btn.classList.add('is-active');
                }
            });

            // Update pills
            document.querySelectorAll('.subject-pill').forEach((node) => {
                node.classList.toggle('is-active', node.textContent === subject);
            });
            
            // Update Tất cả bài thi button
            const allBtn = document.querySelector('.sidebar-link[data-view="quiz"]');
            if (subject === 'Tất cả') {
                if(allBtn) allBtn.classList.add('is-active');
                document.querySelectorAll('.subject-pill').forEach(n => n.classList.remove('is-active'));
            } else {
                if(allBtn) allBtn.classList.remove('is-active');
            }

            const quizCacheStore = getQuizCacheStore();
            
            if (subject === 'Tất cả') {
                let allQuizzes = [];
                for (const key in quizCacheStore) {
                    if (Array.isArray(quizCacheStore[key])) {
                        allQuizzes = allQuizzes.concat(quizCacheStore[key]);
                    }
                }
                
                // remove duplicates just in case
                const uniqueIds = new Set();
                const uniqueQuizzes = [];
                allQuizzes.forEach(q => {
                    if(!uniqueIds.has(q.quizID)) {
                        uniqueIds.add(q.quizID);
                        uniqueQuizzes.push(q);
                    }
                });
                
                renderQuizzes(uniqueQuizzes);
                handleMobileSubjectSelection();
                return;
            }

            if (Array.isArray(quizCacheStore[subject])) {
                renderQuizzes(quizCacheStore[subject]);
                handleMobileSubjectSelection();
            }

            if (!revalidate) {
                return;
            }

            try {
                const result = await APIClient.getQuizzesBySubject(subject);

                if (result.success) {
                    const quizzes = result.quizzes || [];
                    quizCacheStore[subject] = quizzes;
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
                setTimeout(() => {
                    const quizSection = document.getElementById('quizPanel');
                    if (quizSection) {
                        const offsetTop = quizSection.offsetTop - 70;
                        document.querySelector('.dashboard-content-area').scrollTo({ top: offsetTop, behavior: 'smooth' });
                    }
                }, 50);
            }
        }

        function handleMobileSubjectSelection_old() {
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
                const displaySubject = selectedSubject === 'Tất cả' ? (quiz.subject || 'Môn học') : (selectedSubject || quiz.subject || 'Môn học');
                subjectNode.textContent = String(displaySubject);

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

        async function startQuiz(quizID) {
            const draft = localStorage.getItem('quiz_draft_' + quizID);
            const state = localStorage.getItem('quiz_state_' + quizID);
            
            if (draft || state) {
                let wantResume = true;
                if (typeof showInAppConfirm === 'function') {
                    wantResume = await showInAppConfirm('Bạn đang có bài thi làm dở. Bạn có muốn tiếp tục làm bài này không?\n\n- Chọn "Đồng ý" để làm tiếp.\n- Chọn "Hủy" để làm bài mới hoàn toàn.');
                } else {
                    wantResume = confirm('Bạn đang có bài thi làm dở. Bấm OK để làm tiếp, bấm Cancel để làm bài mới hoàn toàn.');
                }
                
                if (!wantResume) {
                    localStorage.removeItem('quiz_draft_' + quizID);
                    localStorage.removeItem('quiz_state_' + quizID);
                    localStorage.removeItem('quiz_flagged_' + quizID);
                    localStorage.removeItem('quiz_correct_' + quizID);
                }
            }
            
            localStorage.setItem('currentQuizID', quizID);
            window.location.href = 'quiz';
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
            document.getElementById('highestScore').textContent = highestScore + '/10';
            document.getElementById('averageScore').textContent = averageScore + '/10';

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
                            const quizzes = quizCache[subject];
                            if (Array.isArray(quizzes)) {
                                quizzes.forEach(q => {
                                    quizMap[q.quizID] = { subject: subject, title: q.title };
                                });
                            }
                        });
                    }

                    Object.keys(highestScoresByQuiz).forEach(quizID => {
                        const score = highestScoresByQuiz[quizID];
                        const qInfo = quizMap[quizID] || { title: quizID, subject: 'Khác' };
                        
                        const card = document.createElement('div');
                        card.className = 'subject-stat-card';
                        
                        card.innerHTML = `
                            <div class="subject-stat-info">
                                <div class="subject-stat-name">${qInfo.title}</div>
                                <div class="subject-stat-sub">${qInfo.subject}</div>
                            </div>
                            <div class="subject-stat-score">
                                <span>${Number(score).toFixed(2)}</span>
                            </div>
                        `;
                        
                        grid.appendChild(card);
                    });
                    
                    container.appendChild(grid);
                }
            }
        }

        // Đăng xuất
        function logout() {
            AuthManager.clearAuth();
            window.location.href = 'login';
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
            window.location.href = 'info';
        }

        function goToChangePassword() {
            window.location.href = 'password';
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
        checkAuth();
