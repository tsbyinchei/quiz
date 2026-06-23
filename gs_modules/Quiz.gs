
function getQuizListSchema_(quizListSheet) {
    const fallback = {
        quizID: 0,
        subject: 1,
        title: 2,
        description: 3,
        timeLimit: 4,
        status: 5,
        showAnswer: 6,
        shuffle: 7,
        antiCheat: 8,
        autoNext: 9,
        allowBack: 10,
        antiCheatTabSwitch: -1,
        antiCheatFullscreen: -1,
        revealCorrectOnWrong: -1,
        showDetailedResult: -1
    };

    if (!quizListSheet) {
        return fallback;
    }

    const lastCol = Math.max(quizListSheet.getLastColumn(), 1);
    const headers = quizListSheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
    const normalizedHeaders = headers.map((item) => normalizeHeaderName_(item));

    return {
        quizID: findHeaderIndex_(normalizedHeaders, ['quizid'], fallback.quizID),
        subject: findHeaderIndex_(normalizedHeaders, ['subject', 'monhoc'], fallback.subject),
        title: findHeaderIndex_(normalizedHeaders, ['title', 'tenquiz'], fallback.title),
        description: findHeaderIndex_(normalizedHeaders, ['description', 'mota'], fallback.description),
        timeLimit: findHeaderIndex_(normalizedHeaders, ['timelimit', 'thoigian'], fallback.timeLimit),
        status: findHeaderIndex_(normalizedHeaders, ['status', 'trangthai'], fallback.status),
        showAnswer: findHeaderIndex_(normalizedHeaders, ['showanswer', 'hienthidapan'], fallback.showAnswer),
        shuffle: findHeaderIndex_(normalizedHeaders, ['shuffle', 'daocau'], fallback.shuffle),
        antiCheat: findHeaderIndex_(normalizedHeaders, ['anticheat', 'chonggianlan'], fallback.antiCheat),
        autoNext: findHeaderIndex_(normalizedHeaders, ['autonext', 'tudongchuyencau'], fallback.autoNext),
        allowBack: findHeaderIndex_(normalizedHeaders, ['allowback', 'chophepquaylai'], fallback.allowBack),
        antiCheatTabSwitch: findHeaderIndex_(normalizedHeaders, ['anticheattabswitch', 'tabswitch'], fallback.antiCheatTabSwitch),
        antiCheatFullscreen: findHeaderIndex_(normalizedHeaders, ['anticheatfullscreen', 'fullscreen'], fallback.antiCheatFullscreen),
        revealCorrectOnWrong: findHeaderIndex_(normalizedHeaders, ['revealcorrectonwrong', 'showcorrectonsai', 'lodapandungkhisai'], fallback.revealCorrectOnWrong),
        showDetailedResult: findHeaderIndex_(normalizedHeaders, ['showdetailedresult', 'chitietketqua', 'hienthichitietketqua'], fallback.showDetailedResult)
    };
}


function ensureAntiCheatModeColumns_(quizListSheet) {
    let schema = getQuizListSchema_(quizListSheet);
    const missingTabSwitch = schema.antiCheatTabSwitch < 0;
    const missingFullscreen = schema.antiCheatFullscreen < 0;

    if (!missingTabSwitch && !missingFullscreen) {
        return schema;
    }

    let nextCol = quizListSheet.getLastColumn() + 1;
    if (missingTabSwitch) {
        quizListSheet.getRange(1, nextCol).setValue('AntiCheatTabSwitch');
        nextCol++;
    }

    if (missingFullscreen) {
        quizListSheet.getRange(1, nextCol).setValue('AntiCheatFullscreen');
    }

    schema = getQuizListSchema_(quizListSheet);

    const lastRow = quizListSheet.getLastRow();
    if (lastRow >= 2) {
        const tabColumn = schema.antiCheatTabSwitch + 1;
        const fullscreenColumn = schema.antiCheatFullscreen + 1;
        const legacyColumn = schema.antiCheat + 1;
        const legacyValues = quizListSheet.getRange(2, legacyColumn, lastRow - 1, 1).getValues();

        const tabValues = legacyValues.map((row) => [isTruthy_(row[0])]);
        const fullscreenValues = legacyValues.map((row) => [isTruthy_(row[0])]);

        quizListSheet.getRange(2, tabColumn, lastRow - 1, 1).setValues(tabValues);
        quizListSheet.getRange(2, fullscreenColumn, lastRow - 1, 1).setValues(fullscreenValues);
    }

    return schema;
}


