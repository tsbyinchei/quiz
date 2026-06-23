
function handleVerifyAnswer(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token) {
        return JsonResponse({ success: false, message: 'Invalid token' });
    }

    const quizID = String(data.quizID || '').trim();
    const questionID = String(data.questionID || '').trim();
    const userAnswer = String(data.userAnswer || '').trim().toUpperCase();

    if (!quizID || !questionID || !/^[A-D]$/.test(userAnswer)) {
        return JsonResponse({ success: false, message: 'Thiếu dữ liệu kiểm tra đáp án' });
    }

    const runtimeModes = getQuizRuntimeModesByID_(sheetsRef.quizList, quizID);
    if (!runtimeModes) {
        return JsonResponse({ success: false, message: 'Quiz not found' });
    }

    if (!runtimeModes.practiceFeedbackEnabled) {
        return JsonResponse({ success: false, message: 'Answer verification unavailable for this quiz mode' });
    }

    const quizQuestions = getQuizQuestionsCached_(sheetsRef, quizID);
    for (let i = 0; i < quizQuestions.length; i++) {
        const q = quizQuestions[i];
        if (q.questionID !== questionID) continue;

        const correctAnswer = String((q.answerData || {}).correctAnswer || '').trim().toUpperCase();

        return JsonResponse({
            success: true,
            correct: userAnswer === correctAnswer
        });
    }

    return JsonResponse({ success: false, message: 'Question not found' });
}


function handleResolveCorrectOption(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token) {
        return JsonResponse({ success: false, message: 'Invalid token' });
    }

    const quizID = String(data.quizID || '').trim();
    const questionID = String(data.questionID || '').trim();

    if (!quizID || !questionID) {
        return JsonResponse({ success: false, message: 'Thiếu dữ liệu câu hỏi' });
    }

    const runtimeModes = getQuizRuntimeModesByID_(sheetsRef.quizList, quizID);
    if (!runtimeModes) {
        return JsonResponse({ success: false, message: 'Quiz not found' });
    }

    if (!runtimeModes.practiceFeedbackEnabled) {
        return JsonResponse({ success: false, message: 'Answer resolution unavailable for this quiz mode' });
    }

    const quizQuestions = getQuizQuestionsCached_(sheetsRef, quizID);
    for (let i = 0; i < quizQuestions.length; i++) {
        const q = quizQuestions[i];
        if (q.questionID !== questionID) continue;

        const correctAnswer = String((q.answerData || {}).correctAnswer || '').trim().toUpperCase();
        if (!/^[A-D]$/.test(correctAnswer)) {
            return JsonResponse({ success: false, message: 'Dữ liệu đáp án không hợp lệ' });
        }

        return JsonResponse({
            success: true,
            correctOption: correctAnswer
        });
    }

    return JsonResponse({ success: false, message: 'Question not found' });
}


// ==================== GRADING ====================

