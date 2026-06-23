
// ==================== ADMIN ====================

function handleGetAdminData(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token || token.role !== 'Admin') {
        return JsonResponse({success: false, message: 'Unauthorized'});
    }

    if (!hasValidAdminPinProof_(data, token)) {
        return JsonResponse({success: false, message: 'Admin PIN required'});
    }

    if (data.forceRefresh === true || data.forceRefresh === 'true') {
        invalidateAdminCache_();
        invalidateDashboardQuizCaches_();
    }

    // Try to use cached data
    const cachedData = getCachedAdminData_();
    if (cachedData && data.forceRefresh !== true && data.forceRefresh !== 'true') {
        return JsonResponse({success: true, stats: cachedData.stats, quizzes: cachedData.quizzes});
    }

    // No cache, fetch from sheets
    const quizListSchema = getQuizListSchema_(sheetsRef.quizList);
    const quizListData = sheetsRef.quizList.getDataRange().getValues();
    const questionsData = sheetsRef.questions.getDataRange().getValues();
    const logsData = sheetsRef.logs.getDataRange().getValues();

    const totalQuizzes = quizListData.length - 1;
    const activeUsers = new Set();
    let totalScores = 0;
    let totalAttempts = 0;

    const attemptCountByQuiz = {};
    const questionCountByQuiz = {};

    for (let i = 1; i < questionsData.length; i++) {
        const quizID = questionsData[i][1];
        if (!quizID) continue;
        questionCountByQuiz[quizID] = (questionCountByQuiz[quizID] || 0) + 1;
    }

    for (let i = 1; i < logsData.length; i++) {
        const quizID = logsData[i][2];
        const username = logsData[i][1];
        const score = parseFloat(logsData[i][3]);

        if (!isNaN(score)) {
            totalAttempts++;
            totalScores += score;
            if (username) {
                activeUsers.add(username);
            }
            if (quizID) {
                attemptCountByQuiz[quizID] = (attemptCountByQuiz[quizID] || 0) + 1;
            }
        }
    }

    const averageScore = totalAttempts > 0 ? totalScores / totalAttempts : 0;

    // ----- TÍNH NĂNG MỚI: Thống kê mở rộng -----
    const usersData = sheetsRef.users.getDataRange().getValues();
    const referralData = sheetsRef.referralCodes ? sheetsRef.referralCodes.getDataRange().getValues() : [];
    const userSchema = getUsersSchema_(sheetsRef.users);
    const referralSchema = getReferralCodesSchema_(sheetsRef.referralCodes);

    // 1. Dung Lượng Cơ Sở Dữ Liệu
    const dbHealth = {
        quizListRows: quizListData.length,
        questionsRows: questionsData.length,
        logsRows: logsData.length,
        usersRows: usersData.length,
        referralRows: referralData.length,
        totalRows: quizListData.length + questionsData.length + logsData.length + usersData.length + referralData.length
    };

    // 2. Thống Kê Người Dùng Mới & Nguồn Truy Cập
    let newUsersLast7Days = 0;
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    if (userSchema && userSchema.createdAt >= 0) {
        for (let i = 1; i < usersData.length; i++) {
            const createdAtStr = usersData[i][userSchema.createdAt];
            if (createdAtStr) {
                const createdAt = new Date(createdAtStr);
                if (createdAt >= sevenDaysAgo) {
                    newUsersLast7Days++;
                }
            }
        }
    }

    let activeReferrals = 0;
    let usedReferrals = 0;
    for (let i = 1; i < referralData.length; i++) {
        const status = String(referralData[i][referralSchema.status] || '').trim().toLowerCase();
        if (status === 'active') activeReferrals++;
        else if (status === 'used') usedReferrals++;
    }

    // 3. Hoạt động gần đây (Top 10 mới nhất)
    const recentActivity = [];
    for (let i = logsData.length - 1; i >= 1 && recentActivity.length < 10; i--) {
        recentActivity.push({
            username: logsData[i][1],
            quizID: logsData[i][2],
            score: parseFloat(logsData[i][3]),
            timestamp: logsData[i][5] || ''
        });
    }

    // 4. Cảnh Báo Câu Hỏi Có Vấn Đề
    const correctAnswersMap = {};
    const questionTextMap = {};
    for (let i = 1; i < questionsData.length; i++) {
        const qID = questionsData[i][0];
        const answerData = extractAnswerData_(questionsData[i]);
        correctAnswersMap[qID] = answerData.correctAnswer;
        questionTextMap[qID] = questionsData[i][2];
    }

    const questionStatsMap = {};
    for (let i = 1; i < logsData.length; i++) {
        const scoreVal = logsData[i][3];
        if (scoreVal === 'CHEAT' || String(logsData[i][0]).startsWith('CHEAT-')) {
            continue;
        }

        const qzID = logsData[i][2];
        const userAnswersStr = logsData[i][4];
        let userAnswers = null;
        try {
            if (userAnswersStr) userAnswers = JSON.parse(userAnswersStr);
        } catch (e) {}

        if (userAnswers && typeof userAnswers === 'object') {
            for (const qID in userAnswers) {
                if (!(qID in correctAnswersMap)) {
                    continue; // Bỏ qua câu hỏi rác hoặc đã bị xoá
                }
                
                if (!questionStatsMap[qID]) {
                    questionStatsMap[qID] = { attempts: 0, wrong: 0, quizID: qzID };
                }
                questionStatsMap[qID].attempts++;
                const selected = String(userAnswers[qID] || '').trim().toUpperCase();
                const correct = String(correctAnswersMap[qID] || '').trim().toUpperCase();
                if (selected !== correct) {
                    questionStatsMap[qID].wrong++;
                }
            }
        }
    }

    const problematicQuestions = Object.keys(questionStatsMap).map(qID => {
        const stat = questionStatsMap[qID];
        return {
            questionID: qID,
            quizID: stat.quizID,
            questionText: questionTextMap[qID] || '',
            attempts: stat.attempts,
            wrong: stat.wrong,
            wrongRate: stat.attempts > 0 ? (stat.wrong / stat.attempts) : 0
        };
    }).filter(q => q.attempts >= 3 && q.wrongRate >= 0.5)
      .sort((a, b) => b.wrongRate - a.wrongRate)
      .slice(0, 10);

    // 5. Báo cáo lỗi
    const reportedQuestions = [];
    if (sheetsRef.reports) {
        try {
            const reportsData = sheetsRef.reports.getDataRange().getValues();
            for (let i = reportsData.length - 1; i >= 1 && reportedQuestions.length < 10; i--) {
                const qID = reportsData[i][2];
                if (!(qID in correctAnswersMap)) {
                    continue; // Bỏ qua nếu câu hỏi đã bị xóa
                }
                reportedQuestions.push({
                    username: reportsData[i][0],
                    quizID: reportsData[i][1],
                    questionID: qID,
                    errorType: reportsData[i][3],
                    details: reportsData[i][4],
                    timestamp: reportsData[i][5] || '',
                    questionText: questionTextMap[qID] || ''
                });
            }
        } catch(e) {}
    }

    const stats = {
        totalQuizzes: totalQuizzes,
        totalAttempts: totalAttempts,
        activeUsers: activeUsers.size,
        averageScore: averageScore,
        dbHealth: dbHealth,
        totalUsers: (usersData.length > 0) ? usersData.length - 1 : 0,
        referralStats: { active: activeReferrals, used: usedReferrals },
        recentActivity: recentActivity,
        problematicQuestions: problematicQuestions,
        reportedQuestions: reportedQuestions
    };

    // Lấy danh sách quiz cho quản lý
    const quizzes = [];
    for (let i = 1; i < quizListData.length; i++) {
        const antiCheatModes = getRowAntiCheatModes_(quizListData[i], quizListSchema);
        const practiceModes = getRowPracticeModes_(quizListData[i], quizListSchema);
        const quizID = quizListData[i][quizListSchema.quizID];

        quizzes.push({
            quizID: quizID,
            subject: quizListData[i][quizListSchema.subject],
            title: quizListData[i][quizListSchema.title],
            description: quizListData[i][quizListSchema.description],
            status: isTruthy_(quizListData[i][quizListSchema.status]),
            showAnswer: practiceModes.showAnswer,
            revealCorrectOnWrong: practiceModes.revealCorrectOnWrong,
            showDetailedResult: getShowDetailedResult_(quizListData[i], quizListSchema),
            shuffle: isTruthy_(quizListData[i][quizListSchema.shuffle]),
            antiCheat: antiCheatModes.antiCheat,
            antiCheatTabSwitch: antiCheatModes.antiCheatTabSwitch,
            antiCheatFullscreen: antiCheatModes.antiCheatFullscreen,
            autoNext: isTruthy_(quizListData[i][quizListSchema.autoNext]),
            allowBack: isTruthy_(quizListData[i][quizListSchema.allowBack]),
            questionCount: questionCountByQuiz[quizID] || 0,
            attempts: attemptCountByQuiz[quizID] || 0
        });
    }

    // Cache the result for 5 minutes
    setCachedAdminData_({stats: stats, quizzes: quizzes});

    return JsonResponse({
        success: true,
        stats: stats,
        quizzes: quizzes
    });
}


