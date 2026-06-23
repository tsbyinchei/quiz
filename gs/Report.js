function handleReportQuestionError(data) {
    const sheetsRef = getSheetsRef_();
    
    // Verify user
    const token = verifyToken(data.token);
    if (!token) {
        return JsonResponse({success: false, message: 'Invalid token'});
    }
    
    const questionID = data.questionID;
    const errorType = data.errorType;
    const details = data.details || 'Không có';
    const username = token.username;
    const quizID = data.quizID;

    // Retrieve original question text
    const questionsData = sheetsRef.questions.getDataRange().getValues();
    let originalQuestionText = 'Không tìm thấy nội dung câu hỏi';
    
    for (let i = 1; i < questionsData.length; i++) {
        if (String(questionsData[i][0]) === String(questionID)) {
            originalQuestionText = questionsData[i][2];
            break;
        }
    }

    // Save to Report_Logs sheet
    if (sheetsRef.reports) {
        try {
            const timestamp = new Date().toLocaleString();
            sheetsRef.reports.appendRow([username, quizID, questionID, errorType, details, timestamp]);
        } catch (e) {
            Logger.log('Cannot append to Report_Logs: ' + e.toString());
        }
    }

    // Get Telegram Config from Script Properties
    const props = PropertiesService.getScriptProperties();
    const telegramToken = String(props.getProperty('TELEGRAM_API_TOKEN') || '').trim();
    const chatId = String(props.getProperty('TELEGRAM_CHAT_ID') || '').trim();

    if (!telegramToken || !chatId) {
        // If not configured, we might log it and return success so user doesn't get error, or return error.
        // Let's log it and return true so user thinks it was sent, but maybe we should return a specific message.
        Logger.log('Telegram API Token or Chat ID is not configured.');
        return JsonResponse({success: false, message: 'Hệ thống chưa được cấu hình Telegram.'});
    }

    // Format Message
    const message = `🚨 <b>BÁO CÁO LỖI CÂU HỎI</b>\n\n`
                  + `👤 <b>Người báo:</b> ${username}\n`
                  + `📚 <b>Quiz ID:</b> ${quizID}\n`
                  + `❓ <b>ID Câu hỏi:</b> ${questionID}\n`
                  + `🚩 <b>Loại lỗi:</b> ${errorType}\n`
                  + `📝 <b>Chi tiết:</b> ${details}\n\n`
                  + `📄 <b>Nội dung câu hỏi gốc:</b>\n`
                  + `<i>${originalQuestionText}</i>`;

    const telegramUrl = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
    const payload = {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
    };

    const options = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    };

    try {
        const response = UrlFetchApp.fetch(telegramUrl, options);
        let result;
        try {
            result = JSON.parse(response.getContentText());
        } catch (parseError) {
            return JsonResponse({success: false, message: 'Lỗi parse JSON từ Telegram: ' + response.getContentText().substring(0, 50)});
        }
        
        if (result.ok) {
            return JsonResponse({success: true, message: 'Report sent successfully'});
        } else {
            Logger.log('Telegram API Error: ' + response.getContentText());
            return JsonResponse({success: false, message: 'Lỗi khi gửi Telegram: ' + result.description});
        }
    } catch (e) {
        Logger.log('Exception in handleReportQuestionError: ' + e.toString());
        return JsonResponse({success: false, message: 'Ngoại lệ khi gọi Telegram API: ' + e.message});
    }
}

// Function dùng để cấp quyền (Chạy từ Script Editor)
function testTelegramAuth() {
    UrlFetchApp.fetch("https://api.telegram.org/");
    Logger.log("Đã cấp quyền thành công!");
}
