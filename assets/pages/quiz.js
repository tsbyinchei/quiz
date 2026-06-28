let swiper;
        let quizData = {};
        let displayQuestions = [];
        let userAnswers = {};
        let flaggedQuestions = {};
        let timerInterval;
        let timeRemaining = 0;
        let isSubmitting = false;
        let allowBackNavigation = true;
        let autoNextEnabled = false;
        let autoNextTimer = null;
        let questionLocks = {};
        let optionOrderByQuestion = {};
        let correctOptionKeyByQuestion = {};
        let correctOptionInFlightByQuestion = {};
        let imageViewerEventsBound = false;
        let currentQuizID = String(localStorage.getItem('currentQuizID') || '');
        const imageViewerOverlay = document.getElementById('imageViewerOverlay');
        const imageViewerImg = document.getElementById('imageViewerImg');
        const imageViewerCaption = document.getElementById('imageViewerCaption');

        function shuffleArray(items) {
            const arr = [...items];
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                ;[arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        }

        function normalizeOptionText(value) {
            // Remove legacy Aiken-style prefixes to avoid duplicated labels like "A. A. ..."
            let str = String(value || '').replace(/^[A-D][\.)]\s*/i, '').trim();
            // Xử lý lỗi Google Sheets tự thêm .0 vào sau số nguyên
            if (/^-?\d+\.0$/.test(str)) {
                str = str.replace(/\.0$/, '');
            }
            return str;
        }

        function resolveAntiCheatModes(quizInfo) {
            const info = quizInfo || {};
            const legacyAntiCheatEnabled = !(info.antiCheat === false);
            const hasExplicitTabMode = Object.prototype.hasOwnProperty.call(info, 'antiCheatTabSwitch');
            const hasExplicitFullscreenMode = Object.prototype.hasOwnProperty.call(info, 'antiCheatFullscreen');
            const hasExplicitDevToolsMode = Object.prototype.hasOwnProperty.call(info, 'antiCheatDevTools');

            const tabSwitch = hasExplicitTabMode ? !!info.antiCheatTabSwitch : legacyAntiCheatEnabled;
            const fullscreen = hasExplicitFullscreenMode ? !!info.antiCheatFullscreen : legacyAntiCheatEnabled;
            const devTools = hasExplicitDevToolsMode ? !!info.antiCheatDevTools : legacyAntiCheatEnabled;

            return {
                basic: legacyAntiCheatEnabled,
                tabSwitch,
                fullscreen,
                devTools
            };
        }

        function isPracticeModeEnabled(quizInfo) {
            const info = quizInfo || {};
            return !!(info.showAnswer || info.revealCorrectOnWrong);
        }

        function escapeHtml(value) {
            return String(value || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function isSafeImageSrc(src) {
            const raw = String(src || '').trim();
            if (!raw) {
                return false;
            }

            const lower = raw.toLowerCase();
            if (lower.startsWith('javascript:') || lower.startsWith('data:')) {
                return false;
            }

            return /^(https?:\/\/|\.\/|\.\.\/|\/|assets\/)/i.test(raw);
        }

        // Allow only a small subset of tags for Aiken rich text (mainly <img> and line breaks).
        function sanitizeAikenRichText(input, { allowImage = true } = {}) {
            let htmlInput = input;
            if (typeof marked !== 'undefined') {
                try {
                    htmlInput = marked.parseInline(String(input || ''));
                } catch (e) {}
            }
            const parser = new DOMParser();
            const doc = parser.parseFromString(String(htmlInput || ''), 'text/html');

            const allowedTextTags = new Set(['BR', 'B', 'STRONG', 'I', 'EM', 'U', 'CODE', 'DEL', 'A', 'SPAN', 'DIV', 'MATH', 'MI', 'MN', 'MO', 'MS', 'MTEXT', 'MROW', 'MFRAC', 'MSUP', 'MSUB', 'MSUBSUP', 'MUNDEROVER', 'MTABLE', 'MTR', 'MTD', 'ANNOTATION', 'SUP', 'SUB']);

            const walk = (node) => {
                const children = Array.from(node.childNodes);

                for (const child of children) {
                    if (child.nodeType === Node.TEXT_NODE) {
                        continue;
                    }

                    if (child.nodeType !== Node.ELEMENT_NODE) {
                        child.remove();
                        continue;
                    }

                    const tag = child.tagName.toUpperCase();

                    if (tag === 'IMG' && allowImage) {
                        const src = child.getAttribute('src') || '';
                        if (!isSafeImageSrc(src)) {
                            child.remove();
                            continue;
                        }

                        const alt = (child.getAttribute('alt') || child.getAttribute('title') || 'Ảnh minh họa').trim();
                        const trigger = document.createElement('button');
                        trigger.type = 'button';
                        trigger.className = 'quiz-image-button';
                        trigger.setAttribute('data-image-src', src);
                        trigger.setAttribute('data-image-alt', alt);
                        trigger.textContent = 'Xem ảnh';
                        child.replaceWith(trigger);
                        continue;
                    }

                    if (allowedTextTags.has(tag)) {
                        Array.from(child.attributes || []).forEach((attr) => {
                            child.removeAttribute(attr.name);
                        });
                        walk(child);
                        continue;
                    }

                    // Replace unsupported tags with their plain text content.
                    const textNode = document.createTextNode(child.textContent || '');
                    child.replaceWith(textNode);
                }
            };

            walk(doc.body);
                        const serializeSafe = (node) => {
                if (node.nodeType === 3) return node.textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
                if (node.nodeType === 1) {
                    const tag = node.tagName.toLowerCase();
                    const attrs = Array.from(node.attributes).map(a => `${a.name}="${a.value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`).join(' ');
                    const children = Array.from(node.childNodes).map(serializeSafe).join('');
                    const selfClosing = ['img', 'br', 'hr', 'input'].includes(tag);
                    return `<${tag}${attrs ? ' ' + attrs : ''}${selfClosing ? '/>' : `>${children}</${tag}>`}`;
                }
                return '';
            };
            return Array.from(doc.body.childNodes).map(serializeSafe).join('');
        }

        function openImageViewer(src, alt = 'Ảnh minh họa') {
            if (!imageViewerOverlay || !imageViewerImg || !isSafeImageSrc(src)) {
                return;
            }

            imageViewerLastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

            imageViewerImg.src = src;
            imageViewerImg.alt = alt || 'Ảnh minh họa';
            if (imageViewerCaption) {
                imageViewerCaption.textContent = alt || '';
            }

            document.body.style.overflow = 'hidden';
            imageViewerOverlay.classList.add('is-open');
            imageViewerOverlay.setAttribute('aria-hidden', 'false');

            const closeButton = imageViewerOverlay.querySelector('.quiz-image-viewer-close');
            if (closeButton && typeof closeButton.focus === 'function') {
                closeButton.focus();
            }
        }

        function closeImageViewer() {
            if (!imageViewerOverlay || !imageViewerImg) {
                return;
            }

            imageViewerOverlay.classList.remove('is-open');
            imageViewerOverlay.setAttribute('aria-hidden', 'true');
            imageViewerImg.src = '';
            document.body.style.overflow = '';

            if (imageViewerLastFocus && typeof imageViewerLastFocus.focus === 'function') {
                imageViewerLastFocus.focus();
            }
            imageViewerLastFocus = null;
        }

        function bindImageViewerEvents() {
            if (imageViewerEventsBound) {
                return;
            }

            document.addEventListener('click', (event) => {
                const imageTrigger = event.target.closest('.quiz-image-button');
                if (imageTrigger) {
                    const src = imageTrigger.getAttribute('data-image-src') || '';
                    const alt = imageTrigger.getAttribute('data-image-alt') || 'Ảnh minh họa';
                    openImageViewer(src, alt);
                    return;
                }

                if (imageViewerOverlay && event.target === imageViewerOverlay) {
                    closeImageViewer();
                }
            });

            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && imageViewerOverlay && imageViewerOverlay.classList.contains('is-open')) {
                    closeImageViewer();
                    event.stopPropagation();
                }
            });

            const gridBody = document.getElementById('questionGridBody');
            if (gridBody) {
                gridBody.addEventListener('click', (event) => {
                    const target = event.target.closest('.question-grid-item');
                    if (!target) return;
                    
                    const index = Number(target.getAttribute('data-question-index'));
                    if (!Number.isNaN(index)) {
                        goToQuestionAndClose(index);
                    }
                });
            }

            imageViewerEventsBound = true;
        }

        bindImageViewerEvents();


        async function initQuiz() {
            sessionStorage.removeItem('quizResult');

            // Kiểm tra authentication
            const token = AuthManager.getToken();
            if (!token) {
                window.location.href = 'login';
                return;
            }

            const quizID = localStorage.getItem('currentQuizID');
            if (!quizID) {
                window.location.href = 'dashboard';
                return;
            }

            // Load quiz data từ GAS
            await loadQuizData(quizID, token);
        }

        // Load dữ liệu bài quiz
        async function loadQuizData(quizID, token) {
            try {
                const result = await APIClient.getQuizData(quizID);

                if (result.success) {
                    quizData = result;
                    currentQuizID = String(quizID || '');
                    correctOptionKeyByQuestion = {};
                    correctOptionInFlightByQuestion = {};
                    optionOrderByQuestion = {};
                    const antiCheatModes = resolveAntiCheatModes(quizData.quizInfo);
                    const shouldEnableAntiCheat = antiCheatModes.basic || antiCheatModes.tabSwitch || antiCheatModes.fullscreen || antiCheatModes.devTools;
                    autoNextEnabled = !!(quizData.quizInfo && quizData.quizInfo.autoNext);
                    allowBackNavigation = !(quizData.quizInfo && quizData.quizInfo.allowBack === false);
                    document.body.classList.toggle('quiz-no-back', !allowBackNavigation);

                    if (typeof antiCheat !== 'undefined') {
                        antiCheat.enable(shouldEnableAntiCheat, antiCheatModes);
                        console.log('Anti-Cheat: ENABLED with modes', antiCheatModes);
                    }

                    document.getElementById('quizTitle').textContent = result.quizInfo.title;
                    
                    const cachedStateRaw = localStorage.getItem('quiz_state_' + currentQuizID);
                    let cachedState = null;
                    if (cachedStateRaw) {
                        try { cachedState = JSON.parse(cachedStateRaw); } catch (e) {}
                    }

                    if (cachedState && cachedState.displayQuestions && cachedState.optionOrderByQuestion) {
                        displayQuestions = cachedState.displayQuestions;
                        optionOrderByQuestion = cachedState.optionOrderByQuestion;
                    } else {
                        displayQuestions = Array.isArray(result.questions) ? [...result.questions] : [];
                        if (quizData.quizInfo && quizData.quizInfo.shuffle) {
                            displayQuestions = shuffleArray(displayQuestions);
                        }
                    }

                    document.getElementById('totalQuestions').textContent = displayQuestions.length;
                    document.getElementById('btnQuestionList').style.display = 'inline-flex';
                    const headerReportBtn = document.getElementById('btnHeaderReport');
                    if (headerReportBtn) headerReportBtn.style.display = 'inline-flex';

                    // Khôi phục nháp (Draft)
                    const draftAnswers = localStorage.getItem('quiz_draft_' + currentQuizID);
                    if (draftAnswers) {
                        try {
                            userAnswers = JSON.parse(draftAnswers) || {};
                        } catch (e) {}
                    }
                    const draftFlags = localStorage.getItem('quiz_flagged_' + currentQuizID);
                    if (draftFlags) {
                        try {
                            flaggedQuestions = JSON.parse(draftFlags) || {};
                        } catch (e) {}
                    }
                    const draftCorrect = localStorage.getItem('quiz_correct_' + currentQuizID);
                    if (draftCorrect) {
                        try {
                            correctOptionKeyByQuestion = JSON.parse(draftCorrect) || {};
                        } catch (e) {}
                    }
                    if (isPracticeModeEnabled(quizData.quizInfo)) {
                        for (const qID of Object.keys(userAnswers)) {
                            questionLocks[qID] = true;
                        }
                    }

                    renderQuestions(displayQuestions);
                    warmupPracticeCorrectOptions_();
                    
                    let exactSecondsRemaining = null;
                    if (cachedState && cachedState.endTime) {
                        exactSecondsRemaining = Math.max(0, Math.floor((cachedState.endTime - Date.now()) / 1000));
                    } else {
                        exactSecondsRemaining = (result.quizInfo.timeLimit || 0) * 60;
                        const newState = {
                            displayQuestions: displayQuestions,
                            optionOrderByQuestion: optionOrderByQuestion,
                            endTime: Date.now() + exactSecondsRemaining * 1000,
                            currentIndex: 0
                        };
                        localStorage.setItem('quiz_state_' + currentQuizID, JSON.stringify(newState));
                    }
                    
                    startTimer(null, exactSecondsRemaining);
                    initSwiper();
                    
                    if (cachedState && typeof cachedState.currentIndex === 'number') {
                        swiper.slideTo(cachedState.currentIndex, 0);
                    }
                    
                    updateQuestionIndicator();
                    // Show fullscreen prompt only when fullscreen monitoring is enabled.
                    if (antiCheatModes.fullscreen) {
                        showFullscreenButton();
                    }
                } else {
                    await showInAppAlert(result.message || 'Không thể tải dữ liệu bài quiz');
                    window.location.href = 'dashboard';
                }
            } catch (error) {
                console.error('Error loading quiz:', error);
                await showInAppAlert('Lỗi khi tải bài quiz');
                window.location.href = 'dashboard';
            }
        }

        // Render các câu hỏi
        function renderQuestions(questions) {
            const container = document.getElementById('questionContainer');
            container.replaceChildren();
            const isGridMode = localStorage.getItem('quizGridMode') === 'true';

            questions.forEach((question, index) => {
                const isFirst = index === 0;
                const isLast = index === questions.length - 1;
                const shouldShuffleOptions = !!(quizData.quizInfo && quizData.quizInfo.shuffle);
                const shouldShowOptionPrefix = !shouldShuffleOptions;
                const optionList = [
                    { key: 'A', text: normalizeOptionText(question.A) },
                    { key: 'B', text: normalizeOptionText(question.B) },
                    { key: 'C', text: normalizeOptionText(question.C) },
                    { key: 'D', text: normalizeOptionText(question.D) }
                ];
                
                const qIDStr = String(question.questionID).trim();
                let renderedOptions;
                if (optionOrderByQuestion[qIDStr]) {
                    renderedOptions = optionOrderByQuestion[qIDStr].map(k => optionList.find(o => o.key === k)).filter(Boolean);
                } else {
                    renderedOptions = shouldShuffleOptions ? shuffleArray(optionList) : optionList;
                    optionOrderByQuestion[qIDStr] = renderedOptions.map((option) => option.key);
                }
                
                const questionHtml = sanitizeAikenRichText(question.questionText || '', { allowImage: true });
                const encodedQuestionID = encodeURIComponent(String(question.questionID || ''));
                const slide = document.createElement('div');
                slide.className = 'swiper-slide';
                insertHtmlSafe(slide, `
                    <div class="question-card">
                            <h3>Câu ${index + 1}: ${questionHtml}</h3>
                            <div class="answers ${isGridMode ? 'grid-mode' : ''}">
                            ${renderedOptions.map((option) => {
                                let labelClasses = '';
                                let inputProps = '';
                                let badgeText = '';
                                const isSelected = userAnswers[question.questionID] === option.key;
                                if (isSelected) {
                                    labelClasses += 'is-selected';
                                    inputProps += 'checked';
                                }
                                
                                const practiceModeEnabled = isPracticeModeEnabled(quizData.quizInfo);
                                const revealCorrectOnWrong = !!(quizData.quizInfo && quizData.quizInfo.revealCorrectOnWrong);
                                
                                if (practiceModeEnabled && userAnswers[question.questionID]) {
                                    inputProps += ' disabled';
                                    const cacheKey = `${currentQuizID}_${question.questionID}`;
                                    const correctValue = correctOptionKeyByQuestion[cacheKey];
                                    if (correctValue) {
                                        const isAnswerCorrect = userAnswers[question.questionID] === correctValue;
                                        if (isSelected) {
                                            if (isAnswerCorrect) {
                                                labelClasses += ' is-correct';
                                                badgeText = '✓';
                                            } else {
                                                labelClasses += ' is-wrong';
                                                badgeText = '✗';
                                            }
                                        } else if (revealCorrectOnWrong && option.key === correctValue) {
                                            labelClasses += ' is-correct';
                                            badgeText = '✓';
                                        }
                                    }
                                }

                                return `
                                <label class="answer-option ${labelClasses}">
                                    <input type="radio" name="q${question.questionID}" value="${option.key}" 
                                        class="quiz-radio-input" data-question-id="${encodedQuestionID}" data-option-key="${option.key}" ${inputProps}>
                                    <span class="answer-status-badge" aria-hidden="true">${badgeText}</span>
                                    <span class="option-text">${shouldShowOptionPrefix ? `<span class="option-prefix">${option.key}.</span> ` : ''}${sanitizeAikenRichText(option.text, { allowImage: true })}</span>
                                </label>
                                `;
                            }).join('')}
                        </div>

                        <div class="quiz-navigation">
                            <button class="btn-prev quiz-btn-prev"${(isFirst || !allowBackNavigation) ? 'disabled' : ''}>
                                &larr; Câu Trước
                            </button>
                            <button type="button" class="btn-flag quiz-btn-flag" data-question-id="${encodedQuestionID}">🚩 Đánh dấu</button>
                            ${isLast
                                ? '<button class="btn-submit quiz-btn-submit">Nộp Bài</button>'
                                : '<button class="btn-next quiz-btn-next">Câu Tiếp &rarr;</button>'}
                        </div>


                    </div>
                `);
                container.appendChild(slide);

            // Dynamically attach event listeners to avoid inline handlers (SAST fix)
            const radioInputs = slide.querySelectorAll('.quiz-radio-input');
            radioInputs.forEach(input => {
                input.addEventListener('change', (e) => {
                    const qId = decodeURIComponent(e.target.dataset.questionId);
                    const optKey = e.target.dataset.optionKey;
                    selectAnswer(qId, optKey);
                });
            });

            const prevBtn = slide.querySelector('.quiz-btn-prev');
            if (prevBtn) prevBtn.addEventListener('click', prevQuestion);

            const nextBtn = slide.querySelector('.quiz-btn-next');
            if (nextBtn) nextBtn.addEventListener('click', nextQuestion);

            const submitBtn = slide.querySelector('.quiz-btn-submit');
            if (submitBtn) submitBtn.addEventListener('click', () => submitQuiz());

            const flagBtn = slide.querySelector('.quiz-btn-flag');
            if (flagBtn) {
                flagBtn.addEventListener('click', (e) => {
                    const qId = decodeURIComponent(e.target.dataset.questionId);
                    flaggedQuestions[qId] = !flaggedQuestions[qId];
                    localStorage.setItem('quiz_flagged_' + currentQuizID, JSON.stringify(flaggedQuestions));
                    updateQuestionIndicator();
                    if (flaggedQuestions[qId]) {
                        flagBtn.classList.add('active');
                    } else {
                        flagBtn.classList.remove('active');
                    }
                });
                const qIdRaw = decodeURIComponent(encodedQuestionID);
                if (flaggedQuestions[qIdRaw]) {
                    flagBtn.classList.add('active');
                }
            }
            });

            // Render Math Equations with KaTeX
            if (typeof renderMathInElement !== 'undefined') {
                renderMathInElement(container, {
                    delimiters: [
                        {left: "$$", right: "$$", display: true},
                        {left: "$", right: "$", display: false},
                        {left: "\\(", right: "\\)", display: false},
                        {left: "\\[", right: "\\]", display: true}
                    ],
                    throwOnError: false
                });
            }
        }

        // Request Fullscreen khi bắt đầu quiz
        async function requestFullscreenMode() {
            const fullscreenTarget = document.documentElement;
            if (!fullscreenTarget) {
                return;
            }

            const isCurrentlyFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
            if (isCurrentlyFullscreen) {
                hideFullscreenPrompt();
                if (typeof antiCheat !== 'undefined' && antiCheat.monitorFullscreenEnabled) {
                    antiCheat.monitorFullscreen();
                }
                return;
            }

            try {
                const requestFS = 
                    fullscreenTarget.requestFullscreen ||
                    fullscreenTarget.webkitRequestFullscreen ||
                    fullscreenTarget.mozRequestFullScreen ||
                    fullscreenTarget.msRequestFullscreen;

                if (requestFS) {
                    const btn = document.getElementById('fullscreenButton');
                    if (btn) btn.disabled = true;

                    await requestFS.call(fullscreenTarget);
                    console.log('📺 Fullscreen mode activated');
                    
                    hideFullscreenPrompt();
                    
                    if (typeof antiCheat !== 'undefined' && antiCheat.monitorFullscreenEnabled) {
                        antiCheat.monitorFullscreen();
                    }

                    if (btn) btn.disabled = false;
                } else {
                    console.warn('Fullscreen API not supported');
                    hideFullscreenPrompt(); // Tránh vòng lặp vô hạn nếu trình duyệt không hỗ trợ
                }
            } catch (error) {
                console.warn('Fullscreen request failed:', error);
                const btn = document.getElementById('fullscreenButton');
                if (btn) btn.disabled = false;

                const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
                if (isFS) {
                    hideFullscreenPrompt();
                } else {
                    showFullscreenButton();
                }
            }
        }

        // Functions for Report Error Modal
        function openReportModal(questionID) {
            const modal = document.getElementById('reportErrorOverlay');
            if (!modal) return;
            document.getElementById('reportQuestionID').value = questionID;
            document.getElementById('reportErrorType').value = '';
            
            const selectedText = document.querySelector('.custom-dropdown-selected');
            if (selectedText) {
                selectedText.textContent = '-- Chọn loại lỗi --';
            }
            
            document.getElementById('reportErrorDetails').value = '';
            modal.classList.add('is-open');
            modal.setAttribute('aria-hidden', 'false');
        }

        function closeReportModal() {
            const modal = document.getElementById('reportErrorOverlay');
            if (!modal) return;
            modal.classList.remove('is-open');
            modal.setAttribute('aria-hidden', 'true');
        }

        function openReportForCurrentQuestion() {
            if (typeof swiper !== 'undefined' && swiper && Array.isArray(displayQuestions) && displayQuestions.length > 0) {
                const currentQuestion = displayQuestions[swiper.activeIndex];
                if (currentQuestion && currentQuestion.questionID) {
                    openReportModal(String(currentQuestion.questionID));
                }
            }
        }

        async function submitQuestionReport(event) {
            event.preventDefault();
            const token = AuthManager.getToken();
            if (!token) return;

            const questionID = document.getElementById('reportQuestionID').value;
            const errorType = document.getElementById('reportErrorType').value;
            const details = document.getElementById('reportErrorDetails').value;
            const btnSubmit = document.getElementById('btnSubmitReport');

            if (!errorType) {
                await showInAppAlert('Vui lòng chọn loại lỗi');
                return;
            }

            try {
                btnSubmit.disabled = true;
                btnSubmit.textContent = 'Đang gửi...';

                const response = await APIClient.request('reportQuestionError', {
                    quizID: currentQuizID,
                    questionID: questionID,
                    errorType: errorType,
                    details: details
                });

                if (response.success) {
                    await showInAppAlert('Cảm ơn bạn đã báo cáo. Chúng tôi sẽ kiểm tra lại câu hỏi này!');
                    closeReportModal();
                } else {
                    await showInAppAlert('Lỗi: ' + response.message);
                }
            } catch (error) {
                console.error(error);
                await showInAppAlert('Có lỗi xảy ra khi gửi báo cáo');
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Gửi báo cáo';
            }
        }

        // Hiển thị nút fullscreen khi user từ chối hoặc không hỗ trợ
        function showFullscreenButton() {
            const fsPrompt = document.getElementById('fullscreenPrompt');
            if (fsPrompt) {
                fsPrompt.style.display = '';
                fsPrompt.classList.add('is-open');
                fsPrompt.setAttribute('aria-hidden', 'false');
            }
        }

        // Ẩn prompt fullscreen
        function hideFullscreenPrompt() {
            const fsPrompt = document.getElementById('fullscreenPrompt');
            if (fsPrompt) {
                fsPrompt.classList.remove('is-open');
                fsPrompt.style.display = '';
                fsPrompt.setAttribute('aria-hidden', 'true');
            }
        }

        // Init Swiper
        function initSwiper() {
            swiper = new Swiper('.mySwiper', {
                effect: 'fade',
                fadeEffect: {
                    crossFade: true
                },
                autoHeight: true,
                observer: true,
                observeParents: true,
                allowTouchMove: false,
                on: {
                    slideChange: function() {
                        updateQuestionIndicator();
                        try {
                            const raw = localStorage.getItem('quiz_state_' + currentQuizID);
                            if (raw) {
                                const st = JSON.parse(raw);
                                st.currentIndex = swiper.activeIndex;
                                localStorage.setItem('quiz_state_' + currentQuizID, JSON.stringify(st));
                            }
                        } catch(e){}
                    }
                }
            });
        }

        async function resolveCorrectOptionKey(questionID) {
            const questionKey = String(questionID);
            const cacheKey = `${currentQuizID}_${questionKey}`;
            if (correctOptionKeyByQuestion[cacheKey]) {
                return correctOptionKeyByQuestion[cacheKey];
            }

            if (correctOptionInFlightByQuestion[cacheKey]) {
                return correctOptionInFlightByQuestion[cacheKey];
            }

            const question = quizData.questions.find((item) => String(item.questionID) === questionKey);
            if (!question) {
                return null;
            }

            const localCorrectOption = String(question.correctOption || '').trim().toUpperCase();
            if (/^[A-D]$/.test(localCorrectOption)) {
                correctOptionKeyByQuestion[cacheKey] = localCorrectOption;
                return localCorrectOption;
            }

            const requestPromise = (async () => {
                try {
                    const result = await APIClient.resolveCorrectOption(currentQuizID, questionKey);
                    const resolvedKey = result && result.success ? String(result.correctOption || '').toUpperCase() : '';
                    if (/^[A-D]$/.test(resolvedKey)) {
                        correctOptionKeyByQuestion[cacheKey] = resolvedKey;
                        localStorage.setItem('quiz_correct_' + currentQuizID, JSON.stringify(correctOptionKeyByQuestion));
                        return resolvedKey;
                    }
                } catch (error) {
                    return null;
                } finally {
                    delete correctOptionInFlightByQuestion[cacheKey];
                }
                return null;
            })();

            correctOptionInFlightByQuestion[cacheKey] = requestPromise;

            return requestPromise;
        }

        function warmupPracticeCorrectOptions_() {
            if (!isPracticeModeEnabled(quizData.quizInfo) || !Array.isArray(displayQuestions) || displayQuestions.length === 0) {
                return;
            }

            const questionIDs = displayQuestions
                .map((item) => String(item && item.questionID ? item.questionID : '').trim())
                .filter(Boolean);

            if (!questionIDs.length) {
                return;
            }

            let cursor = 0;
            const batchSize = 4;

            const pump = () => {
                const batch = questionIDs.slice(cursor, cursor + batchSize);
                cursor += batch.length;

                batch.forEach((questionID) => {
                    prefetchCorrectOption_(questionID);
                });

                if (cursor < questionIDs.length) {
                    setTimeout(pump, 120);
                }
            };

            pump();
        }

        function prefetchCorrectOption_(questionID) {
            const questionKey = String(questionID || '').trim();
            if (!questionKey) {
                return;
            }

            resolveCorrectOptionKey(questionKey).catch(() => {
                // Prefetch best-effort only.
            });
        }

        // Chọn câu trả lời
        async function selectAnswer(questionID, answer) {
            const questionKey = String(questionID);
            const selectedValue = String(answer).toUpperCase();
            const practiceModeEnabled = isPracticeModeEnabled(quizData.quizInfo);
            const revealCorrectOnWrong = !!(quizData.quizInfo && quizData.quizInfo.revealCorrectOnWrong);

            // Mode showAnswer: mỗi câu chỉ cho chọn 1 lần.
            if (practiceModeEnabled && questionLocks[questionKey]) {
                return;
            }

            const radios = document.querySelectorAll(`input[name="q${questionKey}"]`);
            radios.forEach((radio) => {
                const isSelected = radio.value === selectedValue;
                radio.checked = isSelected;
                const optionLabel = radio.closest('.answer-option');
                if (optionLabel) {
                    const statusBadge = optionLabel.querySelector('.answer-status-badge');
                    optionLabel.classList.toggle('is-selected', radio.checked);
                    optionLabel.classList.remove('is-correct', 'is-wrong');
                    if (statusBadge) {
                        statusBadge.textContent = '';
                    }
                }
            });

            userAnswers[questionID] = answer;
            localStorage.setItem('quiz_draft_' + currentQuizID, JSON.stringify(userAnswers));

            if (autoNextTimer) {
                clearTimeout(autoNextTimer);
                autoNextTimer = null;
            }

            updateQuestionIndicator();

            if (!practiceModeEnabled) {
                if (autoNextEnabled && swiper && swiper.activeIndex < displayQuestions.length - 1) {
                    autoNextTimer = setTimeout(() => {
                        nextQuestion();
                        autoNextTimer = null;
                    }, 800);
                }
                return;
            }

            // Khóa ngay để tránh spam click/race khi đang chờ API resolve.
            questionLocks[questionKey] = true;
            radios.forEach((radio) => {
                radio.disabled = true;
            });

            const question = quizData.questions.find((q) => String(q.questionID) === questionKey);
            const hasLocalCorrectOption = !!(question && /^[A-D]$/.test(String(question.correctOption || '').trim().toUpperCase()));
            const correctValue = await resolveCorrectOptionKey(questionID);

            if (!/^[A-D]$/.test(String(correctValue || '').toUpperCase())) {
                questionLocks[questionKey] = false;
                radios.forEach((radio) => {
                    radio.disabled = false;
                });

                return;
            }

            // Nếu bật chế độ luyện tập (Show_Answer = TRUE), hiển thị kết quả ngay
            if (practiceModeEnabled) {
                const isCorrect = selectedValue === correctValue;

                radios.forEach((radio) => {
                    const isSelected = radio.value === selectedValue;
                    const isCorrectOption = radio.value === correctValue;
                    const shouldShowCorrect = (selectedValue === correctValue || revealCorrectOnWrong) && isCorrectOption;
                    const shouldShowWrong = isSelected && !isCorrectOption;
                    const optionLabel = radio.closest('.answer-option');
                    if (optionLabel) {
                        const statusBadge = optionLabel.querySelector('.answer-status-badge');
                        optionLabel.classList.toggle('is-correct', shouldShowCorrect);
                        optionLabel.classList.toggle('is-wrong', shouldShowWrong);
                        if (statusBadge) {
                            statusBadge.textContent = shouldShowCorrect ? '✓' : (shouldShowWrong ? '✕' : '');
                        }
                    }
                });


            }

            if (autoNextEnabled && swiper && swiper.activeIndex < displayQuestions.length - 1) {
                autoNextTimer = setTimeout(() => {
                    nextQuestion();
                    autoNextTimer = null;
                }, 800);
            }
        }

        // Cập nhật chỉ báo câu hỏi
        function updateQuestionIndicator() {
            const currentIndex = swiper.activeIndex + 1;
            document.getElementById('currentQuestion').textContent = currentIndex;

            if (isPracticeModeEnabled(quizData.quizInfo) && displayQuestions.length > 0) {
                const currentQuestion = displayQuestions[swiper.activeIndex];
                const nextQuestion = displayQuestions[swiper.activeIndex + 1];
                if (currentQuestion && currentQuestion.questionID) {
                    prefetchCorrectOption_(currentQuestion.questionID);
                }
                if (nextQuestion && nextQuestion.questionID) {
                    prefetchCorrectOption_(nextQuestion.questionID);
                }
            }

            const progressPercent = displayQuestions.length > 0
                ? (currentIndex / displayQuestions.length) * 100
                : 0;
            document.getElementById('progressFill').style.width = progressPercent + '%';

            // Cập nhật chỉ báo câu hỏi đã làm
            const indicatorDiv = document.getElementById('questionGridBody');
            if (!indicatorDiv) return;
            let html = '';
            for (let i = 0; i < displayQuestions.length; i++) {
                const qID = displayQuestions[i].questionID;
                const answered = userAnswers[qID] ? 'answered' : '';
                const flagged = flaggedQuestions[qID] ? 'is-flagged' : '';
                const active = i === swiper.activeIndex ? 'active' : '';
                const disabled = !allowBackNavigation ? 'is-disabled' : '';
                const clickHandler = allowBackNavigation ? `data-action="goto" data-question-index="${i}"` : '';
                html += `<button type="button" class="question-grid-item ${answered} ${flagged} ${active} ${disabled}" ${clickHandler}>Câu ${i + 1}</button>`;
            }
            indicatorDiv.replaceChildren();
            insertHtmlSafe(indicatorDiv, html);
        }

        // Điều hướng
        function prevQuestion() {
            if (!allowBackNavigation) {
                return;
            }

            if (swiper.activeIndex > 0) {
                swiper.slidePrev();
            }
        }

        function nextQuestion() {
            if (swiper.activeIndex < displayQuestions.length - 1) {
                swiper.slideNext();
            }
        }

        function goToQuestion(index) {
            if (!allowBackNavigation) {
                return;
            }
            swiper.slideTo(index);
        }

        function goToQuestionAndClose(index) {
            goToQuestion(index);
            closeQuestionListModal();
        }

        function openQuestionListModal() {
            document.getElementById('questionListOverlay').classList.add('is-open');
            document.getElementById('questionListOverlay').setAttribute('aria-hidden', 'false');
        }

        function closeQuestionListModal() {
            document.getElementById('questionListOverlay').classList.remove('is-open');
            document.getElementById('questionListOverlay').setAttribute('aria-hidden', 'true');
        }

        function closeQuestionListOnBackdrop(event) {
            if (event.target && event.target.id === 'questionListOverlay') {
                closeQuestionListModal();
            }
        }

        function updateTimerPresentation_(remainingSeconds) {
            const timerWrap = document.getElementById('timer');
            const timerValueNode = document.getElementById('timerValue');
            const timerProgressNode = document.getElementById('timerProgress');

            const safeRemaining = Math.max(0, Number(remainingSeconds || 0));
            const mins = Math.floor(safeRemaining / 60);
            const secs = safeRemaining % 60;
            const formatted =`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

            if (timerValueNode) {
                timerValueNode.textContent = formatted;
            }

            if (timerWrap && timerProgressNode) {
                const total = Number(quizData?.quizInfo?.timeLimit || 0) * 60;
                if (total > 0) {
                    const pct = (safeRemaining / total) * 100;
                    timerProgressNode.style.width = pct + '%';

                    if (safeRemaining <= 60) {
                        timerWrap.classList.add('danger');
                    } else if (safeRemaining <= 300) {
                        timerWrap.classList.add('warning');
                        timerWrap.classList.remove('danger');
                    } else {
                        timerWrap.classList.remove('warning', 'danger');
                    }
                }
            }
        }

        function startTimer(minutes, exactSeconds = null) {
            let totalSeconds = exactSeconds !== null ? exactSeconds : (minutes ? minutes * 60 : 0);
            if (totalSeconds <= 0) {
                const timerWrap = document.getElementById('timer');
                if (timerWrap) timerWrap.style.display = 'none';
                return;
            }

            timeRemaining = totalSeconds;
            updateTimerPresentation_(timeRemaining);

            if (timerInterval) {
                clearInterval(timerInterval);
            }

            timerInterval = setInterval(() => {
                timeRemaining--;
                updateTimerPresentation_(timeRemaining);

                if (timeRemaining <= 0) {
                    clearInterval(timerInterval);
                    submitQuiz(false, true);
                }
            }, 1000);
        }

        // Nộp bài
        window.submitQuiz = submitQuiz;
        async function submitQuiz(isForced = false, skipConfirm = false) {
            if (isSubmitting) {
                return;
            }

            isSubmitting = true;
            clearInterval(timerInterval);
            if (autoNextTimer) {
                clearTimeout(autoNextTimer);
                autoNextTimer = null;
            }
            
            try {
                if (!skipConfirm) {
                    antiCheat.setDialogOpen(true);
                    const confirmed = await showInAppConfirm('Bạn có chắc muốn nộp bài?');
                    antiCheat.setDialogOpen(false);

                    if (!confirmed) {
                        startTimer(Math.ceil(timeRemaining / 60));
                        isSubmitting = false;
                        return;
                    }
                }

                // Tính điểm do server quyết định, client chỉ gửi đáp án.
                const totalQuestions = displayQuestions.length;

                // Gá»­i káº¿t quáº£ lÃªn GAS
                const username = localStorage.getItem('quizUsername');
                const quizID = localStorage.getItem('currentQuizID');

                // Show loading
                const loadingOverlay = document.getElementById('loadingOverlay');
                const loadingText = document.getElementById('loadingText');
                if (loadingOverlay) {
                    loadingText.textContent = 'Đang nộp bài...';
                    loadingOverlay.classList.add('is-visible');
                    loadingOverlay.setAttribute('aria-hidden', 'false');
                }

                const answersForSubmit = isForced ? {} : userAnswers;
                const violationLogs = (typeof antiCheat !== 'undefined' && typeof antiCheat.getViolationLogs === 'function') 
                    ? antiCheat.getViolationLogs() 
                    : [];
                const result = await APIClient.submitScore(username, quizID, answersForSubmit, violationLogs);

                // Hide loading
                if (loadingOverlay) {
                    loadingOverlay.classList.remove('is-visible');
                    loadingOverlay.setAttribute('aria-hidden', 'true');
                }

                if (!result.success) {
                    await showInAppAlert(result.message || 'Lỗi khi nộp bài. Vui lòng thử lại!');
                    isSubmitting = false;
                    return;
                }

                const finalScore = typeof result.score === 'number' ? result.score : 0;
                const finalCorrect = typeof result.correctCount === 'number' ? result.correctCount : 0;
                const finalTotal = typeof result.totalQuestions === 'number' ? result.totalQuestions : totalQuestions;

                // LÆ°u káº¿t quáº£ vÃ o sessionStorage Ä‘á»ƒ hiá»ƒn thá»‹ á»Ÿ trang káº¿t quáº£
                sessionStorage.setItem('quizResult', JSON.stringify({
                    score: finalScore,
                    correct: finalCorrect,
                    total: finalTotal,
                    reviewItems: result.reviewItems || result.correctAnswers || [],
                    explanations: result.explanations || [],
                    quizMode: {
                        showDetailedResult: !!(quizData.quizInfo && quizData.quizInfo.showDetailedResult),
                        shuffle: !!(quizData.quizInfo && quizData.quizInfo.shuffle),
                        questionOrder: displayQuestions.map((question) => String(question.questionID || '')),
                        optionOrderByQuestion
                    }
                }));

                // Xóa nháp
                localStorage.removeItem('quiz_draft_' + currentQuizID);
                localStorage.removeItem('quiz_flagged_' + currentQuizID);
                localStorage.removeItem('quiz_correct_' + currentQuizID);
                localStorage.removeItem('quiz_state_' + currentQuizID);

                // Disable Anti-Cheat before valid redirect to prevent beforeunload popup
                if (typeof antiCheat !== 'undefined') {
                    antiCheat.setDialogOpen(true);
                    antiCheat.disable();
                }
                // Redirect tới trang kết quả
                window.location.href = 'result';
            } catch (error) {
                console.error('Error submitting quiz:', error);
                await showInAppAlert('Lỗi khi nộp bài. Vui lòng thử lại!');
                isSubmitting = false;
            }
        }

        // XÃ¡c nháº­n thoÃ¡t tá»›i trang báº¥t ká»³
        async function confirmExitTo(targetUrl = 'dashboard') {
            if (isSubmitting) {
                return;
            }

            antiCheat.setDialogOpen(true);
            const shouldExit = await showInAppConfirm('Bạn chưa hoàn thành quiz. Bạn có chắc muốn thoát?');
            antiCheat.setDialogOpen(false);

            if (shouldExit) {
                if (autoNextTimer) {
                    clearTimeout(autoNextTimer);
                    autoNextTimer = null;
                }
                // Disable Anti-Cheat before valid redirect to prevent beforeunload popup
                if (typeof antiCheat !== 'undefined') {
                    antiCheat.disable();
                }
                window.location.href = targetUrl;
            }
        }

        // Backward-compatible alias cho các chỗ cũ
        async function confirmExit() {
            return confirmExitTo('dashboard');
        }

        // Khởi chạy
        function bindQuizControls() {
            const submitQuizBtn = document.getElementById('submitQuizBtn');
            if (submitQuizBtn) {
                submitQuizBtn.addEventListener('click', () => submitQuiz());
            }

            const backToDashboardBtn = document.getElementById('backToDashboardBtn');
            if (backToDashboardBtn) {
                backToDashboardBtn.addEventListener('click', () => confirmExitTo('dashboard'));
            }

            const fullscreenButton = document.getElementById('fullscreenButton');
            if (fullscreenButton) {
                fullscreenButton.addEventListener('click', requestFullscreenMode);
            }

            const closeImageViewerBtn = document.getElementById('closeImageViewerBtn');
            if (closeImageViewerBtn) {
                closeImageViewerBtn.addEventListener('click', closeImageViewer);
            }

            document.querySelectorAll('[data-confirm-exit]').forEach((link) => {
                link.addEventListener('click', (event) => {
                    const targetUrl = link.getAttribute('data-confirm-exit');
                    if (!targetUrl) {
                        return;
                    }

                    event.preventDefault();
                    confirmExitTo(targetUrl);
                });
            });
        }

        bindQuizControls();
        initQuiz();

        // Initialize custom dropdown
        const customDropdown = document.getElementById('customErrorTypeDropdown');
        if (customDropdown) {
            const selected = customDropdown.querySelector('.custom-dropdown-selected');
            const options = customDropdown.querySelector('.custom-dropdown-options');
            const hiddenInput = document.getElementById('reportErrorType');

            selected.addEventListener('click', (e) => {
                options.classList.toggle('show');
                selected.classList.toggle('open');
                e.stopPropagation();
            });

            options.querySelectorAll('div').forEach(option => {
                option.addEventListener('click', () => {
                    selected.textContent = option.textContent;
                    hiddenInput.value = option.getAttribute('data-value');
                    options.classList.remove('show');
                    selected.classList.remove('open');
                });
            });

            document.addEventListener('click', () => {
                options.classList.remove('show');
                selected.classList.remove('open');
            });
        }

Object.assign(window, {
    confirmExitTo,
    submitQuiz,
    requestFullscreenMode,
    closeImageViewer,
    openImageViewer
});