function handleVerifyAdminPin(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token || token.role !== 'Admin') {
        return JsonResponse({success: false, message: 'Unauthorized'});
    }

    const pinHash = String(data.pinHash || '').trim();
    if (!pinHash) {
        return JsonResponse({success: false, message: 'PIN is required'});
    }

    if (isRateLimited_('admin_pin', token.username)) {
        return JsonResponse({success: false, message: 'Invalid PIN'});
    }

    const userSchema = getUsersSchema_(sheetsRef.users);
    const usersData = sheetsRef.users.getDataRange().getValues();
    for (let i = 1; i < usersData.length; i++) {
        const username = String(usersData[i][userSchema.username] || '').trim();
        if (username.toLowerCase() !== String(token.username || '').toLowerCase()) {
            continue;
        }

        const storedPinHash = String(usersData[i][userSchema.adminPinHash] || '').trim();
        if (!storedPinHash) {
            return JsonResponse({success: false, message: 'Admin PIN not configured'});
        }

        if (storedPinHash === pinHash) {
            clearRateLimitFailures_('admin_pin', token.username);
            const adminPinProof = generateAdminPinProof_(token.username);
            return JsonResponse({success: true, message: 'PIN verified', adminPinProof: adminPinProof});
        }

        registerRateLimitFailure_('admin_pin', token.username);

        return JsonResponse({success: false, message: 'Invalid PIN'});
    }

    registerRateLimitFailure_('admin_pin', token.username);

    return JsonResponse({success: false, message: 'Admin account not found'});
}


