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
            case 'updateQuizStatus':
                return handleUpdateQuizStatus(data);
            case 'updateShowAnswer':
                return handleUpdateShowAnswer(data);
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
        if (usersData[i][0] === username && usersData[i][1] === passwordHash) {
            const role = usersData[i][2];
            const fullName = usersData[i][3];
            
            // Tạo token
            const token = generateToken(username, role);
            
            return JsonResponse({
                success: true,
                token: token,
                role: role,
                username: username,
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
    const timestamp = Date.now();
    return Utilities.base64Encode(JSON.stringify({
        username: username,
        role: role,
        timestamp: timestamp
    }));
}

function verifyToken(token) {
    try {
        const decodedBytes = Utilities.base64Decode(token);
        const decodedStr = Utilities.newBlob(decodedBytes).getDataAsString();
        const decoded = JSON.parse(decodedStr);
        const age = Date.now() - decoded.timestamp;
        
        if (age > TOKEN_EXPIRY) {
            return null; // Token hết hạn
        }
        
        return decoded;
    } catch (e) {
        Logger.log('Token Verify Error: ' + e.toString());
        return null; // Token không hợp lệ
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

    const quizData = sheetsRef.quizList.getDataRange().getValues();
    const subjects = getActiveSubjectsFromQuizList_(quizData);

    return JsonResponse({
        success: true,
        subjects: subjects
    });
}

function handleGetDashboardInit(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token) {
        return JsonResponse({success: false, message: 'Invalid token'});
    }

    const username = data.username || token.username;
    const quizData = sheetsRef.quizList.getDataRange().getValues();
    const logsData = sheetsRef.logs.getDataRange().getValues();

    return JsonResponse({
        success: true,
        subjects: getActiveSubjectsFromQuizList_(quizData),
        stats: buildUserStatsFromLogs_(logsData, username)
    });
}

function handleGetQuizzesBySubject(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token) {
        return JsonResponse({success: false, message: 'Invalid token'});
    }

    const subject = data.subject;
    const quizData = sheetsRef.quizList.getDataRange().getValues();
    const quizzes = [];

    for (let i = 1; i < quizData.length; i++) {
        if (quizData[i][1] === subject && isActiveStatus_(quizData[i][5])) {
            quizzes.push({
                quizID: quizData[i][0],
                title: quizData[i][2],
                description: quizData[i][3],
                timeLimit: quizData[i][4],
                status: quizData[i][5],
                showAnswer: quizData[i][6]
            });
        }
    }

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
                showAnswer: isTruthy_(quizListData[i][6])
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

    const username = data.username;
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

    const computedScore = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

    // Tạo LogID
    const logID = `${username}-${quizID}-${Date.now()}`;

    // Thêm vào Attempt_Logs sheet
    const newRow = [logID, username, quizID, computedScore, JSON.stringify(userAnswers), timestamp];
    sheetsRef.logs.appendRow(newRow);

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

    const username = data.username || token.username;
    const logsData = sheetsRef.logs.getDataRange().getValues();

    return JsonResponse({
        success: true,
        stats: buildUserStatsFromLogs_(logsData, username)
    });
}

// ==================== ADMIN ====================

function handleGetAdminData(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token || token.role !== 'Admin') {
        return JsonResponse({success: false, message: 'Unauthorized'});
    }

    // Lấy thống kê
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

    // Lấy danh sách quiz cho quản lý
    const quizzes = [];
    for (let i = 1; i < quizListData.length; i++) {
        const quizID = quizListData[i][0];

        quizzes.push({
            quizID: quizID,
            subject: quizListData[i][1],
            title: quizListData[i][2],
            description: quizListData[i][3],
            status: quizListData[i][5],
            showAnswer: quizListData[i][6],
            questionCount: questionCountByQuiz[quizID] || 0,
            attempts: attemptCountByQuiz[quizID] || 0
        });
    }

    return JsonResponse({
        success: true,
        stats: {
            totalQuizzes: totalQuizzes,
            totalAttempts: totalAttempts,
            activeUsers: activeUsers.size,
            averageScore: averageScore
        },
        quizzes: quizzes
    });
}

function handleUpdateQuizStatus(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token || token.role !== 'Admin') {
        return JsonResponse({success: false, message: 'Unauthorized'});
    }

    const quizID = data.quizID;
    const status = data.status;

    const quizListData = sheetsRef.quizList.getDataRange().getValues();
    for (let i = 1; i < quizListData.length; i++) {
        if (quizListData[i][0] === quizID) {
            sheetsRef.quizList.getRange(i + 1, 6).setValue(status);
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

    const quizID = data.quizID;
    const showAnswer = data.showAnswer;

    const quizListData = sheetsRef.quizList.getDataRange().getValues();
    for (let i = 1; i < quizListData.length; i++) {
        if (quizListData[i][0] === quizID) {
            sheetsRef.quizList.getRange(i + 1, 7).setValue(showAnswer);
            return JsonResponse({success: true, message: 'Show_Answer updated'});
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

// Test function (chạy từ Script Editor)
function test() {
    Logger.log('Quiz Lab Backend Initialized');
    Logger.log('Spreadsheet ID: ' + SPREADSHEET_ID);
    Logger.log('Sheets loaded: ' + Object.keys(getSheetsRef_()).length);
}