function getRowAntiCheatModes_(row, schema) {
    const legacy = isTruthy_(row[schema.antiCheat]);
    const hasTabSwitch = schema.antiCheatTabSwitch >= 0;
    const hasFullscreen = schema.antiCheatFullscreen >= 0;

    return {
        antiCheat: legacy,
        antiCheatTabSwitch: hasTabSwitch ? isTruthy_(row[schema.antiCheatTabSwitch]) : legacy,
        antiCheatFullscreen: hasFullscreen ? isTruthy_(row[schema.antiCheatFullscreen]) : legacy
    };
}


function ensureQuizModeColumns_(quizListSheet) {
    let schema = ensureAntiCheatModeColumns_(quizListSheet);
    const missingRevealCorrectOnWrong = schema.revealCorrectOnWrong < 0;
    const missingShowDetailedResult = schema.showDetailedResult < 0;

    if (!missingRevealCorrectOnWrong && !missingShowDetailedResult) {
        return schema;
    }

    let nextCol = quizListSheet.getLastColumn() + 1;

    if (missingRevealCorrectOnWrong) {
        quizListSheet.getRange(1, nextCol).setValue('RevealCorrectOnWrong');
        nextCol++;
    }

    if (missingShowDetailedResult) {
        quizListSheet.getRange(1, nextCol).setValue('ShowDetailedResult');
    }

    schema = getQuizListSchema_(quizListSheet);
    const lastRow = quizListSheet.getLastRow();
    if (lastRow >= 2) {
        if (missingRevealCorrectOnWrong && schema.revealCorrectOnWrong >= 0) {
            const values = Array.from({ length: lastRow - 1 }, () => [false]);
            quizListSheet.getRange(2, schema.revealCorrectOnWrong + 1, lastRow - 1, 1).setValues(values);
        }

        if (missingShowDetailedResult && schema.showDetailedResult >= 0) {
            const values = Array.from({ length: lastRow - 1 }, () => [true]);
            quizListSheet.getRange(2, schema.showDetailedResult + 1, lastRow - 1, 1).setValues(values);
        }
    }

    return schema;
}


function getRevealCorrectOnWrong_(row, schema) {
    if (!schema || schema.revealCorrectOnWrong < 0) {
        return false;
    }

    return isTruthy_(row[schema.revealCorrectOnWrong]);
}


function getShowDetailedResult_(row, schema) {
    if (!schema || schema.showDetailedResult < 0) {
        return true;
    }

    return isTruthy_(row[schema.showDetailedResult]);
}


function getRowPracticeModes_(row, schema) {
    const showAnswer = isTruthy_(row[schema.showAnswer]);
    const revealCorrectOnWrong = showAnswer ? false : getRevealCorrectOnWrong_(row, schema);

    return {
        showAnswer: showAnswer,
        revealCorrectOnWrong: revealCorrectOnWrong
    };
}


function enforceExclusivePracticeModes_(row, schema, preferredFieldName) {
    if (!schema || schema.showAnswer < 0 || schema.revealCorrectOnWrong < 0) {
        return;
    }

    const showAnswer = isTruthy_(row[schema.showAnswer]);
    const revealCorrectOnWrong = isTruthy_(row[schema.revealCorrectOnWrong]);
    if (!(showAnswer && revealCorrectOnWrong)) {
        return;
    }

    if (preferredFieldName === 'showAnswer') {
        row[schema.revealCorrectOnWrong] = false;
        return;
    }

    row[schema.showAnswer] = false;
}