function handleGetReferralCodes(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token || token.role !== 'Admin') {
        return JsonResponse({success: false, message: 'Unauthorized'});
    }

    if (!hasValidAdminPinProof_(data, token)) {
        return JsonResponse({success: false, message: 'Admin PIN required'});
    }

    const referralSheet = sheetsRef.referralCodes;
    if (!referralSheet) {
        return JsonResponse({success: false, message: 'Sheet ReferralCodes không tồn tại'});
    }

    const referralSchema = getReferralCodesSchema_(referralSheet);
    const rows = referralSheet.getDataRange().getValues();
    const items = [];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i] || [];
        const code = String(row[referralSchema.code] || '').trim();
        if (!code) {
            continue;
        }

        items.push({
            code: code,
            status: String(row[referralSchema.status] || '').trim() || 'Active',
            usedBy: String(row[referralSchema.usedBy] || '').trim(),
            usedAt: row[referralSchema.usedAt] || ''
        });
    }

    return JsonResponse({
        success: true,
        referralCodes: items
    });
}


function handleGenerateReferralCodes(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token || token.role !== 'Admin') {
        return JsonResponse({success: false, message: 'Unauthorized'});
    }

    if (!hasValidAdminPinProof_(data, token)) {
        return JsonResponse({success: false, message: 'Admin PIN required'});
    }

    const referralSheet = sheetsRef.referralCodes;
    if (!referralSheet) {
        return JsonResponse({success: false, message: 'Sheet ReferralCodes không tồn tại'});
    }

    const requested = parseInt(data.count, 10);
    const count = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 100) : 10;
    const referralSchema = getReferralCodesSchema_(referralSheet);
    const rows = referralSheet.getDataRange().getValues();
    const existing = new Set();

    for (let i = 1; i < rows.length; i++) {
        const code = String(rows[i][referralSchema.code] || '').trim().toUpperCase();
        if (code) {
            existing.add(code);
        }
    }

    const now = new Date();
    const generatedCodes = [];
    while (generatedCodes.length < count) {
        const code = generateReferralCode_();
        if (existing.has(code)) {
            continue;
        }
        existing.add(code);
        generatedCodes.push(code);
    }

    const totalCols = Math.max(referralSheet.getLastColumn(), referralSchema.usedAt + 1, 4);
    const valuesToAppend = generatedCodes.map(function(code) {
        const row = new Array(totalCols).fill('');
        row[referralSchema.code] = code;
        row[referralSchema.status] = 'Active';
        row[referralSchema.usedBy] = '';
        if (referralSchema.usedAt >= 0) {
            row[referralSchema.usedAt] = '';
        }
        return row;
    });

    referralSheet
        .getRange(referralSheet.getLastRow() + 1, 1, valuesToAppend.length, totalCols)
        .setValues(valuesToAppend);

    return JsonResponse({
        success: true,
        message: `Đã tạo ${generatedCodes.length} mã giới thiệu mới`,
        generatedCodes: generatedCodes,
        generatedAt: now
    });
}


