/**
 * Quiz Lab - Google Apps Script Backend
 * 
 * Xử lý:
 * - Authentication (Login)
 * - Quiz Data Management
 * - Grading & Score Submission
 * - Admin Operations (Status, Show_Answer, Bulk Upload)
 * - Statistics
 * 
 * Deployment: Cloud Function / Web App
 */

// ==================== CONFIGURATION ====================

const SPREADSHEET_ID = ''; // Chỉ cần cho standalone script; để trống nếu bound với Google Sheet
const SECRET_KEY = 'TsByinChei';
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

// ==================== SHEET REFERENCES ====================

let sheetsRefCache = null;

function getSpreadsheet_() {
    if (SPREADSHEET_ID && SPREADSHEET_ID !== 'YOUR_SPREADSHEET_ID_HERE') {
        return SpreadsheetApp.openById(SPREADSHEET_ID);
    }

    const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (activeSpreadsheet) {
        return activeSpreadsheet;
    }

    throw new Error('Không tìm thấy Spreadsheet hiện tại. Nếu script là standalone, hãy điền SPREADSHEET_ID.');
}

function getSheetsRef_() {
    if (!sheetsRefCache) {
        const spreadsheet = getSpreadsheet_();
        sheetsRefCache = {
            users: spreadsheet.getSheetByName('Users'),
            quizList: spreadsheet.getSheetByName('Quiz_List'),
            questions: spreadsheet.getSheetByName('Questions'),
            logs: spreadsheet.getSheetByName('Attempt_Logs')
        };
    }

    return sheetsRefCache;
}

// ==================== MAIN HANDLER ====================

function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);
        const action = data.action;

        // Route tới các hàm tương ứng
        switch(action) {
            case 'login':
                return handleLogin(data);
            case 'getSubjects':
                return handleGetSubjects(data);
            case 'getDashboardInit':
                return handleGetDashboardInit(data);
            case 'getQuizzesBySubject':
                return handleGetQuizzesBySubject(data);
            case 'getQuizData':
                return handleGetQuizData(data);
            case 'submitScore':
                return handleSubmitScore(data);
            case 'getUserStats':
                return handleGetUserStats(data);
            case 'getAdminData':
                return handleGetAdminData(data);
            case 'verifyAdminPin':
                return handleVerifyAdminPin(data);
            case 'updateQuizStatus':
                return handleUpdateQuizStatus(data);
            case 'updateShowAnswer':
                return handleUpdateShowAnswer(data);
            case 'updateShuffle':
                return handleUpdateShuffle(data);
            case 'updateAntiCheat':
                return handleUpdateAntiCheat(data);
            case 'updateAutoNext':
                return handleUpdateAutoNext(data);
            case 'updateAllowBack':
                return handleUpdateAllowBack(data);
            case 'bulkUpload':
                return handleBulkUpload(data);
            case 'logCheatViolation':
                return handleLogCheat(data);
            default:
                return JsonResponse({success: false, message: 'Unknown action'});
        }
    } catch (error) {
        Logger.log('Error: ' + error.toString());
        return JsonResponse({success: false, message: error.toString()});
    }
}

// ==================== AUTHENTICATION ====================

function handleLogin(data) {
    const sheetsRef = getSheetsRef_();
    const username = data.username;
    const passwordHash = data.passwordHash;

    // Tìm user trong sheet
    const usersData = sheetsRef.users.getDataRange().getValues();
    for (let i = 1; i < usersData.length; i++) {
        if (usersData[i][0].toLowerCase() === username.toLowerCase() && usersData[i][1] === passwordHash) {
            const role = usersData[i][2];
            const fullName = usersData[i][3];
            const actualUsername = usersData[i][0];
            
            // Tạo token
            const token = generateToken(actualUsername, role);
            
            return JsonResponse({
                success: true,
                token: token,
                role: role,
                username: actualUsername,
                fullName: fullName
            });
        }
    }

    return JsonResponse({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không đúng'
    });
}

function generateToken(username, role) {
    const payload = {
        username: username,
        role: role,
        timestamp: Date.now(),
        sessionId: Utilities.getUuid()
    };

    const payloadB64 = Utilities.base64Encode(JSON.stringify(payload));
    const signatureBytes = Utilities.computeHmacSha256Signature(payloadB64, SECRET_KEY);
    const signatureB64 = Utilities.base64Encode(signatureBytes);

    setActiveSession_(username, payload.sessionId);

    return `${payloadB64}.${signatureB64}`;
}

