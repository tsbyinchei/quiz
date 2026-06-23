
// ==================== MAIN HANDLER ====================

function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);
        const action = data.action;

        // Route tới các hàm tương ứng
        switch(action) {
            case 'login':
                return handleLogin(data);
            case 'registerUser':
                return handleRegisterUser(data);
            case 'requestPasswordReset':
                return handleRequestPasswordReset(data);
            case 'confirmPasswordReset':
                return handleConfirmPasswordReset(data);
            case 'resetPasswordViaReferral':
                return handleResetPasswordViaReferral(data);
            case 'getAccountInfo':
                return handleGetAccountInfo(data);
            case 'updateUserInfo':
                return handleUpdateUserInfo(data);
            case 'getDashboardStats':
                return handleGetDashboardStats(data);
            case 'changePassword':
                return handleChangePassword(data);
            case 'getSubjects':
                return handleGetSubjects(data);
            case 'getDashboardInit':
                return handleGetDashboardInit(data);
            case 'getQuizzesBySubject':
                return handleGetQuizzesBySubject(data);
            case 'getQuizData':
                return handleGetQuizData(data);
            case 'verifyAnswer':
                return handleVerifyAnswer(data);
            case 'resolveCorrectOption':
                return handleResolveCorrectOption(data);
            case 'submitScore':
                return handleSubmitScore(data);
            case 'getUserStats':
                return handleGetUserStats(data);
            case 'getAdminData':
                return handleGetAdminData(data);
            case 'getReferralCodes':
                return handleGetReferralCodes(data);
            case 'generateReferralCodes':
                return handleGenerateReferralCodes(data);
            case 'verifyAdminPin':
                return handleVerifyAdminPin(data);
            case 'updateQuizStatus':
                return handleUpdateQuizStatus(data);
            case 'updateShowAnswer':
                return handleUpdateShowAnswer(data);
            case 'updateRevealCorrectOnWrong':
                return handleUpdateRevealCorrectOnWrong(data);
            case 'updateShuffle':
                return handleUpdateShuffle(data);
            case 'updateAntiCheat':
                return handleUpdateAntiCheat(data);
            case 'updateAntiCheatTabSwitch':
                return handleUpdateAntiCheatTabSwitch(data);
            case 'updateAntiCheatFullscreen':
                return handleUpdateAntiCheatFullscreen(data);
            case 'updateAutoNext':
                return handleUpdateAutoNext(data);
            case 'updateAllowBack':
                return handleUpdateAllowBack(data);
            case 'batchUpdateQuizSettings':
                return handleBatchUpdateQuizSettings(data);
            case 'bulkUpload':
                return handleBulkUpload(data);
            case 'logCheatViolation':
                return handleLogCheat(data);
            case 'reportQuestionError':
                return handleReportQuestionError(data);
            default:
                return JsonResponse({success: false, message: 'Unknown action'});
        }
    } catch (error) {
        Logger.log('Error: ' + error.toString());
        return JsonResponse({success: false, message: error.toString()});
    }
}

function doGet(e) {
    return ContentService.createTextOutput("Quiz Lab Backend API is running. Please use POST requests to interact with this API.");
}


// Test function (chạy từ Script Editor)
function test() {
    Logger.log('Quiz Lab Backend Initialized');
    Logger.log('Spreadsheet ID: ' + SPREADSHEET_ID);
    Logger.log('Sheets loaded: ' + Object.keys(getSheetsRef_()).length);
}