function getDashboardStatsSnapshot_(sheetsRef, username) {
    const safeUsername = String(username || '').trim();
    if (!safeUsername) {
        return { totalScore: 0, totalAttempts: 0 };
    }

    const userStatsSheet = sheetsRef.userStats;
    if (userStatsSheet) {
        const lastCol = Math.max(userStatsSheet.getLastColumn(), 1);
        const rows = userStatsSheet.getDataRange().getValues();

        if (rows && rows.length >= 2) {
            const headers = rows[0] || [];
            const normalizedHeaders = headers.map((item) => normalizeHeaderName_(item));
            const usernameCol = findHeaderIndex_(normalizedHeaders, ['username', 'user', 'taikhoan'], 0);
            const totalScoreCol = findHeaderIndex_(normalizedHeaders, ['totalscore', 'tongdiem', 'sumscore'], 1);
            const totalAttemptsCol = findHeaderIndex_(normalizedHeaders, ['totalattempts', 'sobai', 'attempts', 'solanthi'], 2);

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i] || [];
                const rowUsername = String(row[usernameCol] || '').trim();
                if (!rowUsername || rowUsername.toLowerCase() !== safeUsername.toLowerCase()) {
                    continue;
                }

                const totalScore = Number(row[totalScoreCol] || 0);
                const totalAttempts = Number(row[totalAttemptsCol] || 0);
                
                const statsFromLog = getUserStatsCached_(sheetsRef, safeUsername);

                return {
                    totalScore: Number.isFinite(totalScore) ? totalScore : 0,
                    totalAttempts: Number.isFinite(totalAttempts) ? totalAttempts : 0,
                    highestScoresByQuiz: statsFromLog.highestScoresByQuiz || {}
                };
            }
        }
    }

    const stats = getUserStatsCached_(sheetsRef, safeUsername);
    const totalAttempts = Number(stats.attempts || 0);
    const averageScore = Number(stats.averageScore || 0);

    return {
        totalScore: Number.isFinite(totalAttempts * averageScore) ? totalAttempts * averageScore : 0,
        totalAttempts: Number.isFinite(totalAttempts) ? totalAttempts : 0,
        highestScoresByQuiz: stats.highestScoresByQuiz || {}
    };
}


