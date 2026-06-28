const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'TsByin_Exam_Backend.gs');
const outDir = path.join(__dirname, 'gs_modules');

if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

const content = fs.readFileSync(inputFile, 'utf8');
const lines = content.split(/\r?\n/);

const functionMap = {
    'getSpreadsheet_': 'Utils.gs',
    'getSheetsRef_': 'Utils.gs',
    'doPost': 'TsByin_Exam_Backend.gs',
    'handleLogin': 'Auth.gs',
    'handleRegisterUser': 'Auth.gs',
    'handleRequestPasswordReset': 'Auth.gs',
    'handleConfirmPasswordReset': 'Auth.gs',
    'handleResetPasswordViaReferral': 'Auth.gs',
    'moveReferralCodeRowToBottom_': 'Auth.gs',
    'getUsersSchema_': 'Auth.gs',
    'getReferralCodesSchema_': 'Auth.gs',
    'getQuizListSchema_': 'Quiz.gs',
    'ensureAntiCheatModeColumns_': 'Quiz.gs',
    'getRowAntiCheatModes_': 'Quiz.gs',
    'ensureQuizModeColumns_': 'Quiz.gs',
    'getRevealCorrectOnWrong_': 'Quiz.gs',
    'getShowDetailedResult_': 'Quiz.gs',
    'getRowPracticeModes_': 'Quiz.gs',
    'enforceExclusivePracticeModes_': 'Quiz.gs',
    'normalizeHeaderName_': 'Utils.gs',
    'findHeaderIndex_': 'Utils.gs',
    'sha256Hex_': 'Auth.gs',
    'hashPasswordWithSalt_': 'Auth.gs',
    'verifyStoredPasswordHash_': 'Auth.gs',
    'getDashboardStatsSnapshot_': 'Quiz.gs',
    'getJwtSecrets_': 'Auth.gs',
    'getJwtSecret_': 'Auth.gs',
    'rotateJwtSecret_': 'Auth.gs',
    'isValidTokenSignature_': 'Auth.gs',
    'generateToken': 'Auth.gs',
    'setActiveSession_': 'Auth.gs',
    'getActiveSession_': 'Auth.gs',
    'generateAdminPinProof_': 'Auth.gs',
    'getAdminPinProof_': 'Auth.gs',
    'hasValidAdminPinProof_': 'Auth.gs',
    'getRateLimitKey_': 'Auth.gs',
    'getRateLimitState_': 'Auth.gs',
    'isRateLimited_': 'Auth.gs',
    'registerRateLimitFailure_': 'Auth.gs',
    'clearRateLimitFailures_': 'Auth.gs',
    'getCachedAdminData_': 'Cache.gs',
    'setCachedAdminData_': 'Cache.gs',
    'invalidateAdminCache_': 'Cache.gs',
    'getScriptCache_': 'Cache.gs',
    'getQuizMetaVersion_': 'Quiz.gs',
    'bumpQuizMetaVersion_': 'Quiz.gs',
    'getCachedJson_': 'Cache.gs',
    'setCachedJson_': 'Cache.gs',
    'removeCacheKey_': 'Cache.gs',
    'getActiveQuizSnapshot_': 'Quiz.gs',
    'getUserStatsCached_': 'Quiz.gs',
    'getUserQuizAttemptCountsCached_': 'Quiz.gs',
    'attachUserAttemptsToQuizzes_': 'Quiz.gs',
    'invalidateDashboardStatsCacheForUser_': 'Quiz.gs',
    'invalidateDashboardQuizCaches_': 'Quiz.gs',
    'verifyToken': 'Auth.gs',
    'getQuizRuntimeModesByID_': 'Quiz.gs',
    'isTruthy_': 'Utils.gs',
    'isActiveStatus_': 'Utils.gs',
    'handleGetSubjects': 'Quiz.gs',
    'handleGetDashboardInit': 'Quiz.gs',
    'handleGetQuizzesBySubject': 'Quiz.gs',
    'handleGetQuizData': 'Quiz.gs',
    'handleVerifyAnswer': 'Grading.gs',
    'handleResolveCorrectOption': 'Grading.gs',
    'handleSubmitScore': 'Grading.gs',
    'handleGetUserStats': 'Grading.gs',
    'handleGetDashboardStats': 'Grading.gs',
    'handleGetAccountInfo': 'Auth.gs',
    'handleUpdateUserInfo': 'Auth.gs',
    'handleChangePassword': 'Auth.gs',
    'handleGetAdminData': 'Admin.gs',
    'handleVerifyAdminPin': 'Admin.gs',
    'handleGetReferralCodes': 'Admin.gs',
    'handleGenerateReferralCodes': 'Admin.gs',
    'generateReferralCode_': 'Admin.gs',
    'handleUpdateQuizStatus': 'Admin.gs',
    'handleUpdateShowAnswer': 'Admin.gs',
    'handleUpdateRevealCorrectOnWrong': 'Admin.gs',
    'handleUpdateShuffle': 'Admin.gs',
    'handleUpdateAntiCheat': 'Admin.gs',
    'handleUpdateAntiCheatTabSwitch': 'Admin.gs',
    'handleUpdateAntiCheatFullscreen': 'Admin.gs',
    'handleUpdateAutoNext': 'Admin.gs',
    'handleUpdateAllowBack': 'Admin.gs',
    'handleBatchUpdateQuizSettings': 'Admin.gs',
    'handleBulkUpload': 'Admin.gs',
    'handleLogCheat': 'Admin.gs',
    'JsonResponse': 'Utils.gs',
    'extractAnswerData_': 'Utils.gs',
    'getActiveSubjectsFromQuizList_': 'Utils.gs',
    'buildQuestionCountMapFromQuestions_': 'Utils.gs',
    'buildActiveQuizSnapshotFromQuizList_': 'Utils.gs',
    'buildAllUserStatsFromLogs_': 'Utils.gs',
    'buildUserStatsFromLogs_': 'Utils.gs',
    'normalizeQuizListBooleanFlags_': 'Admin.gs',
    'test': 'TsByin_Exam_Backend.gs'
};

