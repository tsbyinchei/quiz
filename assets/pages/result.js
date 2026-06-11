const imageViewerOverlay = document.getElementById('imageViewerOverlay');
        const imageViewerImg = document.getElementById('imageViewerImg');
        const imageViewerCaption = document.getElementById('imageViewerCaption');

        function escapeHtml(text) {
            return String(text || '')
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

        function sanitizeAikenRichText(input, { allowImage = true } = {}) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(String(input || ''), 'text/html');

            const allowedTextTags = new Set(['BR', 'B', 'STRONG', 'I', 'EM', 'U', 'CODE']);

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

                    const textNode = document.createTextNode(child.textContent || '');
                    child.replaceWith(textNode);
                }
            };

            walk(doc.body);
            return doc.body.innerHTML;
        }

        function openImageViewer(src, alt = 'Ảnh minh họa') {
            if (!imageViewerOverlay || !imageViewerImg || !isSafeImageSrc(src)) {
                return;
            }

            imageViewerImg.src = src;
            imageViewerImg.alt = alt || 'Ảnh minh họa';
            if (imageViewerCaption) {
                imageViewerCaption.textContent = alt || '';
            }

            imageViewerOverlay.classList.add('is-open');
            imageViewerOverlay.setAttribute('aria-hidden', 'false');
        }

        function closeImageViewer() {
            if (!imageViewerOverlay || !imageViewerImg) {
                return;
            }

            imageViewerOverlay.classList.remove('is-open');
            imageViewerOverlay.setAttribute('aria-hidden', 'true');
            imageViewerImg.src = '';
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
            }
        });



        function normalizeOptionText(value) {
            return String(value || '').replace(/^[A-D][\.)]\s*/i, '').trim();
        }

        function renderAnswerText(answerKey, item, showPrefix) {
            const key = String(answerKey || '').trim().toUpperCase();
            const text = getAnswerText(key, item);

            if (!key) {
                return 'Chưa chọn';
            }

            if (!text) {
                return escapeHtml(key);
            }

            const safeText = sanitizeAikenRichText(text, { allowImage: true });
            return showPrefix ? '<span class="option-prefix">' + escapeHtml(key) + '.</span> ' + safeText : safeText;
        }

        function getAnswerText(answerKey, item) {
            const answerMap = {
                A: normalizeOptionText(item.optionA || ''),
                B: normalizeOptionText(item.optionB || ''),
                C: normalizeOptionText(item.optionC || ''),
                D: normalizeOptionText(item.optionD || '')
            };

            const key = String(answerKey || '').trim().toUpperCase();
            return answerMap[key] || '';
        }

        function formatAnswerLabel(answerKey, item, showPrefix) {
            const key = String(answerKey || '').trim().toUpperCase();
            const text = getAnswerText(key, item);

            if (!key) {
                return 'Chưa chọn';
            }

            if (!text) {
                return key;
            }

            return showPrefix ? `${key}. ${text}` : text;
        }

        function formatOptionOrder(item, optionOrder = [], shouldShowOptionPrefix = true) {
            const normalizedOrder = Array.isArray(optionOrder) && optionOrder.length === 4
                ? optionOrder
                : ['A', 'B', 'C', 'D'];

            return normalizedOrder
                .map((optionKey) => {
                    const key = String(optionKey || '').trim().toUpperCase();
                    const text = getAnswerText(key, item);
                    if (!text) {
                        return null;
                    }

                    return {
                        key,
                        text: shouldShowOptionPrefix ? `${key}. ${text}` : text
                    };
                })
                .filter(Boolean);
        }

        function getItemQuestionID(item) {
            return String(item.questionID || item.questionId || item.id || '').trim();
        }

        function displayResult() {
            const result = sessionStorage.getItem('quizResult');
            
            if (!result) {
                window.location.href = 'dashboard.html';
                return;
            }

            const data = JSON.parse(result);
            const score = Number(data.score || 0);
            const correct = data.correct;
            const total = data.total;
            const reviewItems = data.reviewItems || [];
            const quizMode = data.quizMode || {};
            const shouldShowDetailedResult = quizMode.showDetailedResult !== false;

            // Cập nhật UI
            document.getElementById('scoreValue').textContent = `${score.toFixed(1)}/10`;
            document.getElementById('correctCount').textContent = correct;
            document.getElementById('incorrectCount').textContent = total - correct;
            document.getElementById('ratioValue').textContent = `${correct}/${total}`;
            document.getElementById('scoreProgressBar').style.width = `${Math.max(0, Math.min(100, score * 10))}%`;

            // Thông điệp kết quả
            const messageDiv = document.getElementById('resultMessage');
            let message = '';
            let messageClass = '';

            if (score >= 8) {
                message = '🎉 Xuất Sắc! Bạn đã làm rất tốt!';
                messageClass = 'correct';
            } else if (score >= 6) {
                message = '👍 Tốt! Hãy tiếp tục cố gắng!';
                messageClass = 'correct';
            } else if (score >= 4) {
                message = '⚠️ Bạn cần tập luyện thêm!';
                messageClass = 'warning';
            } else {
                message = '📚 Hãy ôn luyện thêm trước khi thi lại!';
                messageClass = 'incorrect';
            }

            messageDiv.textContent = message;
            messageDiv.className = `result-message feedback ${messageClass}`;

            const reviewWrap = document.querySelector('.review-wrap');
            if (reviewWrap) {
                reviewWrap.style.display = shouldShowDetailedResult ? '' : 'none';
            }

            if (shouldShowDetailedResult) {
                renderReviewList(reviewItems, quizMode);
            }

            // Xóa từ sessionStorage sau khi hiển thị
            sessionStorage.removeItem('quizResult');
        }

        function renderReviewList(reviewItems, quizMode = {}) {
            const container = document.getElementById('reviewList');

            if (!reviewItems || reviewItems.length === 0) {
                container.textContent = '';
                container.insertAdjacentHTML('beforeend', '<p class="empty-state">Không có dữ liệu review.</p>');
                return;
            }

            const shouldShowOptionPrefix = !(quizMode && quizMode.shuffle);
            const questionOrder = Array.isArray(quizMode.questionOrder) ? quizMode.questionOrder.map((id) => String(id)) : [];
            const optionOrderByQuestion = quizMode && quizMode.optionOrderByQuestion ? quizMode.optionOrderByQuestion : {};
            const orderMap = new Map(questionOrder.map((id, index) => [id, index]));
            const orderedItems = [...reviewItems].sort((a, b) => {
                const aID = getItemQuestionID(a);
                const bID = getItemQuestionID(b);
                const aOrder = orderMap.has(aID) ? orderMap.get(aID) : Number.MAX_SAFE_INTEGER;
                const bOrder = orderMap.has(bID) ? orderMap.get(bID) : Number.MAX_SAFE_INTEGER;
                return aOrder - bOrder;
            });

            container.textContent = '';
            container.insertAdjacentHTML('beforeend', orderedItems.map((item, index) => {
                const questionID = getItemQuestionID(item);
                const userAnswer = String(item.userAnswer || '').trim().toUpperCase();
                const correctAnswer = String(item.correctAnswer || '').trim().toUpperCase();
                const isAnswered = userAnswer !== '';
                const isCorrect = isAnswered && userAnswer === correctAnswer;
                const statusClass = isCorrect ? 'correct' : (isAnswered ? 'wrong' : 'unanswered');
                const statusIcon = isCorrect ? '✓' : (isAnswered ? '✕' : '–');
                const statusText = isCorrect ? 'Đúng' : (isAnswered ? 'Sai' : 'Chưa làm');
                const userBadgeClass = isCorrect ? 'correct' : (isAnswered ? 'wrong' : 'neutral');
                const userBadgeIcon = isCorrect ? '✓' : (isAnswered ? '✕' : '–');
                const answerOrder = formatOptionOrder(
                    item,
                    optionOrderByQuestion[questionID],
                    shouldShowOptionPrefix
                );

                return `
                <div class="review-card">
                    <div class="review-card-header">
                        <div class="review-status ${statusClass}" aria-hidden="true">${statusIcon}</div>
                        <div class="review-card-title">
                            <div class="review-question">${index + 1}. ${sanitizeAikenRichText(item.questionText || '', { allowImage: true })}</div>
                        </div>
                    </div>
                    <div class="review-options-seq">
                        <div class="review-options-seq-list">
                            ${answerOrder.map((optionItem) => {
                                const optionKey = String(optionItem.key || '').toUpperCase();
                                const optionClasses = [
                                    'review-option-line',
                                    optionKey === correctAnswer ? 'correct' : '',
                                    optionKey === userAnswer ? 'selected' : '',
                                    optionKey === userAnswer && userAnswer !== correctAnswer ? 'wrong' : ''
                                ].filter(Boolean).join(' ');

                                const chip = optionKey === correctAnswer ? '✓' : (optionKey === userAnswer ? '●' : '•');

                                return '<div class="' + optionClasses + '"><span class="review-option-chip" aria-hidden="true">' + chip + '</span><span>' + sanitizeAikenRichText(optionItem.text, { allowImage: true }) + '</span></div>';
                            }).join('')}
                        </div>
                    </div>

                </div>
            `;
            }).join(''));
        }

        function restartQuiz() {

            const quizID = localStorage.getItem('currentQuizID');
            window.location.href = quizID ? 'quiz.html' : 'dashboard.html';
        }

        // Hiển thị kết quả khi trang load
        displayResult();