function getQuizMetaVersion_() {
    const props = PropertiesService.getScriptProperties();
    const rawValue = props.getProperty('quiz_meta_version');
    const parsed = parseInt(rawValue || '1', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}


function bumpQuizMetaVersion_() {
    const props = PropertiesService.getScriptProperties();
    const nextVersion = getQuizMetaVersion_() + 1;
    props.setProperty('quiz_meta_version', String(nextVersion));
    return nextVersion;
}


function getActiveQuizSnapshot_(sheetsRef) {
    const cacheKey = `quiz_snapshot_v${getQuizMetaVersion_()}`;
    const cached = getCachedJson_(cacheKey);
    if (cached) {
        return cached;
    }

    const quizData = sheetsRef.quizList.getDataRange().getValues();
    const questionsData = sheetsRef.questions.getDataRange().getValues();
    const questionCountByQuiz = buildQuestionCountMapFromQuestions_(questionsData);
    const quizListSchema = getQuizListSchema_(sheetsRef.quizList);
    const snapshot = buildActiveQuizSnapshotFromQuizList_(quizData, questionCountByQuiz, quizListSchema);
    setCachedJson_(cacheKey, snapshot, 300);
    return snapshot;
}


function getUserStatsCached_(sheetsRef, username) {
    const userKey = `dashboard_stats_user_${username}`;
    const cachedUserStats = getCachedJson_(userKey);
    if (cachedUserStats) {
        return cachedUserStats;
    }

    const allStatsKey = 'dashboard_stats_all';
    let allStatsMap = getCachedJson_(allStatsKey);
    if (!allStatsMap) {
        const logsData = sheetsRef.logs.getDataRange().getValues();
        allStatsMap = buildAllUserStatsFromLogs_(logsData);
        setCachedJson_(allStatsKey, allStatsMap, 120);
    }

    const stats = allStatsMap[username] || {
        attempts: 0,
        highestScore: 0,
        averageScore: 0
    };

    setCachedJson_(userKey, stats, 120);
    return stats;
}


function getUserQuizAttemptCountsCached_(sheetsRef, username) {
    const userKey = `dashboard_quiz_attempts_user_${username}`;
    const cached = getCachedJson_(userKey);
    if (cached) {
        return cached;
    }

    const logsData = sheetsRef.logs.getDataRange().getValues();
    const attemptMap = {};

    for (let i = 1; i < logsData.length; i++) {
        const logUsername = String(logsData[i][1] || '').trim();
        if (!logUsername || logUsername.toLowerCase() !== String(username || '').toLowerCase()) {
            continue;
        }

        const quizID = String(logsData[i][2] || '').trim();
        if (!quizID) {
            continue;
        }

        const score = parseFloat(logsData[i][3]);
        if (isNaN(score)) {
            continue;
        }

        attemptMap[quizID] = (attemptMap[quizID] || 0) + 1;
    }

    setCachedJson_(userKey, attemptMap, 120);
    return attemptMap;
}


function attachUserAttemptsToQuizzes_(quizzesBySubject, userAttemptMap) {
    const source = quizzesBySubject || {};
    const attemptMap = userAttemptMap || {};
    const result = {};
    const subjects = Object.keys(source);

    for (let i = 0; i < subjects.length; i++) {
        const subject = subjects[i];
        const quizzes = Array.isArray(source[subject]) ? source[subject] : [];
        result[subject] = quizzes.map(function(quiz) {
            const quizID = String((quiz && quiz.quizID) || '').trim();
            return Object.assign({}, quiz, {
                userAttempts: quizID ? (attemptMap[quizID] || 0) : 0
            });
        });
    }

    return result;
}


function invalidateDashboardStatsCacheForUser_(username) {
    removeCacheKey_('dashboard_stats_all');
    if (username) {
        removeCacheKey_(`dashboard_stats_user_${username}`);
        removeCacheKey_(`dashboard_quiz_attempts_user_${username}`);
        removeCacheKey_(`dashboard_init_v${getQuizMetaVersion_()}_${username}`);
    }
}


function invalidateDashboardQuizCaches_() {
    bumpQuizMetaVersion_();
}


function getQuizRuntimeModesByID_(quizListSheet, quizID) {
    const targetQuizID = String(quizID || '').trim();
    if (!targetQuizID) {
        return null;
    }

    const quizListSchema = getQuizListSchema_(quizListSheet);
    const quizListData = quizListSheet.getDataRange().getValues();

    for (let i = 1; i < quizListData.length; i++) {
        const rowQuizID = String(quizListData[i][quizListSchema.quizID] || '').trim();
        if (rowQuizID !== targetQuizID) {
            continue;
        }

        const practiceModes = getRowPracticeModes_(quizListData[i], quizListSchema);
        return {
            showAnswer: !!practiceModes.showAnswer,
            revealCorrectOnWrong: !!practiceModes.revealCorrectOnWrong,
            practiceFeedbackEnabled: !!(practiceModes.showAnswer || practiceModes.revealCorrectOnWrong)
        };
    }

    return null;
}


// ==================== QUIZ DATA ====================

function handleGetSubjects(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token) {
        return JsonResponse({success: false, message: 'Invalid token'});
    }

    const snapshot = getActiveQuizSnapshot_(sheetsRef);

    return JsonResponse({
        success: true,
        subjects: snapshot.subjects || []
    });
}


function handleGetDashboardInit(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token) {
        return JsonResponse({success: false, message: 'Invalid token'});
    }

    const username = token.role === 'Admin' && data.username ? data.username : token.username;
    
    if (data.forceRefresh === true || data.forceRefresh === 'true') {
        invalidateDashboardStatsCacheForUser_(username);
        invalidateDashboardQuizCaches_();
    }

    const dashboardCacheKey = `dashboard_init_v${getQuizMetaVersion_()}_${username}`;
    const cached = getCachedJson_(dashboardCacheKey);
    if (cached && data.forceRefresh !== true && data.forceRefresh !== 'true') {
        return JsonResponse(cached);
    }

    const snapshot = getActiveQuizSnapshot_(sheetsRef);
    const stats = getUserStatsCached_(sheetsRef, username);
    const userAttemptMap = getUserQuizAttemptCountsCached_(sheetsRef, username);
    const quizzesBySubject = attachUserAttemptsToQuizzes_(snapshot.quizzesBySubject || {}, userAttemptMap);

    const response = {
        success: true,
        subjects: snapshot.subjects || [],
        quizzesBySubject: quizzesBySubject,
        stats: stats
    };

    setCachedJson_(dashboardCacheKey, response, 90);

    return JsonResponse(response);
}