function generateReferralCode_() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let value = 'REF-';
    for (let i = 0; i < 8; i++) {
        const index = Math.floor(Math.random() * chars.length);
        value += chars.charAt(index);
    }
    return value;
}


function handleUpdateQuizStatus(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token || token.role !== 'Admin') {
        return JsonResponse({success: false, message: 'Unauthorized'});
    }

    if (!hasValidAdminPinProof_(data, token)) {
        return JsonResponse({success: false, message: 'Admin PIN required'});
    }

    const quizID = data.quizID;
    const status = isTruthy_(data.status);

    const quizListData = sheetsRef.quizList.getDataRange().getValues();
    for (let i = 1; i < quizListData.length; i++) {
        if (quizListData[i][0] === quizID) {
            sheetsRef.quizList.getRange(i + 1, 6).setValue(status);
            invalidateAdminCache_();
            invalidateDashboardQuizCaches_();
            return JsonResponse({success: true, message: 'Status updated'});
        }
    }

    return JsonResponse({success: false, message: 'Quiz not found'});
}


function handleUpdateShowAnswer(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token || token.role !== 'Admin') {
        return JsonResponse({success: false, message: 'Unauthorized'});
    }

    if (!hasValidAdminPinProof_(data, token)) {
        return JsonResponse({success: false, message: 'Admin PIN required'});
    }

    const quizID = data.quizID;
    const showAnswer = isTruthy_(data.showAnswer);
    const quizListSchema = ensureQuizModeColumns_(sheetsRef.quizList);

    const quizListData = sheetsRef.quizList.getDataRange().getValues();
    for (let i = 1; i < quizListData.length; i++) {
        if (quizListData[i][quizListSchema.quizID] === quizID) {
            sheetsRef.quizList.getRange(i + 1, quizListSchema.showAnswer + 1).setValue(showAnswer);
            if (showAnswer) {
                sheetsRef.quizList.getRange(i + 1, quizListSchema.revealCorrectOnWrong + 1).setValue(false);
            }
            invalidateAdminCache_();
            invalidateDashboardQuizCaches_();
            return JsonResponse({success: true, message: 'Show_Answer updated'});
        }
    }

    return JsonResponse({success: false, message: 'Quiz not found'});
}


function handleUpdateRevealCorrectOnWrong(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token || token.role !== 'Admin') {
        return JsonResponse({success: false, message: 'Unauthorized'});
    }

    if (!hasValidAdminPinProof_(data, token)) {
        return JsonResponse({success: false, message: 'Admin PIN required'});
    }

    const quizID = data.quizID;
    const revealCorrectOnWrong = isTruthy_(data.revealCorrectOnWrong);

    const quizListSchema = ensureQuizModeColumns_(sheetsRef.quizList);
    const quizListData = sheetsRef.quizList.getDataRange().getValues();
    for (let i = 1; i < quizListData.length; i++) {
        if (quizListData[i][quizListSchema.quizID] === quizID) {
            sheetsRef.quizList.getRange(i + 1, quizListSchema.revealCorrectOnWrong + 1).setValue(revealCorrectOnWrong);
            if (revealCorrectOnWrong) {
                sheetsRef.quizList.getRange(i + 1, quizListSchema.showAnswer + 1).setValue(false);
            }
            invalidateAdminCache_();
            invalidateDashboardQuizCaches_();
            return JsonResponse({success: true, message: 'Reveal-correct-on-wrong updated'});
        }
    }

    return JsonResponse({success: false, message: 'Quiz not found'});
}