const output = {
    'Config.gs': [],
    'Cache.gs': [],
    'Auth.gs': [],
    'Quiz.gs': [],
    'Grading.gs': [],
    'Admin.gs': [],
    'Utils.gs': [],
    'TsByin_Exam_Backend.gs': []
};

// Top configuration block
output['Config.gs'].push(lines.slice(0, 27).join('\n'));

// Variable sheetsRefCache -> Utils.gs
output['Utils.gs'].push('let sheetsRefCache = null;\n');

let currentFn = [];
let currentModule = null;
let insideFn = false;
let braceCount = 0;
let buffer = [];

for (let i = 27; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('let sheetsRefCache = null;')) continue;

    const fnMatch = line.match(/^function\s+([a-zA-Z0-9_]+)\s*\(/);
    
    if (!insideFn && fnMatch) {
        insideFn = true;
        braceCount = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        const fnName = fnMatch[1];
        currentModule = functionMap[fnName] || 'TsByin_Exam_Backend.gs';
        
        // Add preceding comments to the function block
        currentFn = [...buffer, line];
        buffer = [];
        
        if (braceCount === 0) {
            insideFn = false;
            output[currentModule].push(currentFn.join('\n') + '\n');
            currentFn = [];
            currentModule = null;
        }
    } else if (!insideFn) {
        // Collect comments or empty lines
        buffer.push(line);
    } else {
        currentFn.push(line);
        braceCount += (line.match(/\{/g) || []).length;
        braceCount -= (line.match(/\}/g) || []).length;
        if (braceCount === 0) {
            insideFn = false;
            output[currentModule].push(currentFn.join('\n') + '\n');
            currentFn = [];
            currentModule = null;
        }
    }
}

// Write the output files
Object.keys(output).forEach(mod => {
    let text = output[mod].join('\n');
    if (mod === 'TsByin_Exam_Backend.gs') {
        // Just write to gs_modules/TsByin_Exam_Backend_Main.gs as a temp
        fs.writeFileSync(path.join(outDir, 'TsByin_Exam_Backend_Main.gs'), text, 'utf8');
    } else {
        fs.writeFileSync(path.join(outDir, mod), text, 'utf8');
    }
});

console.log('Split completed successfully.');