function setActiveSession_(username, sessionId) {
    const key = `session_${username}`;
    const cache = CacheService.getScriptCache();
    cache.put(key, String(sessionId), 21600);
    PropertiesService.getScriptProperties().setProperty(key, String(sessionId));
}

function getActiveSession_(username) {
    const key = `session_${username}`;
    const cache = CacheService.getScriptCache();
    const cachedValue = cache.get(key);
    if (cachedValue) {
        return cachedValue;
    }

    const storedValue = PropertiesService.getScriptProperties().getProperty(key);
    if (storedValue) {
        cache.put(key, storedValue, 21600);
    }

    return storedValue;
}

function generateAdminPinProof_(username) {
    const proof = Utilities.getUuid();
    const key = `admin_pin_${username}`;
    const cache = CacheService.getScriptCache();
    cache.put(key, proof, 21600);
    PropertiesService.getScriptProperties().setProperty(key, proof);
    return proof;
}

function getAdminPinProof_(username) {
    const key = `admin_pin_${username}`;
    const cache = CacheService.getScriptCache();
    const cachedValue = cache.get(key);
    if (cachedValue) {
        return cachedValue;
    }

    const storedValue = PropertiesService.getScriptProperties().getProperty(key);
    if (storedValue) {
        cache.put(key, storedValue, 21600);
    }

    return storedValue;
}

function hasValidAdminPinProof_(data, token) {
    const proof = String(data.adminPinProof || '').trim();
    if (!proof || !token || token.role !== 'Admin') {
        return false;
    }

    const activeProof = getAdminPinProof_(token.username);
    return !!activeProof && activeProof === proof;
}

// Cache helpers for admin data (5 min TTL = 300 sec)
function getCachedAdminData_() {
    const cache = CacheService.getScriptCache();
    try {
        const cached = cache.get('admin_data_cache');
        if (cached) {
            return JSON.parse(cached);
        }
    } catch (e) {
        Logger.log('Cache parse error: ' + e.toString());
    }
    return null;
}

function setCachedAdminData_(data) {
    const cache = CacheService.getScriptCache();
    try {
        cache.put('admin_data_cache', JSON.stringify(data), 300); // 5 minutes
    } catch (e) {
        Logger.log('Cache set error: ' + e.toString());
    }
}

function invalidateAdminCache_() {
    try {
        CacheService.getScriptCache().remove('admin_data_cache');
    } catch (e) {
        Logger.log('Cache remove error: ' + e.toString());
    }
}