function handleUpdateShuffle(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token || token.role !== 'Admin') {
        return JsonResponse({success: false, message: 'Unauthorized'});
    }

    if (!hasValidAdminPinProof_(data, token)) {
        return JsonResponse({success: false, message: 'Admin PIN required'});
    }

    const quizID = data.quizID;
    const shuffle = isTruthy_(data.shuffle);

    const quizListData = sheetsRef.quizList.getDataRange().getValues();
    for (let i = 1; i < quizListData.length; i++) {
        if (quizListData[i][0] === quizID) {
            sheetsRef.quizList.getRange(i + 1, 8).setValue(shuffle);
            invalidateAdminCache_();
            invalidateDashboardQuizCaches_();
            return JsonResponse({success: true, message: 'Shuffle updated'});
        }
    }

    return JsonResponse({success: false, message: 'Quiz not found'});
}


function handleUpdateAntiCheat(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token || token.role !== 'Admin') {
        return JsonResponse({success: false, message: 'Unauthorized'});
    }

    if (!hasValidAdminPinProof_(data, token)) {
        return JsonResponse({success: false, message: 'Admin PIN required'});
    }

    const quizID = data.quizID;
    const antiCheat = isTruthy_(data.antiCheat);

    const quizListSchema = ensureQuizModeColumns_(sheetsRef.quizList);
    const quizListData = sheetsRef.quizList.getDataRange().getValues();
    for (let i = 1; i < quizListData.length; i++) {
        if (quizListData[i][quizListSchema.quizID] === quizID) {
            sheetsRef.quizList.getRange(i + 1, quizListSchema.antiCheat + 1).setValue(antiCheat);
            sheetsRef.quizList.getRange(i + 1, quizListSchema.antiCheatTabSwitch + 1).setValue(antiCheat);
            sheetsRef.quizList.getRange(i + 1, quizListSchema.antiCheatFullscreen + 1).setValue(antiCheat);
            invalidateAdminCache_();
            invalidateDashboardQuizCaches_();
            return JsonResponse({success: true, message: 'Anti-Cheat status updated'});
        }
    }

    return JsonResponse({success: false, message: 'Quiz not found'});
}


function handleUpdateAntiCheatTabSwitch(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token || token.role !== 'Admin') {
        return JsonResponse({success: false, message: 'Unauthorized'});
    }

    if (!hasValidAdminPinProof_(data, token)) {
        return JsonResponse({success: false, message: 'Admin PIN required'});
    }

    const quizID = data.quizID;
    const antiCheatTabSwitch = isTruthy_(data.antiCheatTabSwitch);

    const quizListSchema = ensureQuizModeColumns_(sheetsRef.quizList);
    const quizListData = sheetsRef.quizList.getDataRange().getValues();
    for (let i = 1; i < quizListData.length; i++) {
        if (quizListData[i][quizListSchema.quizID] === quizID) {
            const currentFullscreen = isTruthy_(quizListData[i][quizListSchema.antiCheatFullscreen]);
            sheetsRef.quizList.getRange(i + 1, quizListSchema.antiCheatTabSwitch + 1).setValue(antiCheatTabSwitch);
            sheetsRef.quizList.getRange(i + 1, quizListSchema.antiCheat + 1).setValue(antiCheatTabSwitch && currentFullscreen);
            invalidateAdminCache_();
            invalidateDashboardQuizCaches_();
            return JsonResponse({success: true, message: 'Anti-Cheat tab switch updated'});
        }
    }

    return JsonResponse({success: false, message: 'Quiz not found'});
}


function handleUpdateAntiCheatFullscreen(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token || token.role !== 'Admin') {
        return JsonResponse({success: false, message: 'Unauthorized'});
    }

    if (!hasValidAdminPinProof_(data, token)) {
        return JsonResponse({success: false, message: 'Admin PIN required'});
    }

    const quizID = data.quizID;
    const antiCheatFullscreen = isTruthy_(data.antiCheatFullscreen);

    const quizListSchema = ensureQuizModeColumns_(sheetsRef.quizList);
    const quizListData = sheetsRef.quizList.getDataRange().getValues();
    for (let i = 1; i < quizListData.length; i++) {
        if (quizListData[i][quizListSchema.quizID] === quizID) {
            const currentTabSwitch = isTruthy_(quizListData[i][quizListSchema.antiCheatTabSwitch]);
            sheetsRef.quizList.getRange(i + 1, quizListSchema.antiCheatFullscreen + 1).setValue(antiCheatFullscreen);
            sheetsRef.quizList.getRange(i + 1, quizListSchema.antiCheat + 1).setValue(currentTabSwitch && antiCheatFullscreen);
            invalidateAdminCache_();
            invalidateDashboardQuizCaches_();
            return JsonResponse({success: true, message: 'Anti-Cheat fullscreen updated'});
        }
    }

    return JsonResponse({success: false, message: 'Quiz not found'});
}


