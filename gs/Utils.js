let sheetsRefCache = null;

// ==================== SHEET REFERENCES ====================


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
            referralCodes: spreadsheet.getSheetByName('ReferralCodes'),
            quizList: spreadsheet.getSheetByName('Quiz_List'),
            questions: spreadsheet.getSheetByName('Questions'),
            logs: spreadsheet.getSheetByName('Attempt_Logs'),
            userStats: spreadsheet.getSheetByName('User_Stats'),
            reports: spreadsheet.getSheetByName('Report_Logs')
        };
    }

    return sheetsRefCache;
}


function normalizeHeaderName_(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}


function findHeaderIndex_(normalizedHeaders, candidateKeys, fallbackIndex) {
    for (let i = 0; i < candidateKeys.length; i++) {
        const key = normalizeHeaderName_(candidateKeys[i]);
        const foundIndex = normalizedHeaders.indexOf(key);
        if (foundIndex >= 0) {
            return foundIndex;
        }
    }
    return fallbackIndex;
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


function buildQuestionCountMapFromQuestions_(questionsData) {
    const questionCountByQuiz = {};

    for (let i = 1; i < questionsData.length; i++) {
        const quizID = String(questionsData[i][1] || '').trim();
        if (!quizID) {
            continue;
        }

        questionCountByQuiz[quizID] = (questionCountByQuiz[quizID] || 0) + 1;
    }

    return questionCountByQuiz;
}


function buildActiveQuizSnapshotFromQuizList_(quizData, questionCountByQuiz, quizListSchema) {
    const quizzesBySubject = {};
    const subjects = [];
    const schema = quizListSchema || getQuizListSchema_(getSheetsRef_().quizList);

    for (let i = 1; i < quizData.length; i++) {
        const subject = String(quizData[i][schema.subject] || '').trim();
        if (!subject || !isActiveStatus_(quizData[i][schema.status])) {
            continue;
        }

        if (!quizzesBySubject[subject]) {
            quizzesBySubject[subject] = [];
            subjects.push(subject);
        }

        const antiCheatModes = getRowAntiCheatModes_(quizData[i], schema);
        const practiceModes = getRowPracticeModes_(quizData[i], schema);
        const quizID = String(quizData[i][schema.quizID] || '').trim();

        quizzesBySubject[subject].push({
            quizID: quizID,
            subject: subject,
            title: quizData[i][schema.title],
            description: quizData[i][schema.description],
            timeLimit: quizData[i][schema.timeLimit],
            status: isTruthy_(quizData[i][schema.status]),
            showAnswer: practiceModes.showAnswer,
            revealCorrectOnWrong: practiceModes.revealCorrectOnWrong,
            showDetailedResult: getShowDetailedResult_(quizData[i], schema),
            shuffle: isTruthy_(quizData[i][schema.shuffle]),
            antiCheat: antiCheatModes.antiCheat,
            antiCheatTabSwitch: antiCheatModes.antiCheatTabSwitch,
            antiCheatFullscreen: antiCheatModes.antiCheatFullscreen,
            autoNext: isTruthy_(quizData[i][schema.autoNext]),
            allowBack: isTruthy_(quizData[i][schema.allowBack]),
            questionCount: (questionCountByQuiz && quizID) ? (questionCountByQuiz[quizID] || 0) : 0
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
                totalScore: 0,
                highestScoresByQuiz: {}
            };
        }

        const userStats = statsMap[username];
        const quizID = String(logsData[i][2] || '').trim();
        
        userStats.attempts += 1;
        userStats.totalScore += score;
        if (score > userStats.highestScore) {
            userStats.highestScore = score;
        }
        
        if (quizID) {
            if (!userStats.highestScoresByQuiz[quizID] || score > userStats.highestScoresByQuiz[quizID]) {
                userStats.highestScoresByQuiz[quizID] = score;
            }
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
    const highestScoresByQuiz = {};

    for (let i = 1; i < logsData.length; i++) {
        if (logsData[i][1] !== username) continue;
        const score = parseFloat(logsData[i][3]);
        if (isNaN(score)) continue;
        
        const quizID = String(logsData[i][2] || '').trim();

        attempts++;
        totalScore += score;
        if (score > highestScore) {
            highestScore = score;
        }
        
        if (quizID) {
            if (!highestScoresByQuiz[quizID] || score > highestScoresByQuiz[quizID]) {
                highestScoresByQuiz[quizID] = score;
            }
        }
    }

    return {
        attempts: attempts,
        highestScore: highestScore,
        averageScore: attempts > 0 ? totalScore / attempts : 0,
        highestScoresByQuiz: highestScoresByQuiz
    };
}


function getQuizQuestionsCached_(sheetsRef, quizID) {
    const safeQuizID = String(quizID || '').trim();
    if (!safeQuizID) return [];

    const cacheKey = `quiz_questions_v${getQuizMetaVersion_()}_${safeQuizID}`;
    const cached = getCachedJson_(cacheKey);
    if (cached) {
        return cached;
    }

    const questionsData = sheetsRef.questions.getDataRange().getValues();
    const quizQuestions = [];

    for (let i = 1; i < questionsData.length; i++) {
        if (String(questionsData[i][1] || '').trim() === safeQuizID) {
            quizQuestions.push({
                questionID: String(questionsData[i][0] || '').trim(),
                quizID: String(questionsData[i][1] || '').trim(),
                questionText: String(questionsData[i][2] || ''),
                optionA: String(questionsData[i][3] || ''),
                optionB: questionsData[i][4],
                optionC: questionsData[i][5],
                optionD: questionsData[i][6],
                answerData: extractAnswerData_(questionsData[i])
            });
        }
    }

    // Cache for 6 hours (21600 seconds)
    setCachedJson_(cacheKey, quizQuestions, 21600);
    return quizQuestions;
}