function handleSubmitScore(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token) {
        return JsonResponse({success: false, message: 'Invalid token'});
    }

    const username = token.username;
    const quizID = String(data.quizID || '').trim();
    if (!quizID) {
        return JsonResponse({success: false, message: 'Quiz ID is required'});
    }

    let userAnswers = {};
    try {
        userAnswers = typeof data.userAnswers === 'string'
            ? JSON.parse(data.userAnswers)
            : (data.userAnswers || {});
    } catch (e) {
        return JsonResponse({success: false, message: 'Invalid user answers payload'});
    }

    if (!userAnswers || typeof userAnswers !== 'object' || Array.isArray(userAnswers)) {
        return JsonResponse({success: false, message: 'Invalid user answers payload'});
    }

    let violationLogs = [];
    try {
        violationLogs = typeof data.violationLogs === 'string'
            ? JSON.parse(data.violationLogs)
            : (Array.isArray(data.violationLogs) ? data.violationLogs : []);
    } catch (e) {}

    const timestamp = new Date().toLocaleString();

    const quizQuestions = getQuizQuestionsCached_(sheetsRef, quizID);
    const reviewItems = [];
    const correctAnswers = [];
    const explanations = [];
    let correctCount = 0;
    let totalQuestions = 0;

    for (let i = 0; i < quizQuestions.length; i++) {
        const q = quizQuestions[i];
        const questionID = q.questionID;
        const questionText = q.questionText;
        const optionA = q.optionA || '';
        const optionB = q.optionB || '';
        const optionC = q.optionC || '';
        const optionD = q.optionD || '';
        const answerData = q.answerData || {};
        const correctAnswer = answerData.correctAnswer;
        const explanation = answerData.explanation;
        const selectedAnswer = String(userAnswers[questionID] || '').trim().toUpperCase();
        const isCorrect = selectedAnswer !== '' && selectedAnswer === String(correctAnswer || '').trim().toUpperCase();

        totalQuestions++;
        if (isCorrect) {
            correctCount++;
        }

        reviewItems.push({
            questionID: questionID,
            questionText: questionText,
            userAnswer: selectedAnswer,
            correctAnswer: correctAnswer,
            explanation: explanation,
            optionA: optionA,
            optionB: optionB,
            optionC: optionC,
            optionD: optionD
        });

        correctAnswers.push({
            questionID: questionID,
            correctAnswer: correctAnswer,
            questionText: questionText,
            userAnswer: selectedAnswer,
            optionA: optionA,
            optionB: optionB,
            optionC: optionC,
            optionD: optionD
        });

        explanations.push({
            questionID: questionID,
            explanation: explanation
        });
    }

    let computedScore = totalQuestions > 0 ? (correctCount / totalQuestions) * 10 : 0;

    // Nếu vi phạm >= 3 lần (Cheat detected via logs Accumulator), hủy toàn bộ kết quả
    if (violationLogs.length >= 3) {
        computedScore = 0;
        correctCount = 0;
        userAnswers = { "CHEAT_DETECTED": true };
    }

    // Tạo LogID
    const logID = `${username}-${quizID}-${Date.now()}`;

    // Thêm vào Attempt_Logs sheet
    const newRow = [logID, username, quizID, computedScore, JSON.stringify(userAnswers), timestamp];
    sheetsRef.logs.appendRow(newRow);

    // Ghi log cheat hàng loạt nếu có
    if (violationLogs.length > 0) {
        const cheatRows = violationLogs.map(log => {
            const cLogID = `CHEAT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
            const payload = JSON.stringify({
                violationType: log.violationType || 'unknown',
                cheatCount: log.cheatCount || 0,
                userAgent: log.userAgent || '',
                originalTimestamp: log.timestamp || new Date().toISOString()
            });
            return [cLogID, username, quizID, 'CHEAT', payload, timestamp];
        });
        
        // Push tất cả cheat logs vào Attempt_Logs
        for (let r = 0; r < cheatRows.length; r++) {
            sheetsRef.logs.appendRow(cheatRows[r]);
        }
    }

    invalidateAdminCache_();
    invalidateDashboardStatsCacheForUser_(username);

    return JsonResponse({
        success: true,
        message: 'Score submitted successfully',
        logID: logID,
        score: computedScore,
        correctCount: correctCount,
        totalQuestions: totalQuestions,
        correctAnswers: correctAnswers,
        explanations: explanations,
        reviewItems: reviewItems
    });
}


function handleGetUserStats(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token) {
        return JsonResponse({success: false, message: 'Invalid token'});
    }

    const username = token.role === 'Admin' && data.username ? data.username : token.username;
    const stats = getUserStatsCached_(sheetsRef, username);

    return JsonResponse({
        success: true,
        stats: stats
    });
}


function handleGetDashboardStats(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token) {
        return JsonResponse({ success: false, message: 'Invalid token' });
    }

    const username = token.role === 'Admin' && data.username ? data.username : token.username;
    const snapshot = getDashboardStatsSnapshot_(sheetsRef, username);

    return JsonResponse({
        success: true,
        username: username,
        snapshot: snapshot
    });
}