function handleUpdateAutoNext(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token || token.role !== 'Admin') {
        return JsonResponse({success: false, message: 'Unauthorized'});
    }

    if (!hasValidAdminPinProof_(data, token)) {
        return JsonResponse({success: false, message: 'Admin PIN required'});
    }

    const quizID = data.quizID;
    const autoNext = isTruthy_(data.autoNext);

    const quizListData = sheetsRef.quizList.getDataRange().getValues();
    for (let i = 1; i < quizListData.length; i++) {
        if (quizListData[i][0] === quizID) {
            sheetsRef.quizList.getRange(i + 1, 10).setValue(autoNext);
            invalidateAdminCache_();
            invalidateDashboardQuizCaches_();
            return JsonResponse({success: true, message: 'Auto-next status updated'});
        }
    }

    return JsonResponse({success: false, message: 'Quiz not found'});
}


function handleUpdateAllowBack(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token || token.role !== 'Admin') {
        return JsonResponse({success: false, message: 'Unauthorized'});
    }

    if (!hasValidAdminPinProof_(data, token)) {
        return JsonResponse({success: false, message: 'Admin PIN required'});
    }

    const quizID = data.quizID;
    const allowBack = isTruthy_(data.allowBack);

    const quizListData = sheetsRef.quizList.getDataRange().getValues();
    for (let i = 1; i < quizListData.length; i++) {
        if (quizListData[i][0] === quizID) {
            sheetsRef.quizList.getRange(i + 1, 11).setValue(allowBack);
            invalidateAdminCache_();
            invalidateDashboardQuizCaches_();
            return JsonResponse({success: true, message: 'Allow-back status updated'});
        }
    }

    return JsonResponse({success: false, message: 'Quiz not found'});
}