function getScriptCache_() {
    return CacheService.getScriptCache();
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

function getCachedJson_(key) {
    try {
        const raw = getScriptCache_().get(key);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        Logger.log('Cache parse error (' + key + '): ' + e.toString());
        return null;
    }
}

function setCachedJson_(key, value, ttlSeconds) {
    try {
        getScriptCache_().put(key, JSON.stringify(value), ttlSeconds);
    } catch (e) {
        Logger.log('Cache put error (' + key + '): ' + e.toString());
    }
}

function removeCacheKey_(key) {
    try {
        getScriptCache_().remove(key);
    } catch (e) {
        Logger.log('Cache remove error (' + key + '): ' + e.toString());
    }
}

function getActiveQuizSnapshot_(sheetsRef) {
    const cacheKey = `quiz_snapshot_v${getQuizMetaVersion_()}`;
    const cached = getCachedJson_(cacheKey);
    if (cached) {
        return cached;
    }

    const quizData = sheetsRef.quizList.getDataRange().getValues();
    const snapshot = buildActiveQuizSnapshotFromQuizList_(quizData);
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

function invalidateDashboardStatsCacheForUser_(username) {
    removeCacheKey_('dashboard_stats_all');
    if (username) {
        removeCacheKey_(`dashboard_stats_user_${username}`);
        removeCacheKey_(`dashboard_init_v${getQuizMetaVersion_()}_${username}`);
    }
}

function invalidateDashboardQuizCaches_() {
    bumpQuizMetaVersion_();
}

function verifyToken(token) {
    try {
        if (!token || token.indexOf('.') === -1) {
            return null;
        }

        const tokenParts = String(token).split('.');
        if (tokenParts.length !== 2) {
            return null;
        }

        const payloadB64 = tokenParts[0];
        const signatureB64 = tokenParts[1];

        const expectedSignature = Utilities.computeHmacSha256Signature(payloadB64, SECRET_KEY);
        if (Utilities.base64Encode(expectedSignature) !== signatureB64) {
            return null;
        }

        const decodedBytes = Utilities.base64Decode(payloadB64);
        const decodedStr = Utilities.newBlob(decodedBytes).getDataAsString();
        const decoded = JSON.parse(decodedStr);

        if (!decoded || !decoded.username || !decoded.role || !decoded.sessionId || !decoded.timestamp) {
            return null;
        }

        const age = Date.now() - decoded.timestamp;
        if (age > TOKEN_EXPIRY) {
            return null;
        }

        const activeSessionId = getActiveSession_(decoded.username);
        if (!activeSessionId || activeSessionId !== decoded.sessionId) {
            return null;
        }

        return decoded;
    } catch (e) {
        Logger.log('Token Verify Error: ' + e.toString());
        return null;
    }
}



function isTruthy_(value) {
    if (typeof value === 'boolean') return value;
    if (value === null || value === undefined) return false;
    const normalized = String(value).trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'active';
}

function isActiveStatus_(value) {
    return isTruthy_(value);
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
    const dashboardCacheKey = `dashboard_init_v${getQuizMetaVersion_()}_${username}`;
    const cached = getCachedJson_(dashboardCacheKey);
    if (cached) {
        return JsonResponse(cached);
    }

    const snapshot = getActiveQuizSnapshot_(sheetsRef);
    const stats = getUserStatsCached_(sheetsRef, username);

    const response = {
        success: true,
        subjects: snapshot.subjects || [],
        quizzesBySubject: snapshot.quizzesBySubject || {},
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

    const subject = String(data.subject || '').trim();
    const snapshot = getActiveQuizSnapshot_(sheetsRef);
    const quizzesBySubject = snapshot.quizzesBySubject || {};
    const quizzes = subject ? (quizzesBySubject[subject] || []) : [];

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
    const quizListData = sheetsRef.quizList.getDataRange().getValues();
    let quizInfo = null;

    for (let i = 1; i < quizListData.length; i++) {
        if (quizListData[i][0] === quizID) {
            quizInfo = {
                quizID: quizListData[i][0],
                title: quizListData[i][2],
                timeLimit: quizListData[i][4],
                showAnswer: isTruthy_(quizListData[i][6]),
                shuffle: isTruthy_(quizListData[i][7]),
                antiCheat: quizListData[i].length > 8 ? isTruthy_(quizListData[i][8]) : true,
                autoNext: quizListData[i].length > 9 ? isTruthy_(quizListData[i][9]) : false,
                allowBack: quizListData[i].length > 10 ? isTruthy_(quizListData[i][10]) : true
            };
            break;
        }
    }

    if (!quizInfo) {
        return JsonResponse({success: false, message: 'Quiz not found'});
    }

    // Lấy các câu hỏi
    const questionsData = sheetsRef.questions.getDataRange().getValues();
    const questions = [];

    for (let i = 1; i < questionsData.length; i++) {
        if (questionsData[i][1] === quizID) {
            const questionID = questionsData[i][0];
            const answerData = extractAnswerData_(questionsData[i]);
            const correctAnswer = answerData.correctAnswer;

            // Tạo hash cho đáp án
            const answerHash = Utilities.computeDigest(
                Utilities.DigestAlgorithm.SHA_256,
                questionID + correctAnswer + SECRET_KEY,
                Utilities.Charset.UTF_8
            );

            const hexHash = answerHash.map(function(byte) {
                const value = (byte < 0) ? 256 + byte : byte;
                return ('0' + value.toString(16)).slice(-2);
            }).join('');

            questions.push({
                questionID: questionID,
                questionText: questionsData[i][2],
                A: questionsData[i][3],
                B: questionsData[i][4],
                C: questionsData[i][5],
                D: questionsData[i][6],
                explanation: answerData.explanation,
                answerHash: hexHash
            });
        }
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

// ==================== GRADING ====================

function handleSubmitScore(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token) {
        return JsonResponse({success: false, message: 'Invalid token'});
    }

    const username = token.username;
    const quizID = data.quizID;
    const userAnswers = typeof data.userAnswers === 'string' ? JSON.parse(data.userAnswers) : (data.userAnswers || {});
    const timestamp = new Date().toLocaleString();

    const questionsData = sheetsRef.questions.getDataRange().getValues();
    const reviewItems = [];
    const correctAnswers = [];
    const explanations = [];
    let correctCount = 0;
    let totalQuestions = 0;

    for (let i = 1; i < questionsData.length; i++) {
        if (questionsData[i][1] === quizID) {
            const questionID = questionsData[i][0];
            const questionText = questionsData[i][2];
            const optionA = questionsData[i][3] || '';
            const optionB = questionsData[i][4] || '';
            const optionC = questionsData[i][5] || '';
            const optionD = questionsData[i][6] || '';
            const answerData = extractAnswerData_(questionsData[i]);
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
    }

    const computedScore = totalQuestions > 0 ? (correctCount / totalQuestions) * 10 : 0;

    // Tạo LogID
    const logID = `${username}-${quizID}-${Date.now()}`;

    // Thêm vào Attempt_Logs sheet
    const newRow = [logID, username, quizID, computedScore, JSON.stringify(userAnswers), timestamp];
    sheetsRef.logs.appendRow(newRow);
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

    // Try to use cached data
    const cachedData = getCachedAdminData_();
    if (cachedData) {
        return JsonResponse({success: true, stats: cachedData.stats, quizzes: cachedData.quizzes});
    }

    // No cache, fetch from sheets
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

    const stats = {
        totalQuizzes: totalQuizzes,
        totalAttempts: totalAttempts,
        activeUsers: activeUsers.size,
        averageScore: averageScore
    };

    // Lấy danh sách quiz cho quản lý
    const quizzes = [];
    for (let i = 1; i < quizListData.length; i++) {
        const quizID = quizListData[i][0];

        quizzes.push({
            quizID: quizID,
            subject: quizListData[i][1],
            title: quizListData[i][2],
            description: quizListData[i][3],
            status: isTruthy_(quizListData[i][5]),
            showAnswer: isTruthy_(quizListData[i][6]),
            shuffle: isTruthy_(quizListData[i][7]),
            antiCheat: quizListData[i].length > 8 ? isTruthy_(quizListData[i][8]) : true,
            autoNext: quizListData[i].length > 9 ? isTruthy_(quizListData[i][9]) : false,
            allowBack: quizListData[i].length > 10 ? isTruthy_(quizListData[i][10]) : true,
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

    const usersData = sheetsRef.users.getDataRange().getValues();
    for (let i = 1; i < usersData.length; i++) {
        const username = String(usersData[i][0] || '').trim();
        if (username.toLowerCase() !== String(token.username || '').toLowerCase()) {
            continue;
        }

        const storedPinHash = String(usersData[i][4] || '').trim();
        if (!storedPinHash) {
            return JsonResponse({success: false, message: 'Admin PIN not configured'});
        }

        if (storedPinHash === pinHash) {
            const adminPinProof = generateAdminPinProof_(token.username);
            return JsonResponse({success: true, message: 'PIN verified', adminPinProof: adminPinProof});
        }

        return JsonResponse({success: false, message: 'Invalid PIN'});
    }

    return JsonResponse({success: false, message: 'Admin account not found'});
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

    const quizListData = sheetsRef.quizList.getDataRange().getValues();
    for (let i = 1; i < quizListData.length; i++) {
        if (quizListData[i][0] === quizID) {
            sheetsRef.quizList.getRange(i + 1, 7).setValue(showAnswer);
            invalidateAdminCache_();
            invalidateDashboardQuizCaches_();
            return JsonResponse({success: true, message: 'Show_Answer updated'});
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

    const quizListData = sheetsRef.quizList.getDataRange().getValues();
    for (let i = 1; i < quizListData.length; i++) {
        if (quizListData[i][0] === quizID) {
            sheetsRef.quizList.getRange(i + 1, 9).setValue(antiCheat);
            invalidateAdminCache_();
            invalidateDashboardQuizCaches_();
            return JsonResponse({success: true, message: 'Anti-Cheat status updated'});
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

function handleBulkUpload(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token || token.role !== 'Admin') {
        return JsonResponse({success: false, message: 'Unauthorized'});
    }

    if (!hasValidAdminPinProof_(data, token)) {
        return JsonResponse({success: false, message: 'Admin PIN required'});
    }

    const quizID = data.quizID;
    const questions = data.questions;

    if (!questions || questions.length === 0) {
        return JsonResponse({success: false, message: 'No questions provided'});
    }

    // Lấy ID câu hỏi cao nhất
    // Chuẩn bị data để insert
    const valuesToInsert = [];
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const questionID = 'Q_' + Utilities.getUuid().replace(/-/g, '').substring(0, 10);
        
        valuesToInsert.push([
            questionID,
            quizID,
            q.questionText,
            q.optionA,
            q.optionB,
            q.optionC,
            q.optionD,
            q.correctAnswer,
            q.explanation
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

    const username = data.username || token.username || 'unknown';
    const quizID = data.quizID || '';
    const violationType = data.violationType || 'unknown';
    const cheatCount = data.cheatCount || 0;
    const userAgent = data.userAgent || '';
    const timestamp = data.timestamp || new Date().toISOString();

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

// ==================== UTILITY FUNCTIONS ====================

function JsonResponse(data) {
    return ContentService
        .createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}

function extractAnswerData_(row) {
    const valueAt7 = String(row[7] || '').trim().toUpperCase();
    const valueAt8 = String(row[8] || '').trim().toUpperCase();

    if (/^[A-D]$/.test(valueAt8)) {
        return {
            correctAnswer: valueAt8,
            explanation: row[9] || ''
        };
    }

    if (/^[A-D]$/.test(valueAt7)) {
        return {
            correctAnswer: valueAt7,
            explanation: row[8] || ''
        };
    }

    return {
        correctAnswer: valueAt8 || valueAt7 || '',
        explanation: row[9] || row[8] || ''
    };
}

function getActiveSubjectsFromQuizList_(quizData) {
    const subjects = new Set();
    for (let i = 1; i < quizData.length; i++) {
        if (quizData[i][1] && isActiveStatus_(quizData[i][5])) {
            subjects.add(quizData[i][1]);
        }
    }
    return Array.from(subjects);
}

function buildActiveQuizSnapshotFromQuizList_(quizData) {
    const quizzesBySubject = {};
    const subjects = [];

    for (let i = 1; i < quizData.length; i++) {
        const subject = String(quizData[i][1] || '').trim();
        if (!subject || !isActiveStatus_(quizData[i][5])) {
            continue;
        }

        if (!quizzesBySubject[subject]) {
            quizzesBySubject[subject] = [];
            subjects.push(subject);
        }

        quizzesBySubject[subject].push({
            quizID: quizData[i][0],
            subject: subject,
            title: quizData[i][2],
            description: quizData[i][3],
            timeLimit: quizData[i][4],
            status: isTruthy_(quizData[i][5]),
            showAnswer: isTruthy_(quizData[i][6]),
            shuffle: isTruthy_(quizData[i][7]),
            antiCheat: quizData[i].length > 8 ? isTruthy_(quizData[i][8]) : true,
            autoNext: quizData[i].length > 9 ? isTruthy_(quizData[i][9]) : false,
            allowBack: quizData[i].length > 10 ? isTruthy_(quizData[i][10]) : true
        });
    }

    return {
        subjects: subjects,
        quizzesBySubject: quizzesBySubject
    };
}

function buildAllUserStatsFromLogs_(logsData) {
    const statsMap = {};

    for (let i = 1; i < logsData.length; i++) {
        const username = String(logsData[i][1] || '').trim();
        if (!username) {
            continue;
        }

        const score = parseFloat(logsData[i][3]);
        if (isNaN(score)) {
            continue;
        }

        if (!statsMap[username]) {
            statsMap[username] = {
                attempts: 0,
                highestScore: 0,
                totalScore: 0
            };
        }

        const userStats = statsMap[username];
        userStats.attempts += 1;
        userStats.totalScore += score;
        if (score > userStats.highestScore) {
            userStats.highestScore = score;
        }
    }

    Object.keys(statsMap).forEach((username) => {
        const item = statsMap[username];
        item.averageScore = item.attempts > 0 ? item.totalScore / item.attempts : 0;
        delete item.totalScore;
    });

    return statsMap;
}

function buildUserStatsFromLogs_(logsData, username) {
    let attempts = 0;
    let highestScore = 0;
    let totalScore = 0;

    for (let i = 1; i < logsData.length; i++) {
        if (logsData[i][1] !== username) continue;
        const score = parseFloat(logsData[i][3]);
        if (isNaN(score)) continue;

        attempts++;
        totalScore += score;
        if (score > highestScore) {
            highestScore = score;
        }
    }

    return {
        attempts: attempts,
        highestScore: highestScore,
        averageScore: attempts > 0 ? totalScore / attempts : 0
    };
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

// Test function (chạy từ Script Editor)
function test() {
    Logger.log('Quiz Lab Backend Initialized');
    Logger.log('Spreadsheet ID: ' + SPREADSHEET_ID);
    Logger.log('Sheets loaded: ' + Object.keys(getSheetsRef_()).length);
}