function handleGetQuizzesBySubject(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token) {
        return JsonResponse({success: false, message: 'Invalid token'});
    }

    const username = token.role === 'Admin' && data.username ? data.username : token.username;
    const subject = String(data.subject || '').trim();
    const snapshot = getActiveQuizSnapshot_(sheetsRef);
    const userAttemptMap = getUserQuizAttemptCountsCached_(sheetsRef, username);
    const quizzesBySubject = snapshot.quizzesBySubject || {};
    const quizzes = subject
        ? (quizzesBySubject[subject] || []).map(function(quiz) {
            const quizID = String((quiz && quiz.quizID) || '').trim();
            return Object.assign({}, quiz, {
                userAttempts: quizID ? (userAttemptMap[quizID] || 0) : 0
            });
        })
        : [];

    return JsonResponse({
        success: true,
        quizzes: quizzes
    });
}


function handleGetQuizData(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token) {
        return JsonResponse({success: false, message: 'Invalid token'});
    }

    const quizID = data.quizID;

    // Lấy thông tin quiz
    const quizListSchema = getQuizListSchema_(sheetsRef.quizList);
    const quizListData = sheetsRef.quizList.getDataRange().getValues();
    let quizInfo = null;

    for (let i = 1; i < quizListData.length; i++) {
        if (quizListData[i][quizListSchema.quizID] === quizID) {
            const antiCheatModes = getRowAntiCheatModes_(quizListData[i], quizListSchema);
            const practiceModes = getRowPracticeModes_(quizListData[i], quizListSchema);
            quizInfo = {
                quizID: quizListData[i][quizListSchema.quizID],
                title: quizListData[i][quizListSchema.title],
                timeLimit: quizListData[i][quizListSchema.timeLimit],
                showAnswer: practiceModes.showAnswer,
                revealCorrectOnWrong: practiceModes.revealCorrectOnWrong,
                showDetailedResult: getShowDetailedResult_(quizListData[i], quizListSchema),
                shuffle: isTruthy_(quizListData[i][quizListSchema.shuffle]),
                antiCheat: antiCheatModes.antiCheat,
                antiCheatTabSwitch: antiCheatModes.antiCheatTabSwitch,
                antiCheatFullscreen: antiCheatModes.antiCheatFullscreen,
                autoNext: isTruthy_(quizListData[i][quizListSchema.autoNext]),
                allowBack: isTruthy_(quizListData[i][quizListSchema.allowBack])
            };
            break;
        }
    }

    if (!quizInfo) {
        return JsonResponse({success: false, message: 'Quiz not found'});
    }

    const practiceFeedbackEnabled = !!(quizInfo.showAnswer || quizInfo.revealCorrectOnWrong);
    const quizQuestions = getQuizQuestionsCached_(sheetsRef, quizID);
    const questions = [];
    const jwtSecret = getJwtSecret_();

    for (let i = 0; i < quizQuestions.length; i++) {
        const q = quizQuestions[i];
        const questionID = q.questionID;
        const answerData = q.answerData || {};
        const correctAnswer = answerData.correctAnswer;

        // Tạo hash cho đáp án
        const answerHash = Utilities.computeDigest(
            Utilities.DigestAlgorithm.SHA_256,
            questionID + correctAnswer + jwtSecret,
            Utilities.Charset.UTF_8
        );

        const hexHash = answerHash.map(function(byte) {
            const value = (byte < 0) ? 256 + byte : byte;
            return ('0' + value.toString(16)).slice(-2);
        }).join('');

        questions.push({
            questionID: questionID,
            questionText: q.questionText,
            A: q.optionA,
            B: q.optionB,
            C: q.optionC,
            D: q.optionD,
            explanation: practiceFeedbackEnabled ? answerData.explanation : '',
            correctOption: practiceFeedbackEnabled ? String(correctAnswer || '').trim().toUpperCase() : '',
            answerHash: hexHash
        });
    }

    if (questions.length === 0) {
        return JsonResponse({success: false, message: 'No questions found'});
    }

    return JsonResponse({
        success: true,
        quizInfo: quizInfo,
        questions: questions
    });
}