function handleBatchUpdateQuizSettings(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token || token.role !== 'Admin') {
        return JsonResponse({success: false, message: 'Unauthorized'});
    }

    if (!hasValidAdminPinProof_(data, token)) {
        return JsonResponse({success: false, message: 'Admin PIN required'});
    }

    const changes = data.changes;
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
        return JsonResponse({success: false, message: 'Invalid changes payload'});
    }

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) {
        return JsonResponse({success: false, message: 'Hệ thống đang bận, vui lòng thử lại sau'});
    }

    try {
        const quizListSchema = ensureQuizModeColumns_(sheetsRef.quizList);
        const quizListData = sheetsRef.quizList.getDataRange().getValues();
        if (!quizListData || quizListData.length < 2) {
            return JsonResponse({success: false, message: 'Quiz list is empty'});
        }

        const rowByQuizId = {};
        for (let i = 1; i < quizListData.length; i++) {
            const quizID = String(quizListData[i][quizListSchema.quizID] || '').trim();
            if (quizID) {
                rowByQuizId[quizID] = i;
            }
        }

        const fieldColumnMap = {
            status: quizListSchema.status,
            showAnswer: quizListSchema.showAnswer,
            revealCorrectOnWrong: quizListSchema.revealCorrectOnWrong,
            showDetailedResult: quizListSchema.showDetailedResult,
            shuffle: quizListSchema.shuffle,
            antiCheat: quizListSchema.antiCheat,
            antiCheatTabSwitch: quizListSchema.antiCheatTabSwitch,
            antiCheatFullscreen: quizListSchema.antiCheatFullscreen,
            autoNext: quizListSchema.autoNext,
            allowBack: quizListSchema.allowBack
        };

        const failedUpdates = [];
        const cellUpdates = [];
        const touchedCells = new Set();

        const quizIDs = Object.keys(changes);
        for (let q = 0; q < quizIDs.length; q++) {
            const quizID = String(quizIDs[q] || '').trim();
            if (!quizID) {
                continue;
            }

            const rowIndex = rowByQuizId[quizID];
            if (rowIndex === undefined) {
                failedUpdates.push({ quizID: quizID, fields: [], reason: 'Quiz not found' });
                continue;
            }

            const quizChanges = changes[quizID];
            if (!quizChanges || typeof quizChanges !== 'object' || Array.isArray(quizChanges)) {
                failedUpdates.push({ quizID: quizID, fields: [], reason: 'Invalid field payload' });
                continue;
            }

            const currentRow = quizListData[rowIndex];
            const nextRow = currentRow.slice();
            const fields = Object.keys(quizChanges);
            const invalidFields = [];
            const touchedColumns = new Set();

            let touchedAntiCheat = false;
            let touchedPracticeMode = false;
            let preferredPracticeField = '';

            for (let f = 0; f < fields.length; f++) {
                const fieldName = String(fields[f] || '').trim();
                if (!Object.prototype.hasOwnProperty.call(fieldColumnMap, fieldName)) {
                    invalidFields.push(fieldName);
                    continue;
                }

                const columnIndex = fieldColumnMap[fieldName];
                if (columnIndex < 0) {
                    invalidFields.push(fieldName);
                    continue;
                }

                nextRow[columnIndex] = isTruthy_(quizChanges[fieldName]);
                touchedColumns.add(columnIndex);

                if (fieldName === 'antiCheat' || fieldName === 'antiCheatTabSwitch' || fieldName === 'antiCheatFullscreen') {
                    touchedAntiCheat = true;
                }

                if (fieldName === 'showAnswer' || fieldName === 'revealCorrectOnWrong') {
                    touchedPracticeMode = true;
                    if (isTruthy_(quizChanges[fieldName])) {
                        preferredPracticeField = fieldName;
                    }
                }
            }

            if (touchedAntiCheat) {
                const antiCheatTabSwitch = isTruthy_(nextRow[quizListSchema.antiCheatTabSwitch]);
                const antiCheatFullscreen = isTruthy_(nextRow[quizListSchema.antiCheatFullscreen]);
                nextRow[quizListSchema.antiCheat] = antiCheatTabSwitch && antiCheatFullscreen;
                touchedColumns.add(quizListSchema.antiCheat);
            }

            if (touchedPracticeMode) {
                enforceExclusivePracticeModes_(nextRow, quizListSchema, preferredPracticeField);
                touchedColumns.add(quizListSchema.showAnswer);
                touchedColumns.add(quizListSchema.revealCorrectOnWrong);
            }

            touchedColumns.forEach((columnIndex) => {
                const originalValue = currentRow[columnIndex];
                const nextValue = nextRow[columnIndex];
                if (originalValue === nextValue) {
                    return;
                }

                const dedupKey = `${rowIndex}:${columnIndex}`;
                if (touchedCells.has(dedupKey)) {
                    return;
                }

                touchedCells.add(dedupKey);
                cellUpdates.push({
                    row: rowIndex + 1,
                    col: columnIndex + 1,
                    value: nextValue
                });

                currentRow[columnIndex] = nextValue;
            });

            if (invalidFields.length > 0) {
                failedUpdates.push({
                    quizID: quizID,
                    fields: invalidFields,
                    reason: 'Unsupported fields'
                });
            }
        }

        for (let i = 0; i < cellUpdates.length; i++) {
            const update = cellUpdates[i];
            sheetsRef.quizList.getRange(update.row, update.col).setValue(update.value);
        }

        if (cellUpdates.length > 0) {
            invalidateAdminCache_();
            invalidateDashboardQuizCaches_();
        }

        const allSucceeded = failedUpdates.length === 0;
        return JsonResponse({
            success: allSucceeded,
            message: allSucceeded
                ? 'Batch settings updated'
                : 'Some settings were not updated',
            updatedCount: cellUpdates.length,
            failedUpdates: failedUpdates
        });
    } finally {
        lock.releaseLock();
    }
}


function handleBulkUpload(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token || token.role !== 'Admin') {
        return JsonResponse({success: false, message: 'Unauthorized'});
    }

    if (!hasValidAdminPinProof_(data, token)) {
        return JsonResponse({success: false, message: 'Admin PIN required'});
    }

    const quizID = String(data.quizID || '').trim();
    const questions = data.questions;

    if (!quizID) {
        return JsonResponse({success: false, message: 'Quiz ID is required'});
    }

    if (!questions || questions.length === 0) {
        return JsonResponse({success: false, message: 'No questions provided'});
    }

    if (!Array.isArray(questions)) {
        return JsonResponse({success: false, message: 'Invalid questions payload'});
    }

    // Lấy ID câu hỏi cao nhất
    // Chuẩn bị data để insert
    const valuesToInsert = [];
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i] || {};
        const questionText = String(q.questionText || '').trim();
        const optionA = String(q.optionA || '').trim();
        const optionB = String(q.optionB || '').trim();
        const optionC = String(q.optionC || '').trim();
        const optionD = String(q.optionD || '').trim();
        const correctAnswer = String(q.correctAnswer || '').trim().toUpperCase();
        const explanation = String(q.explanation || '').trim();

        if (!questionText || !optionA || !optionB || !optionC || !optionD || !/^[A-D]$/.test(correctAnswer)) {
            return JsonResponse({success: false, message: `Invalid question payload at index ${i}`});
        }

        const questionID = 'Q_' + Utilities.getUuid().replace(/-/g, '').substring(0, 10);
        
        valuesToInsert.push([
            questionID,
            quizID,
            questionText,
            optionA,
            optionB,
            optionC,
            optionD,
            correctAnswer,
            explanation
        ]);
    }

    // Insert hàng loạt (tối ưu hơn appendRow)
    const questionsData = sheetsRef.questions.getDataRange().getValues();
    sheetsRef.questions.getRange(
        questionsData.length + 1,
        1,
        valuesToInsert.length,
        valuesToInsert[0].length
    ).setValues(valuesToInsert);
    invalidateAdminCache_();
    invalidateDashboardQuizCaches_();

    return JsonResponse({
        success: true,
        message: `Successfully uploaded ${questions.length} questions`,
        insertedCount: questions.length
    });
}


function handleLogCheat(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token) {
        return JsonResponse({success: false, message: 'Invalid token'});
    }

    const username = token.username || 'unknown';
    const quizID = String(data.quizID || '').trim();
    const violationType = String(data.violationType || 'unknown').trim() || 'unknown';
    const cheatCount = Number(data.cheatCount || 0);
    const userAgent = String(data.userAgent || '').trim();
    const timestamp = String(data.timestamp || new Date().toISOString()).trim();

    const logID = `CHEAT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const logPayload = JSON.stringify({
        violationType: violationType,
        cheatCount: cheatCount,
        userAgent: userAgent,
        originalTimestamp: timestamp
    });

    // Reuse Attempt_Logs sheet for cheat events to avoid schema break.
    const newRow = [logID, username, quizID, 'CHEAT', logPayload, new Date().toLocaleString()];
    sheetsRef.logs.appendRow(newRow);
    invalidateAdminCache_();
    invalidateDashboardStatsCacheForUser_(username);

    return JsonResponse({
        success: true,
        message: 'Cheat violation logged',
        logID: logID
    });
}


function normalizeQuizListBooleanFlags_() {
    const sheetsRef = getSheetsRef_();
    const sheet = sheetsRef.quizList;
    const data = sheet.getDataRange().getValues();

    if (!data || data.length <= 1) {
        Logger.log('Quiz_List không có dữ liệu để chuẩn hóa.');
        return;
    }

    let updatedRows = 0;
    for (let i = 1; i < data.length; i++) {
        const status = isTruthy_(data[i][5]);
        const showAnswer = isTruthy_(data[i][6]);
        const shuffle = isTruthy_(data[i][7]);
        const antiCheat = isTruthy_(data[i][8]);
        const autoNext = isTruthy_(data[i][9]);
        const allowBack = isTruthy_(data[i][10]);

        const normalized = [status, showAnswer, shuffle, antiCheat, autoNext, allowBack];
        const current = [data[i][5], data[i][6], data[i][7], data[i][8], data[i][9], data[i][10]];

        const hasDiff = normalized.some((value, idx) => value !== current[idx]);
        if (!hasDiff) {
            continue;
        }

        sheet.getRange(i + 1, 6, 1, 6).setValues([normalized]);
        updatedRows += 1;
    }

    invalidateAdminCache_();
    invalidateDashboardQuizCaches_();

    Logger.log(`Đã chuẩn hóa ${updatedRows} dòng cờ boolean trong Quiz_List.`);
}
