let attemptChart;
let adminView = 'overview';
let adminQuizzesData = [];
let adminSubjects = [];
let adminSelectedSubject = '';
let adminPinVerified = sessionStorage.getItem('adminPinVerified') === 'true';
let adminPinVerifiedFor = sessionStorage.getItem('adminPinVerifiedFor') || '';
let adminPinProof = sessionStorage.getItem('adminPinProof') || '';
const adminToggleLocks = new Set();
let adminPendingChanges = {};
let adminOriginalStates = {};
let adminBulkActionsVisible = false;
let adminBatchSaving = false;
let pendingNavigationEvent = null;
let adminReferralCodes = [];

const ADMIN_BOOLEAN_FIELDS = {
    status: false,
    showAnswer: false,
    revealCorrectOnWrong: false,
    showDetailedResult: true,
    shuffle: false,
    autoNext: false,
    allowBack: true,
    antiCheatTabSwitch: false,
    antiCheatFullscreen: false
};



function getQuizPracticeModes(quiz) {
    const info = quiz || {};
    const practiceMode = isEnabled(info.showAnswer, false);
    const revealCorrectOnWrong = practiceMode
        ? false
        : isEnabled(info.revealCorrectOnWrong, false);

    return {
        showAnswer: practiceMode,
        revealCorrectOnWrong: revealCorrectOnWrong
    };
}

function normalizeAdminSubject(subject) {
    const value = String(subject || '').trim();
    return value || 'Chưa phân loại';
}

function isEnabled(value, defaultValue = false) {
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }

    if (typeof value === 'boolean') {
        return value;
    }

    const normalized = String(value).trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'active' || normalized === 'checked';
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getQuizSubject(quiz) {
    return normalizeAdminSubject(quiz && quiz.subject);
}

function getAdminSubjectQuizzes(subject) {
    return (adminQuizzesData || []).filter((quiz) => getQuizSubject(quiz) === subject);
}

function setAdminToggleBusy(quizID, key, isBusy) {
    const lockKey = `${quizID}:${key}`;
    if (isBusy) {
        adminToggleLocks.add(lockKey);
    } else {
        adminToggleLocks.delete(lockKey);
    }
}

function isAdminToggleBusy(quizID, key) {
    return adminToggleLocks.has(`${quizID}:${key}`);
}

function updateLocalQuizField(quizID, key, value) {
    const idx = adminQuizzesData.findIndex((quiz) => quiz && quiz.quizID === quizID);
    if (idx < 0) {
        return;
    }

    adminQuizzesData[idx] = {
        ...adminQuizzesData[idx],
        [key]: !!value
    };

    renderAdminViewForSelectedSubject();
}

function getBulkActionConfig() {
    return [
        {
            key: 'status',
            label: 'Kích Hoạt Bài Thi',
            getter: (quiz) => isEnabled(quiz.status, false),
            updater: (quizID, value) => stageQuizFieldChange(quizID, 'status', value)
        },
        {
            key: 'showAnswer',
            label: 'Chế Độ Luyện Tập',
            getter: (quiz) => getQuizPracticeModes(quiz).showAnswer,
            updater: (quizID, value) => stageQuizFieldChange(quizID, 'showAnswer', value)
        },
        {
            key: 'revealCorrectOnWrong',
            label: 'Hiển thị đáp án đúng khi sai',
            getter: (quiz) => getQuizPracticeModes(quiz).revealCorrectOnWrong,
            updater: (quizID, value) => stageQuizFieldChange(quizID, 'revealCorrectOnWrong', value)
        },
        {
            key: 'showDetailedResult',
            label: 'Hiển thị chi tiết kết quả',
            getter: (quiz) => isEnabled(quiz.showDetailedResult, true),
            updater: (quizID, value) => stageQuizFieldChange(quizID, 'showDetailedResult', value)
        },
        {
            key: 'shuffle',
            label: 'Đảo Câu / Đáp Án',
            getter: (quiz) => isEnabled(quiz.shuffle, false),
            updater: (quizID, value) => stageQuizFieldChange(quizID, 'shuffle', value)
        },
        {
            key: 'antiCheatTabSwitch',
            label: 'Anti-Cheat (Chuyển Tab)',
            getter: (quiz) => isEnabled(quiz.antiCheatTabSwitch, false),
            updater: (quizID, value) => stageQuizFieldChange(quizID, 'antiCheatTabSwitch', value)
        },
        {
            key: 'antiCheatFullscreen',
            label: 'Anti-Cheat (Toàn Màn Hình)',
            getter: (quiz) => isEnabled(quiz.antiCheatFullscreen, false),
            updater: (quizID, value) => stageQuizFieldChange(quizID, 'antiCheatFullscreen', value)
        },
        {
            key: 'autoNext',
            label: 'Tự động chuyển câu',
            getter: (quiz) => isEnabled(quiz.autoNext, false),
            updater: (quizID, value) => stageQuizFieldChange(quizID, 'autoNext', value)
        },
        {
            key: 'allowBack',
            label: 'Cho phép quay lại câu trước',
            getter: (quiz) => isEnabled(quiz.allowBack, true),
            updater: (quizID, value) => stageQuizFieldChange(quizID, 'allowBack', value)
        }
    ];
}

function cloneChangesMap(changesMap) {
    return JSON.parse(JSON.stringify(changesMap || {}));
}

function getPendingChangeCount() {
    return Object.values(adminPendingChanges).reduce((count, quizFields) => {
        return count + Object.keys(quizFields || {}).length;
    }, 0);
}

function refreshBatchSaveBar() {
    const bar = document.getElementById('batchSaveBar');
    const message = document.getElementById('batchSaveMessage');
    const hasPendingChanges = getPendingChangeCount() > 0;
    const pendingCount = getPendingChangeCount();

    if (bar) {
        bar.classList.toggle('show', hasPendingChanges);
    }

    if (message) {
        if (!hasPendingChanges) {
            message.textContent = 'Bạn có thay đổi chưa lưu.';
        } else {
            message.textContent = `Bạn có ${pendingCount} thay đổi chưa lưu.`;
        }
    }

    updateSubjectPillsLockState();
}

function updateSubjectPillsLockState() {
    const pills = document.querySelectorAll('.subject-pill');
    pills.forEach((pill) => {
        if (adminBatchSaving) {
            pill.setAttribute('disabled', 'disabled');
            pill.style.pointerEvents = 'none';
        } else {
            pill.removeAttribute('disabled');
            pill.style.pointerEvents = '';
        }
    });
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '\u2705 ' : (type === 'error' ? '\u26A0\uFE0F ' : '');
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    container.appendChild(toast);

    const autoRemoveTime = type === 'error' ? 5000 : 3000;
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, autoRemoveTime);
}

function scrollAdminToTop() {
    document.querySelector('.admin-content-area').scrollTo({ top: 0, behavior: 'smooth' });
}



function updateBackToTopButton() {
    const button = document.getElementById('backToTopBtn');
    if (!button) {
        return;
    }

    const shouldShow = document.querySelector('.admin-content-area').scrollTop > 420;
    button.classList.toggle('is-hidden', !shouldShow);
}

function openUnsavedWarning() {
    const overlay = document.getElementById('unsavedWarningOverlay');
    if (overlay) {
        overlay.classList.add('is-open');
        overlay.setAttribute('aria-hidden', 'false');
    }
}

function closeUnsavedWarning() {
    const overlay = document.getElementById('unsavedWarningOverlay');
    if (overlay) {
        overlay.classList.remove('is-open');
        overlay.setAttribute('aria-hidden', 'true');
    }
    pendingNavigationEvent = null;
}

function openAdminStatsModal() { }
function closeAdminStatsModal() { }
function closeAdminStatsModalOnBackdrop(event) { }

function confirmNavigateAway() {
    closeUnsavedWarning();
    if (pendingNavigationEvent && pendingNavigationEvent.href) {
        window.location.href = pendingNavigationEvent.href;
    } else if (pendingNavigationEvent) {
        window.history.back();
    }
}

function getCurrentQuizFieldValue(quizID, fieldKey) {
    const quiz = (adminQuizzesData || []).find((item) => item && item.quizID === quizID);
    const defaultValue = Object.prototype.hasOwnProperty.call(ADMIN_BOOLEAN_FIELDS, fieldKey)
        ? ADMIN_BOOLEAN_FIELDS[fieldKey]
        : false;

    if (!quiz) {
        return !!defaultValue;
    }



    if (fieldKey === 'showAnswer' || fieldKey === 'revealCorrectOnWrong') {
        return getQuizPracticeModes(quiz)[fieldKey];
    }

    return isEnabled(quiz[fieldKey], defaultValue);
}

function getRawQuizFieldValue(quizID, fieldKey) {
    const quiz = (adminQuizzesData || []).find((item) => item && item.quizID === quizID);
    const defaultValue = Object.prototype.hasOwnProperty.call(ADMIN_BOOLEAN_FIELDS, fieldKey)
        ? ADMIN_BOOLEAN_FIELDS[fieldKey]
        : false;

    if (!quiz) {
        return !!defaultValue;
    }

    return isEnabled(quiz[fieldKey], defaultValue);
}

function removePendingQuizIfEmpty(quizID) {
    if (adminPendingChanges[quizID] && Object.keys(adminPendingChanges[quizID]).length === 0) {
        delete adminPendingChanges[quizID];
    }

    if (adminOriginalStates[quizID] && Object.keys(adminOriginalStates[quizID]).length === 0) {
        delete adminOriginalStates[quizID];
    }
}

function trackPendingQuizChange(quizID, fieldKey, nextValue, originalValue) {
    if (!Object.prototype.hasOwnProperty.call(adminOriginalStates, quizID)) {
        adminOriginalStates[quizID] = {};
    }

    if (!Object.prototype.hasOwnProperty.call(adminOriginalStates[quizID], fieldKey)) {
        adminOriginalStates[quizID][fieldKey] = !!originalValue;
    }

    if (!Object.prototype.hasOwnProperty.call(adminPendingChanges, quizID)) {
        adminPendingChanges[quizID] = {};
    }

    const normalizedNext = !!nextValue;
    const normalizedOriginal = !!adminOriginalStates[quizID][fieldKey];

    if (normalizedNext === normalizedOriginal) {
        delete adminPendingChanges[quizID][fieldKey];
        delete adminOriginalStates[quizID][fieldKey];
        removePendingQuizIfEmpty(quizID);
    } else {
        adminPendingChanges[quizID][fieldKey] = normalizedNext;
    }

    refreshBatchSaveBar();
}

function stageQuizFieldChange(quizID, fieldKey, nextValue) {
    const currentValue = (fieldKey === 'showAnswer' || fieldKey === 'revealCorrectOnWrong')
        ? getRawQuizFieldValue(quizID, fieldKey)
        : getCurrentQuizFieldValue(quizID, fieldKey);
    const normalizedNext = !!nextValue;

    updateLocalQuizField(quizID, fieldKey, normalizedNext);
    trackPendingQuizChange(quizID, fieldKey, normalizedNext, currentValue);

    if (fieldKey === 'showAnswer' && normalizedNext) {
        const revealCurrentValue = getRawQuizFieldValue(quizID, 'revealCorrectOnWrong');
        updateLocalQuizField(quizID, 'revealCorrectOnWrong', false);
        trackPendingQuizChange(quizID, 'revealCorrectOnWrong', false, revealCurrentValue);
    }

    if (fieldKey === 'revealCorrectOnWrong' && normalizedNext) {
        const showAnswerCurrentValue = getRawQuizFieldValue(quizID, 'showAnswer');
        updateLocalQuizField(quizID, 'showAnswer', false);
        trackPendingQuizChange(quizID, 'showAnswer', false, showAnswerCurrentValue);
    }
}

function setLocalQuizFieldValue(quizID, fieldKey, nextValue) {
    const idx = adminQuizzesData.findIndex((quiz) => quiz && quiz.quizID === quizID);
    if (idx < 0) {
        return;
    }

    adminQuizzesData[idx] = {
        ...adminQuizzesData[idx],
        [fieldKey]: !!nextValue
    };
}

function stageGlobalQuizFieldChange(fieldKey, nextValue) {
    const allQuizzes = Array.isArray(adminQuizzesData) ? adminQuizzesData : [];
    const normalizedNext = !!nextValue;

    allQuizzes.forEach((quiz) => {
        if (!quiz || !quiz.quizID) {
            return;
        }

        const quizID = quiz.quizID;
        const currentValue = (fieldKey === 'showAnswer' || fieldKey === 'revealCorrectOnWrong')
            ? getRawQuizFieldValue(quizID, fieldKey)
            : getCurrentQuizFieldValue(quizID, fieldKey);

        if (!Object.prototype.hasOwnProperty.call(adminOriginalStates, quizID)) {
            adminOriginalStates[quizID] = {};
        }

        if (!Object.prototype.hasOwnProperty.call(adminOriginalStates[quizID], fieldKey)) {
            adminOriginalStates[quizID][fieldKey] = !!currentValue;
        }

        if (!Object.prototype.hasOwnProperty.call(adminPendingChanges, quizID)) {
            adminPendingChanges[quizID] = {};
        }

        const normalizedOriginal = !!adminOriginalStates[quizID][fieldKey];
        if (normalizedNext === normalizedOriginal) {
            delete adminPendingChanges[quizID][fieldKey];
            delete adminOriginalStates[quizID][fieldKey];
        } else {
            adminPendingChanges[quizID][fieldKey] = normalizedNext;
        }

        setLocalQuizFieldValue(quizID, fieldKey, normalizedNext);

        if (fieldKey === 'showAnswer' && normalizedNext) {
            const revealCurrentValue = getRawQuizFieldValue(quizID, 'revealCorrectOnWrong');
            if (!Object.prototype.hasOwnProperty.call(adminOriginalStates[quizID], 'revealCorrectOnWrong')) {
                adminOriginalStates[quizID].revealCorrectOnWrong = !!revealCurrentValue;
            }

            const revealOriginalValue = !!adminOriginalStates[quizID].revealCorrectOnWrong;
            if (revealOriginalValue === false) {
                delete adminPendingChanges[quizID].revealCorrectOnWrong;
                delete adminOriginalStates[quizID].revealCorrectOnWrong;
            } else {
                adminPendingChanges[quizID].revealCorrectOnWrong = false;
            }

            setLocalQuizFieldValue(quizID, 'revealCorrectOnWrong', false);
        }

        if (fieldKey === 'revealCorrectOnWrong' && normalizedNext) {
            const showAnswerCurrentValue = getRawQuizFieldValue(quizID, 'showAnswer');
            if (!Object.prototype.hasOwnProperty.call(adminOriginalStates[quizID], 'showAnswer')) {
                adminOriginalStates[quizID].showAnswer = !!showAnswerCurrentValue;
            }

            const showAnswerOriginalValue = !!adminOriginalStates[quizID].showAnswer;
            if (showAnswerOriginalValue === false) {
                delete adminPendingChanges[quizID].showAnswer;
                delete adminOriginalStates[quizID].showAnswer;
            } else {
                adminPendingChanges[quizID].showAnswer = false;
            }

            setLocalQuizFieldValue(quizID, 'showAnswer', false);
        }

        removePendingQuizIfEmpty(quizID);
    });

    refreshBatchSaveBar();

    if (adminView === 'function') {
        renderFunctionView();
    } else if (adminView === 'manage') {
        renderAdminViewForSelectedSubject();
    } else if (adminView === 'chart') {
        renderAdminChartView();
    }
}

function prunePendingChangesByResult(failedUpdates) {
    const failedMap = new Map();

    (failedUpdates || []).forEach((item) => {
        const quizID = String(item && item.quizID ? item.quizID : '').trim();
        if (!quizID) {
            return;
        }

        if (!failedMap.has(quizID)) {
            failedMap.set(quizID, new Set());
        }

        if (Array.isArray(item.fields) && item.fields.length > 0) {
            item.fields.forEach((field) => failedMap.get(quizID).add(String(field)));
        }
    });

    Object.keys(adminPendingChanges).forEach((quizID) => {
        const failedFields = failedMap.get(quizID);
        const pendingFields = adminPendingChanges[quizID] || {};

        Object.keys(pendingFields).forEach((fieldKey) => {
            const hasFailedFields = failedFields && failedFields.size > 0;
            const fieldFailed = hasFailedFields ? failedFields.has(fieldKey) : !!failedFields;

            if (!fieldFailed) {
                delete adminPendingChanges[quizID][fieldKey];
                if (adminOriginalStates[quizID]) {
                    delete adminOriginalStates[quizID][fieldKey];
                }
            }
        });

        removePendingQuizIfEmpty(quizID);
    });
}

async function cancelBatchChanges() {
    if (adminBatchSaving || getPendingChangeCount() === 0) {
        return;
    }

    const confirmed = await window.showInAppConfirm(
        'Bạn có chắc muốn hủy toàn bộ thay đổi chưa lưu?',
        'Xác nhận hủy thay đổi'
    );

    if (!confirmed) {
        return;
    }

    Object.keys(adminPendingChanges).forEach((quizID) => {
        const fields = adminPendingChanges[quizID] || {};
        Object.keys(fields).forEach((fieldKey) => {
            const originalValue = adminOriginalStates[quizID] && Object.prototype.hasOwnProperty.call(adminOriginalStates[quizID], fieldKey)
                ? adminOriginalStates[quizID][fieldKey]
                : getCurrentQuizFieldValue(quizID, fieldKey);
            updateLocalQuizField(quizID, fieldKey, !!originalValue);
        });
    });

    adminPendingChanges = {};
    adminOriginalStates = {};
    refreshBatchSaveBar();
}

async function saveBatchChanges() {
    if (adminBatchSaving || getPendingChangeCount() === 0) {
        return;
    }

    const confirmed = await window.showInAppConfirm(
        'Xác nhận lưu thay đổi lên hệ thống?',
        'Xác nhận lưu thay đổi'
    );

    if (!confirmed) {
        return;
    }

    const saveBtn = document.getElementById('batchSaveBtn');
    const cancelBtn = document.getElementById('batchCancelBtn');
    const originalSaveText = saveBtn ? saveBtn.textContent : '';
    const payload = cloneChangesMap(adminPendingChanges);

    adminBatchSaving = true;
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Đang lưu...';
    }
    if (cancelBtn) {
        cancelBtn.disabled = true;
    }

    try {
        const result = await APIClient.batchUpdateQuizSettings(payload);

        if (!result || !result.success) {
            prunePendingChangesByResult(result && result.failedUpdates);
            const serverMessage = (result && result.message) ? result.message : 'Không thể lưu thay đổi.';
            showToast(serverMessage, 'error');
        } else {
            adminPendingChanges = {};
            adminOriginalStates = {};
            showToast('Đã lưu thay đổi thành công!', 'success');
        }
    } catch (error) {
        console.error('Error saving batch changes:', error);
        showToast('Lỗi kết nối khi lưu thay đổi. Vui lòng thử lại.', 'error');
    } finally {
        adminBatchSaving = false;
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = originalSaveText || 'Lưu thay đổi';
        }
        if (cancelBtn) {
            cancelBtn.disabled = false;
        }
        refreshBatchSaveBar();
    }
}

function getAdminBulkState(quizzes, config) {
    const enabledCount = quizzes.reduce((count, quiz) => count + (config.getter(quiz) ? 1 : 0), 0);
    return {
        enabledCount,
        totalCount: quizzes.length,
        allEnabled: quizzes.length > 0 && enabledCount === quizzes.length,
        allDisabled: enabledCount === 0
    };
}

async function applyAdminBulkSetting(settingKey, desiredValue) {
    const currentSubject = adminSelectedSubject;
    const subjectQuizzes = getAdminSubjectQuizzes(currentSubject);
    const config = getBulkActionConfig().find((item) => item.key === settingKey);

    if (!config || subjectQuizzes.length === 0) {
        return;
    }

    const confirmationMessage = desiredValue
        ? `Bật ${config.label.toLowerCase()} cho ${subjectQuizzes.length} bài quiz của môn ${currentSubject}?`
        : `Tắt ${config.label.toLowerCase()} cho ${subjectQuizzes.length} bài quiz của môn ${currentSubject}?`;

    const confirmed = await window.showInAppConfirm(confirmationMessage, 'Xác nhận thao tác hàng loạt');

    if (!confirmed) {
        return;
    }

    const feedback = document.getElementById('adminBulkFeedback');
    if (feedback) {
        feedback.textContent = `Đang áp dụng thay đổi ${config.label.toLowerCase()} trên giao diện...`;
    }

    try {
        subjectQuizzes.forEach((quiz) => config.updater(quiz.quizID, desiredValue));

        if (feedback) {
            feedback.textContent = `Đã ${desiredValue ? 'bật' : 'tắt'} ${config.label.toLowerCase()} cho ${subjectQuizzes.length} bài quiz. Nhấn "Lưu thay đổi" để đồng bộ.`;
        }
    } catch (error) {
        console.error(`Bulk update failed (${settingKey}):`, error);
        if (feedback) {
            feedback.textContent = `Không thể cập nhật ${config.label.toLowerCase()}: ${error.message || 'Unknown error'}`;
        }
        if (typeof window.showInAppAlert === 'function') {
            await window.showInAppAlert(`Không thể cập nhật ${config.label.toLowerCase()}: ${error.message || 'Unknown error'}`);
        }
    }
}

function renderAdminSubjects(quizzes) {
    const container = document.getElementById('adminSubjectsList');
    if (!container) {
        return;
    }

    const subjectMap = new Map();

    (quizzes || []).forEach((quiz) => {
        const subject = getQuizSubject(quiz);
        subjectMap.set(subject, (subjectMap.get(subject) || 0) + 1);
    });

    const rawDashboardSubjects = sessionStorage.getItem('quizSubjectsCache');
    let dashboardSubjectOrder = [];

    if (rawDashboardSubjects) {
        try {
            dashboardSubjectOrder = JSON.parse(rawDashboardSubjects)
                .map((subject) => normalizeAdminSubject(subject))
                .filter((subject, index, arr) => subject && arr.indexOf(subject) === index);
        } catch (error) {
            dashboardSubjectOrder = [];
        }
    }

    const adminSubjectsByDataOrder = Array.from(subjectMap.keys());
    const mergedSubjectOrder = [];
    const seenSubjects = new Set();

    dashboardSubjectOrder.forEach((subject) => {
        if (subjectMap.has(subject) && !seenSubjects.has(subject)) {
            mergedSubjectOrder.push(subject);
            seenSubjects.add(subject);
        }
    });

    adminSubjectsByDataOrder.forEach((subject) => {
        if (!seenSubjects.has(subject)) {
            mergedSubjectOrder.push(subject);
            seenSubjects.add(subject);
        }
    });

    adminSubjects = mergedSubjectOrder;

    if (adminSelectedSubject && !adminSubjects.includes(adminSelectedSubject)) {
        adminSelectedSubject = '';
    }

    if (adminSelectedSubject) {
        sessionStorage.setItem('adminSelectedSubject', adminSelectedSubject);
    } else {
        sessionStorage.removeItem('adminSelectedSubject');
    }

    container.replaceChildren();

    if (adminSubjects.length === 0) {
        container.replaceChildren();
        container.insertAdjacentHTML('beforeend', '<div class="admin-management-empty">Không có môn nào để quản lý.</div>');
        return;
    }

    adminSubjects.forEach((subject) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'subject-pill';
        button.dataset.subject = subject;
        button.classList.toggle('is-active', subject === adminSelectedSubject);
        button.replaceChildren();
        button.insertAdjacentHTML('beforeend', `${escapeHtml(subject)}<small>${subjectMap.get(subject)} bài quiz</small>`);
        button.addEventListener('click', () => selectAdminSubject(subject));
        container.appendChild(button);
    });

    syncAdminSubjectPickerUI();
}

function isAdminMobileSubjectPicker() {
    return window.matchMedia && window.matchMedia('(max-width: 760px)').matches;
}

function syncAdminSubjectPickerUI() {
    const panel = document.querySelector('.admin-subject-panel');
    const button = document.getElementById('adminSubjectPickerBtn');
    const text = document.getElementById('adminSubjectPickerText');

    if (!panel || !button || !text) {
        return;
    }

    const isMobile = isAdminMobileSubjectPicker();
    const hasSelectedSubject = Boolean(adminSelectedSubject);

    if (!isMobile) {
        panel.classList.remove('is-open');
        button.setAttribute('aria-expanded', 'false');
        text.textContent = hasSelectedSubject ? adminSelectedSubject : 'Chọn môn học';
        return;
    }

    text.textContent = hasSelectedSubject ? adminSelectedSubject : 'Chọn môn học';
    button.setAttribute('aria-expanded', panel.classList.contains('is-open') ? 'true' : 'false');
}

function toggleAdminSubjectDropdown() {
    const panel = document.querySelector('.admin-subject-panel');
    if (!panel || !isAdminMobileSubjectPicker()) {
        return;
    }

    panel.classList.toggle('is-open');
    syncAdminSubjectPickerUI();
}

function closeAdminSubjectDropdown() {
    const panel = document.querySelector('.admin-subject-panel');
    if (!panel) {
        return;
    }

    panel.classList.remove('is-open');
    syncAdminSubjectPickerUI();
}

function selectAdminSubject(subject) {
    adminSelectedSubject = normalizeAdminSubject(subject);
    sessionStorage.setItem('adminSelectedSubject', adminSelectedSubject);
    if (isAdminMobileSubjectPicker()) {
        closeAdminSubjectDropdown();
    } else {
        syncAdminSubjectPickerUI();
    }
    renderAdminViewForSelectedSubject();

}

function updateAdminSubjectSelectionUI() {
    document.querySelectorAll('#adminSubjectsList .subject-pill').forEach((button) => {
        button.classList.toggle('is-active', normalizeAdminSubject(button.dataset.subject) === adminSelectedSubject);
    });

    syncAdminSubjectPickerUI();
}

function renderBulkActions(subject, quizzes) {
    const container = document.getElementById('adminBulkActions');
    if (!container) {
        return;
    }

    container.replaceChildren();

    if (!subject) {
        container.replaceChildren();
        container.insertAdjacentHTML('beforeend', '<div class="admin-management-empty">Chọn một môn để dùng thao tác hàng loạt.</div>');
        return;
    }

    if (!quizzes || quizzes.length === 0) {
        container.replaceChildren();
        container.insertAdjacentHTML('beforeend', '<div class="admin-management-empty">Môn này chưa có quiz.</div>');
        return;
    }

    getBulkActionConfig().forEach((config) => {
        const state = getAdminBulkState(quizzes, config);
        const card = document.createElement('div');
        card.className = 'bulk-action-card';
        card.insertAdjacentHTML('beforeend', `
                    <div>
                        <strong>${config.label}</strong>
                        <span>${state.enabledCount}/${state.totalCount} bài quiz đang bật</span>
                    </div>
                    <div class="bulk-action-buttons">
                        <button type="button" class="bulk-action-btn primary" onclick="applyAdminBulkSetting('${config.key}', true)">Bật tất cả</button>
                        <button type="button" class="bulk-action-btn danger" onclick="applyAdminBulkSetting('${config.key}', false)">Tắt tất cả</button>
                    </div>
                `);
        container.appendChild(card);
    });

    const feedback = document.createElement('div');
    feedback.id = 'adminBulkFeedback';
    feedback.className = 'feedback';
    feedback.style.marginTop = '0.2rem';
    container.appendChild(feedback);
}

function syncAdminBulkToggleUI(subject, hasQuizzes) {
    const button = document.getElementById('adminBulkToggleBtn');
    const container = document.getElementById('adminBulkActions');
    if (!button || !container) {
        return;
    }

    const canToggle = Boolean(subject && hasQuizzes);
    if (!canToggle) {
        adminBulkActionsVisible = false;
    }

    button.disabled = !canToggle;
    container.classList.toggle('is-collapsed', !adminBulkActionsVisible || !canToggle);
    button.textContent = adminBulkActionsVisible && canToggle
        ? 'Ẩn bật/tắt chức năng hàng loạt'
        : 'Hiện bật/tắt chức năng hàng loạt';
}

function toggleAdminBulkActions() {
    adminBulkActionsVisible = !adminBulkActionsVisible;
    const selectedSubject = adminSelectedSubject || '';
    const quizzes = selectedSubject ? getAdminSubjectQuizzes(selectedSubject) : [];
    syncAdminBulkToggleUI(selectedSubject, quizzes.length > 0);
}

function renderAdminViewForSelectedSubject() {
    const selectedSubject = adminSelectedSubject || '';
    const quizzes = selectedSubject ? getAdminSubjectQuizzes(selectedSubject) : [];
    const titleEl = document.getElementById('adminSubjectTitle');
    const metaEl = document.getElementById('adminSubjectMeta');
    const countEl = document.getElementById('adminSubjectCount');

    if (titleEl) {
        titleEl.textContent = selectedSubject ? `Danh Sách Bài Quiz - ${selectedSubject}` : 'Danh Sách Bài Quiz';
    }

    if (metaEl) {
        metaEl.textContent = selectedSubject
            ? 'Chọn các nút bên dưới để bật/tắt hàng loạt cho toàn bộ quiz của môn này.'
            : 'Chưa chọn môn.';
    }

    if (countEl) {
        countEl.textContent = `${quizzes.length} bài quiz`;
    }

    renderBulkActions(selectedSubject, quizzes);
    syncAdminBulkToggleUI(selectedSubject, quizzes.length > 0);
    renderQuizManagement(quizzes, selectedSubject);
    renderChartForSubject(selectedSubject, quizzes);
    updateAdminSubjectSelectionUI();
    syncAdminSubjectPickerUI();
}

function renderFunctionView() {
    const container = document.getElementById('globalFunctionActions');
    const scopeInfo = document.getElementById('functionScopeInfo');

    if (!container) {
        return;
    }

    const allQuizzes = Array.isArray(adminQuizzesData) ? adminQuizzesData : [];
    const enabledCount = allQuizzes.reduce((count, quiz) => count + (isEnabled(quiz.status, false) ? 1 : 0), 0);
    const disabledCount = allQuizzes.length - enabledCount;

    if (scopeInfo) {
        scopeInfo.textContent = `${allQuizzes.length} bài quiz`;
    }

    if (allQuizzes.length === 0) {
        container.replaceChildren();
        container.insertAdjacentHTML('beforeend', '<div class="admin-management-empty">Chưa có quiz nào để quản lý.</div>');
        return;
    }

    const configCards = getBulkActionConfig().map((config) => {
        const state = getAdminBulkState(allQuizzes, config);
        return `
                    <div class="bulk-action-card">
                        <div>
                            <strong>${config.label}</strong>
                            <span>${state.enabledCount}/${state.totalCount} bài quiz đang bật</span>
                        </div>
                        <div class="bulk-action-buttons">
                            <button type="button" class="bulk-action-btn primary" onclick="applyGlobalFunctionSetting('${config.key}', true)">Bật tất cả</button>
                            <button type="button" class="bulk-action-btn danger" onclick="applyGlobalFunctionSetting('${config.key}', false)">Tắt tất cả</button>
                        </div>
                    </div>
                `;
    }).join('');

    container.replaceChildren();
    container.insertAdjacentHTML('beforeend', `
                ${configCards}
                <div id="globalFunctionFeedback" class="feedback" style="grid-column: 1 / -1;"></div>
            `);
}

function applyGlobalFunctionSetting(settingKey, desiredValue) {
    stageGlobalQuizFieldChange(settingKey, desiredValue);
}

function applyGlobalQuizStatus(desiredValue) {
    stageGlobalQuizFieldChange('status', desiredValue);
}

function renderChartForSubject(subject, quizzes) {
    if (adminView !== 'manage') {
        return;
    }

    const chartSource = subject && quizzes && quizzes.length > 0 ? quizzes : adminQuizzesData;
    drawAttemptChart(chartSource, subject);
}

function renderAdminChartView() {
    const selectedSubject = adminSelectedSubject || '';
    const scopedQuizzes = selectedSubject ? getAdminSubjectQuizzes(selectedSubject) : [];
    const chartSource = selectedSubject && scopedQuizzes.length > 0 ? scopedQuizzes : adminQuizzesData;
    const scopeInfoEl = document.getElementById('chartScopeInfo');

    if (scopeInfoEl) {
        scopeInfoEl.textContent = selectedSubject
            ? `Môn hiện tại: ${selectedSubject} (Bar: Lượt làm | Line: Số câu hỏi)`
            : 'Môn hiện tại: Tất cả môn (Bar: Lượt làm | Line: Số câu hỏi)';
    }

    drawAttemptChart(chartSource, selectedSubject);
}

async function initAdmin() {
    // Kiểm tra quyền Admin
    const token = AuthManager.getToken();
    const role = AuthManager.getRole();

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    if (role !== 'Admin') {
        window.location.href = 'dashboard.html';
        return;
    }

    const currentUsername = AuthManager.getUsername() || '';
    const sidebarUserName = document.getElementById('sidebarUserName');
    const sidebarAvatar = document.getElementById('sidebarAvatar');
    if (sidebarUserName) {
        const fullName = localStorage.getItem('quizFullName') || '';
        const displayName = fullName || currentUsername || 'Admin';
        sidebarUserName.textContent = displayName;
        if (sidebarAvatar) {
            sidebarAvatar.textContent = displayName.charAt(0).toUpperCase();
        }
    }

    if (adminPinVerified && adminPinVerifiedFor === currentUsername && adminPinProof) {
        loadAdminData();
        return;
    }

    await requestAdminPin();
}

function openAdminPinOverlay() {
    const overlay = document.getElementById('adminPinOverlay');
    const input = document.getElementById('adminPinInput');
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    setTimeout(() => input.focus(), 0);
}

function closeAdminPinOverlay() {
    const overlay = document.getElementById('adminPinOverlay');
    const input = document.getElementById('adminPinInput');
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    input.value = '';
}

async function requestAdminPin() {
    const form = document.getElementById('adminPinForm');
    const input = document.getElementById('adminPinInput');
    const cancelBtn = document.getElementById('adminPinCancelBtn');

    openAdminPinOverlay();

    cancelBtn.onclick = () => {
        AuthManager.clearAuth();
        sessionStorage.removeItem('adminPinVerified');
        sessionStorage.removeItem('adminPinVerifiedFor');
        window.location.href = 'login.html';
    };

    form.onsubmit = async (event) => {
        event.preventDefault();

        try {
            const pinValue = String(input.value || '').trim();
            const pinHash = await sha256(pinValue);

            // Show loading
            const loadingOverlay = document.getElementById('loadingOverlay');
            const loadingText = document.getElementById('loadingText');
            if (loadingOverlay) {
                loadingText.textContent = 'Đang xác thực PIN...';
                loadingOverlay.classList.add('is-visible');
                loadingOverlay.setAttribute('aria-hidden', 'false');
            }

            const result = await APIClient.request('verifyAdminPin', { pinHash });

            // Hide loading
            if (loadingOverlay) {
                loadingOverlay.classList.remove('is-visible');
                loadingOverlay.setAttribute('aria-hidden', 'true');
            }

            if (result && result.success) {
                adminPinVerified = true;
                adminPinVerifiedFor = AuthManager.getUsername() || '';
                adminPinProof = result.adminPinProof || '';
                sessionStorage.setItem('adminPinVerified', 'true');
                sessionStorage.setItem('adminPinVerifiedFor', adminPinVerifiedFor);
                sessionStorage.setItem('adminPinProof', adminPinProof);
                closeAdminPinOverlay();
                loadAdminData();
                return;
            }

            adminPinVerified = false;
            adminPinVerifiedFor = '';
            adminPinProof = '';
            AuthManager.clearAuth();
            sessionStorage.removeItem('adminPinVerified');
            sessionStorage.removeItem('adminPinVerifiedFor');
            sessionStorage.removeItem('adminPinProof');
            window.location.href = 'login.html';
        } catch (error) {
            // Hide loading
            const loadingOverlay = document.getElementById('loadingOverlay');
            if (loadingOverlay) {
                loadingOverlay.classList.remove('is-visible');
                loadingOverlay.setAttribute('aria-hidden', 'true');
            }

            console.error('Admin PIN verification error:', error);
            adminPinVerified = false;
            adminPinVerifiedFor = '';
            adminPinProof = '';
            AuthManager.clearAuth();
            sessionStorage.removeItem('adminPinVerified');
            sessionStorage.removeItem('adminPinVerifiedFor');
            sessionStorage.removeItem('adminPinProof');
            window.location.href = 'login.html';
        }
    };

    input.onkeydown = (event) => {
        if (event.key !== 'Enter') {
            return;
        }

        event.preventDefault();
        if (typeof form.requestSubmit === 'function') {
            form.requestSubmit();
        } else {
            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
    };
}

function toggleSidebar() {
    if (window.innerWidth <= 900) {
        document.querySelector('.admin-sidebar').classList.toggle('is-open');
    } else {
        document.querySelector('.admin-dashboard-layout').classList.toggle('sidebar-closed');
    }
}

function switchAdminView(view) {
    if (window.innerWidth <= 900) {
        document.querySelector('.admin-sidebar').classList.remove('is-open');
    }
    adminView = view;
    if (view !== 'manage') {
        closeAdminSubjectDropdown();
    }

    // Cập nhật class active cho sidebar link
    document.querySelectorAll('.sidebar-link').forEach((button) => {
        button.classList.toggle('is-active', button.getAttribute('data-view') === view);
        // Đổi Title
        if (button.getAttribute('data-view') === view) {
            const titleEl = document.getElementById('adminViewTitle');
            if (titleEl) {
                // Loại bỏ icon emoji ở đầu nếu có (tuỳ chọn)
                const rawText = button.textContent.trim();
                titleEl.textContent = rawText.substring(rawText.indexOf(' ') + 1);
            }
        }
    });

    // Toggle panels
    const panels = ['overviewPanel', 'managePanel', 'functionPanel', 'importPanel', 'chartPanel', 'referralPanel'];
    panels.forEach(p => {
        const el = document.getElementById(p);
        if (el) el.classList.toggle('is-hidden', p !== view + 'Panel');
    });

    // Đóng sidebar trên mobile sau khi click
    const sidebar = document.getElementById('adminSidebar');
    if (sidebar && sidebar.classList.contains('is-open')) {
        sidebar.classList.remove('is-open');
    }

    if (view === 'manage') {
        renderAdminViewForSelectedSubject();
    } else if (view === 'function') {
        renderFunctionView();
    } else if (view === 'chart') {
        renderAdminChartView();
    } else if (view === 'referral') {
        loadReferralCodes();
    }
}

function formatReferralDate(value) {
    if (!value) {
        return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString('vi-VN');
}

function renderReferralCodes() {
    const emptyState = document.getElementById('referralEmptyState');
    const tableWrap = document.getElementById('referralTableWrap');
    const body = document.getElementById('referralCodeBody');

    if (!emptyState || !tableWrap || !body) {
        return;
    }

    body.replaceChildren();

    if (!adminReferralCodes || adminReferralCodes.length === 0) {
        emptyState.textContent = 'Chưa có mã giới thiệu nào.';
        emptyState.style.display = 'block';
        tableWrap.style.display = 'none';
        return;
    }

    const activeItems = [];
    const usedItems = [];

    adminReferralCodes.forEach((item) => {
        const statusLower = String(item && item.status ? item.status : '').trim().toLowerCase();
        if (statusLower === 'used') {
            usedItems.push(item);
        } else {
            activeItems.push(item);
        }
    });

    const displayItems = activeItems.concat(usedItems);

    displayItems.forEach((item) => {
        const tr = document.createElement('tr');
        const statusRaw = String(item.status || '').trim();
        const statusLower = statusRaw.toLowerCase();
        const statusClass = statusLower === 'used' ? 'used' : 'active';

        tr.insertAdjacentHTML('beforeend', `
                    <td><strong>${escapeHtml(String(item.code || ''))}</strong></td>
                    <td><span class="referral-status ${statusClass}">${escapeHtml(statusRaw || 'Active')}</span></td>
                    <td>${escapeHtml(String(item.usedBy || '-'))}</td>
                    <td>${formatReferralDate(item.usedAt)}</td>
                `);

        body.appendChild(tr);
    });

    emptyState.style.display = 'none';
    tableWrap.style.display = 'block';
}

async function loadReferralCodes() {
    const feedback = document.getElementById('referralFeedback');
    const emptyState = document.getElementById('referralEmptyState');

    if (feedback) {
        feedback.textContent = '';
    }

    if (emptyState) {
        emptyState.textContent = 'Đang tải dữ liệu mã giới thiệu...';
        emptyState.style.display = 'block';
    }

    try {
        const result = await APIClient.getReferralCodes();
        if (!result || !result.success) {
            if (feedback) {
                feedback.textContent = (result && result.message) || 'Không thể tải danh sách mã.';
            }
            adminReferralCodes = [];
            renderReferralCodes();
            return;
        }

        adminReferralCodes = result.referralCodes || [];
        renderReferralCodes();
    } catch (error) {
        console.error('Load referral codes error:', error);
        if (feedback) {
            feedback.textContent = 'Lỗi kết nối khi tải danh sách mã.';
        }
        adminReferralCodes = [];
        renderReferralCodes();
    }
}

async function generateReferralCodes(count) {
    const feedback = document.getElementById('referralFeedback');
    const generateBtn = document.getElementById('generateReferralBtn');

    if (generateBtn) {
        generateBtn.disabled = true;
        generateBtn.textContent = 'Đang tạo mã...';
    }

    if (feedback) {
        feedback.textContent = '';
    }

    try {
        const result = await APIClient.generateReferralCodes(count || 10);
        if (!result || !result.success) {
            if (feedback) {
                feedback.textContent = (result && result.message) || 'Không thể tạo mã mới.';
            }
            return;
        }

        if (feedback) {
            feedback.textContent = result.message || 'Đã tạo mã giới thiệu mới.';
        }

        await loadReferralCodes();
    } catch (error) {
        console.error('Generate referral codes error:', error);
        if (feedback) {
            feedback.textContent = 'Lỗi kết nối khi tạo mã.';
        }
    } finally {
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.textContent = 'Tạo 10 mã ngẫu nhiên';
        }
    }
}

function ensureManageChart() {
    if (adminView !== 'manage') {
        return;
    }
    if (!adminQuizzesData || adminQuizzesData.length === 0) {
        return;
    }

    renderAdminViewForSelectedSubject();
}

function logoutAdmin() {
    AuthManager.clearAuth();
    sessionStorage.removeItem('adminPinVerified');
    sessionStorage.removeItem('adminPinVerifiedFor');
    sessionStorage.removeItem('adminPinProof');
    sessionStorage.removeItem('quizSubjectsCache');
    window.location.href = 'login.html';
}

function toggleAdminAccountMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    const menu = document.getElementById('adminAccountMenu');
    if (menu) {
        menu.classList.toggle('is-open');
    }
}

function closeAdminAccountMenu() {
    const menu = document.getElementById('adminAccountMenu');
    if (menu) {
        menu.classList.remove('is-open');
    }
}

function goToAccountInfo() {
    window.location.href = 'info.html';
}

function goToChangePassword() {
    window.location.href = 'password.html';
}

// Render Extended Stats
function renderExtendedStats(stats, quizzes) {
    if (!stats) return;

    // 1. Top Quizzes
    const topQuizzesContainer = document.getElementById('topQuizzesList');
    if (topQuizzesContainer) {
        topQuizzesContainer.replaceChildren();
        const sortedQuizzes = [...(quizzes || [])]
            .sort((a, b) => (b.attempts || 0) - (a.attempts || 0))
            .slice(0, 5);
        
        if (sortedQuizzes.length === 0) {
            topQuizzesContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">Chưa có dữ liệu bài thi.</div>';
        } else {
            sortedQuizzes.forEach(q => {
                topQuizzesContainer.insertAdjacentHTML('beforeend', `
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed color-mix(in srgb, var(--line) 50%, transparent); padding-bottom: 0.5rem;">
                        <div style="display: flex; flex-direction: column; gap: 0.2rem; overflow: hidden;">
                            <span style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.95rem;">${escapeHtml(q.title || q.quizID)}</span>
                            <span style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(q.subject || '')}</span>
                        </div>
                        <div style="text-align: right; font-weight: 700; color: var(--cyan); flex-shrink: 0; margin-left: 0.5rem;">
                            ${q.attempts} <span style="font-size: 0.75rem; font-weight: 400; color: var(--text-muted);">lượt</span>
                        </div>
                    </div>
                `);
            });
        }
    }

    // 2. Recent Activity
    const recentContainer = document.getElementById('recentActivityList');
    if (recentContainer && stats.recentActivity) {
        recentContainer.replaceChildren();
        if (stats.recentActivity.length === 0) {
            recentContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">Chưa có hoạt động nào.</div>';
        } else {
            stats.recentActivity.forEach(act => {
                recentContainer.insertAdjacentHTML('beforeend', `
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed color-mix(in srgb, var(--line) 50%, transparent); padding-bottom: 0.5rem;">
                        <div style="display: flex; flex-direction: column; gap: 0.2rem; overflow: hidden;">
                            <span style="font-weight: 600; font-size: 0.9rem;">${escapeHtml(act.username || '')}</span>
                            <span style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(act.quizID || '')}</span>
                        </div>
                        <div style="text-align: right; flex-shrink: 0; margin-left: 0.5rem;">
                            <div style="font-weight: 700; color: ${act.score >= 8 ? 'var(--green)' : (act.score < 5 ? 'var(--red)' : 'var(--violet)')};">${Number(act.score || 0).toFixed(1)}</div>
                            <div style="font-size: 0.7rem; color: var(--text-muted);">${act.timestamp ? new Date(act.timestamp).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) : ''}</div>
                        </div>
                    </div>
                `);
            });
        }
    }

    // 3. Problematic Questions
    const problematicContainer = document.getElementById('problematicQuestionsList');
    if (problematicContainer && stats.problematicQuestions) {
        problematicContainer.replaceChildren();
        if (stats.problematicQuestions.length === 0) {
            problematicContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">Không có câu hỏi nào tỷ lệ sai cao (>50% và >=3 lượt). Tuyệt vời!</div>';
        } else {
            stats.problematicQuestions.slice(0, 5).forEach(q => {
                const percent = Math.round((q.wrongRate || 0) * 100);
                problematicContainer.insertAdjacentHTML('beforeend', `
                    <div style="display: flex; flex-direction: column; gap: 0.4rem; border-bottom: 1px dashed color-mix(in srgb, var(--line) 50%, transparent); padding-bottom: 0.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <span style="font-weight: 600; font-size: 0.85rem; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${escapeHtml(q.questionText || '')}">
                                ${escapeHtml(q.questionText || q.questionID)}
                            </span>
                            <span style="font-weight: 700; color: var(--red); font-size: 0.85rem; flex-shrink: 0; margin-left: 0.5rem;">
                                ${percent}% sai
                            </span>
                        </div>
                        <div style="font-size: 0.7rem; color: var(--text-muted);">
                            Quiz: ${escapeHtml(q.quizID || '')} • ${q.wrong}/${q.attempts} lượt sai
                        </div>
                    </div>
                `);
            });
        }
    }

    // 4. Reported Questions
    const reportedContainer = document.getElementById('reportedQuestionsList');
    if (reportedContainer && stats.reportedQuestions) {
        reportedContainer.replaceChildren();
        if (stats.reportedQuestions.length === 0) {
            reportedContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">Không có báo cáo lỗi nào gần đây.</div>';
        } else {
            stats.reportedQuestions.slice(0, 5).forEach(q => {
                reportedContainer.insertAdjacentHTML('beforeend', `
                    <div style="display: flex; flex-direction: column; gap: 0.4rem; border-bottom: 1px dashed color-mix(in srgb, var(--line) 50%, transparent); padding-bottom: 0.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <span style="font-weight: 600; font-size: 0.85rem; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${escapeHtml(q.questionText || '')}">
                                ${escapeHtml(q.questionText || q.questionID)}
                            </span>
                            <span style="font-weight: 700; color: var(--yellow); font-size: 0.75rem; flex-shrink: 0; margin-left: 0.5rem; text-transform: uppercase;">
                                ${escapeHtml(q.errorType || 'Khác')}
                            </span>
                        </div>
                        <div style="font-size: 0.7rem; color: var(--text-muted);">
                            Quiz: ${escapeHtml(q.quizID || '')} • Báo bởi: ${escapeHtml(q.username || '')}
                        </div>
                        ${q.details ? `<div style="font-size: 0.75rem; color: var(--text-light); background: color-mix(in srgb, var(--surface-2) 50%, transparent); padding: 0.4rem; border-radius: 4px; margin-top: 0.2rem;">Chi tiết: ${escapeHtml(q.details)}</div>` : ''}
                    </div>
                `);
            });
        }
    }

    // 4. System & Users
    if (document.getElementById('newUsers7D')) {
        document.getElementById('newUsers7D').textContent = stats.totalUsers || 0;
    }
    if (document.getElementById('referralStatsInfo') && stats.referralStats) {
        document.getElementById('referralStatsInfo').textContent = `${stats.referralStats.active || 0} / ${stats.referralStats.used || 0}`;
    }
    
    // DB Health
    if (stats.dbHealth) {
        const total = stats.dbHealth.totalRows || 0;
        const limit = 5000000;
        const percent = Math.min(100, (total / limit) * 100);
        
        if (document.getElementById('dbHealthText')) {
            document.getElementById('dbHealthText').textContent = total.toLocaleString('vi-VN');
        }
        const fillEl = document.getElementById('dbHealthFill');
        if (fillEl) {
            fillEl.style.width = percent + '%';
            if (percent > 80) fillEl.style.background = 'var(--red)';
            else if (percent > 50) fillEl.style.background = 'var(--yellow)';
            else fillEl.style.background = 'var(--cyan)';
        }
    }
}

// Load dữ liệu Admin
async function loadAdminData(forceRefresh = false) {
    try {
        const result = await APIClient.getAdminData(forceRefresh);

        if (result.success) {
            // Cập nhật thống kê
            document.getElementById('totalQuizzes').textContent = result.stats.totalQuizzes;
            document.getElementById('totalAttempts').textContent = result.stats.totalAttempts;
            document.getElementById('activeUsers').textContent = result.stats.activeUsers;
            document.getElementById('avgScore').textContent =
                (result.stats.averageScore || 0).toFixed(2) + '/10';
            
            // Cập nhật thống kê mở rộng
            renderExtendedStats(result.stats, result.quizzes);

            adminQuizzesData = result.quizzes || [];
            renderAdminSubjects(adminQuizzesData);
            if (adminView === 'function') {
                renderFunctionView();
            } else {
                renderAdminViewForSelectedSubject();
            }

            if (adminView === 'chart') {
                renderAdminChartView();
            }

            syncAdminSubjectPickerUI();

            // Load danh sách quiz cho import
            loadQuizList(adminQuizzesData);
        } else if (String(result.message || '').toLowerCase().includes('unauthorized') || String(result.message || '').toLowerCase().includes('invalid token')) {
            AuthManager.clearAuth();
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error('Error loading admin data:', error);
    }
}

async function refreshAdminData(button) {
    const refreshBtn = button || document.getElementById('adminRefreshBtn');

    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.classList.add('is-loading');
        refreshBtn.setAttribute('aria-busy', 'true');
        refreshBtn.title = 'Đang tải lại dữ liệu...';
    }
    
    document.body.style.pointerEvents = 'none';
    document.body.style.opacity = '0.7';
    document.body.style.transition = 'opacity 0.2s';

    try {
        await loadAdminData(true);
    } finally {
        document.body.style.pointerEvents = '';
        document.body.style.opacity = '';
        
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.classList.remove('is-loading');
            refreshBtn.removeAttribute('aria-busy');
            refreshBtn.title = 'Tải lại dữ liệu từ sheet';
        }
    }
}

// Vẽ biểu đồ
function drawAttemptChart(quizzes, subjectLabel = '') {
    const ctx = document.getElementById('attemptChart').getContext('2d');

    const sorted = (quizzes || [])
        .slice()
        .sort((a, b) => (b.attempts || 0) - (a.attempts || 0))
        .slice(0, 12);

    const labels = sorted.map((q) => {
        const title = String(q.title || 'Quiz');
        return title.length > 26 ? `${title.slice(0, 26)}...` : title;
    });

    if (attemptChart) {
        attemptChart.destroy();
    }

    attemptChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'bar',
                    label: 'Số Lượt Làm',
                    data: sorted.map((q) => q.attempts || 0),
                    backgroundColor: 'rgba(34, 211, 238, 0.32)',
                    borderColor: 'rgba(34, 211, 238, 1)',
                    borderWidth: 1
                },
                {
                    type: 'line',
                    label: 'Số Câu Hỏi',
                    data: sorted.map((q) => q.questionCount || 0),
                    borderColor: 'rgba(167, 139, 250, 1)',
                    backgroundColor: 'rgba(167, 139, 250, 0.22)',
                    yAxisID: 'y1',
                    tension: 0.35,
                    pointRadius: 3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: !!subjectLabel,
                    text: subjectLabel ? `Biểu đồ môn ${subjectLabel}` : ''
                },
                legend: {
                    labels: {
                        color: '#94a3b8'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        color: 'rgba(148, 163, 184, 0.18)'
                    }
                },
                y1: {
                    beginAtZero: true,
                    position: 'right',
                    grid: {
                        drawOnChartArea: false
                    },
                    ticks: {
                        color: '#94a3b8'
                    }
                },
                x: {
                    ticks: {
                        color: '#94a3b8'
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Render quản lý bài thi
function renderQuizManagement(quizzes, subject) {
    const container = document.getElementById('quizManagement');
    container.replaceChildren();

    if (!subject) {
        container.replaceChildren();
        container.insertAdjacentHTML('beforeend', '<div class="admin-management-empty">Chọn một môn ở cột bên trái để xem danh sách quiz.</div>');
        return;
    }

    if (!quizzes || quizzes.length === 0) {
        container.replaceChildren();
        container.insertAdjacentHTML('beforeend', '<div class="admin-management-empty">Môn này chưa có quiz.</div>');
        return;
    }

    quizzes.forEach((quiz) => {

        const practiceModes = getQuizPracticeModes(quiz);
        const autoNextEnabled = isEnabled(quiz.autoNext, false);
        const allowBackEnabled = isEnabled(quiz.allowBack, true);
        const rawQuizID = String(quiz.quizID || '');
        const encodedQuizID = encodeURIComponent(rawQuizID);
        const safeSubject = escapeHtml(String(subject || ''));
        const safeQuizID = escapeHtml(rawQuizID);
        const safeTitle = escapeHtml(String(quiz.title || ''));
        const safeDescription = escapeHtml(String(quiz.description || 'Không có mô tả.'));
        const card = document.createElement('div');
        card.className = 'quiz-manage-card';
        card.insertAdjacentHTML('beforeend', `
                    <div class="quiz-headline">
                        <div class="quiz-meta">${safeQuizID} • ${safeSubject}</div>
                        <h4 class="quiz-title">${safeTitle}</h4>
                    </div>
                    <p class="quiz-desc">${safeDescription}</p>

                    <div class="quiz-insight-row">
                        <div class="quiz-insight"><strong>Số câu hỏi</strong>${quiz.questionCount || 0}</div>
                        <div class="quiz-insight"><strong>Lượt làm</strong>${quiz.attempts || 0}</div>
                    </div>

                    <div class="toggle-grid">
                        <label class="toggle-label">
                            <span>Kích Hoạt Bài Thi</span>
                            <input type="checkbox" class="toggle-switch" 
                                ${isEnabled(quiz.status) ? 'checked' : ''}
                                onchange="updateQuizStatus(decodeURIComponent('${encodedQuizID}'), this.checked, this)">
                            <span class="toggle-slider"></span>
                        </label>

                        <label class="toggle-label">
                            <span>Chế Độ Luyện Tập</span>
                            <input type="checkbox" class="toggle-switch" 
                                ${practiceModes.showAnswer ? 'checked' : ''}
                                onchange="updateShowAnswer(decodeURIComponent('${encodedQuizID}'), this.checked, this)">
                            <span class="toggle-slider"></span>
                        </label>

                        <label class="toggle-label">
                            <span>Hiển thị đáp án đúng khi sai</span>
                            <input type="checkbox" class="toggle-switch" 
                                ${practiceModes.revealCorrectOnWrong ? 'checked' : ''}
                                onchange="updateRevealCorrectOnWrong(decodeURIComponent('${encodedQuizID}'), this.checked, this)">
                            <span class="toggle-slider"></span>
                        </label>

                        <label class="toggle-label">
                            <span>Hiển thị chi tiết kết quả</span>
                            <input type="checkbox" class="toggle-switch" 
                                ${isEnabled(quiz.showDetailedResult, true) ? 'checked' : ''}
                                onchange="updateShowDetailedResult(decodeURIComponent('${encodedQuizID}'), this.checked, this)">
                            <span class="toggle-slider"></span>
                        </label>

                        <label class="toggle-label">
                            <span>Đảo Câu / Đáp Án</span>
                            <input type="checkbox" class="toggle-switch" 
                                ${isEnabled(quiz.shuffle) ? 'checked' : ''}
                                onchange="updateShuffle(decodeURIComponent('${encodedQuizID}'), this.checked, this)">
                            <span class="toggle-slider"></span>
                        </label>

                        <label class="toggle-label">
                            <span>Anti-Cheat (Chuyển Tab)</span>
                            <input type="checkbox" class="toggle-switch" 
                                ${isEnabled(quiz.antiCheatTabSwitch, false) ? 'checked' : ''}
                                onchange="updateAntiCheatTabSwitch(decodeURIComponent('${encodedQuizID}'), this.checked, this)">
                            <span class="toggle-slider"></span>
                        </label>

                        <label class="toggle-label">
                            <span>Anti-Cheat (Toàn Màn Hình)</span>
                            <input type="checkbox" class="toggle-switch" 
                                ${isEnabled(quiz.antiCheatFullscreen, false) ? 'checked' : ''}
                                onchange="updateAntiCheatFullscreen(decodeURIComponent('${encodedQuizID}'), this.checked, this)">
                            <span class="toggle-slider"></span>
                        </label>
                        
                        <label class="toggle-label">
                            <span>Tự động chuyển câu</span>
                            <input type="checkbox" class="toggle-switch" 
                                ${autoNextEnabled ? 'checked' : ''}
                                onchange="updateAutoNext(decodeURIComponent('${encodedQuizID}'), this.checked, this)">
                            <span class="toggle-slider"></span>
                        </label>

                        <label class="toggle-label">
                            <span>Cho phép quay lại câu trước</span>
                            <input type="checkbox" class="toggle-switch" 
                                ${allowBackEnabled ? 'checked' : ''}
                                onchange="updateAllowBack(decodeURIComponent('${encodedQuizID}'), this.checked, this)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                `);

        container.appendChild(card);
    });
}

// Load danh sách quiz
function loadQuizList(quizzes) {
    const select = document.getElementById('quizIDImport');
    select.replaceChildren();
    select.insertAdjacentHTML('beforeend', '<option value="">-- Chọn bài quiz --</option>');
    quizzes.forEach(quiz => {
        const option = document.createElement('option');
        option.value = quiz.quizID;
        option.textContent = `[${quiz.quizID}] ${quiz.title} (${quiz.subject || 'N/A'})`;
        select.appendChild(option);
    });
}

async function loadAikenFile(inputEl) {
    const feedback = document.getElementById('aikenFileInfo');
    const textarea = document.getElementById('aikenContent');
    const file = inputEl && inputEl.files ? inputEl.files[0] : null;

    if (!file) {
        if (feedback) {
            feedback.textContent = 'Chưa tải file nào.';
        }
        return;
    }

    try {
        const content = await file.text();
        textarea.value = content;
        if (feedback) {
            feedback.textContent = `Đã nạp ${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB) vào ô nội dung.`;
        }
    } catch (error) {
        console.error('Error loading Aiken file:', error);
        if (feedback) {
            feedback.textContent = 'Không thể đọc file TXT này.';
        }
    }
}

async function applyQuizStatusChange(quizID, isActive) {
    const result = await APIClient.updateQuizStatus(quizID, !!isActive);
    if (!result || !result.success) {
        throw new Error((result && result.message) || 'Cập nhật trạng thái thất bại');
    }
    return result;
}

async function applyShowAnswerChange(quizID, showAnswer) {
    const result = await APIClient.updateShowAnswer(quizID, !!showAnswer);
    if (!result || !result.success) {
        throw new Error((result && result.message) || 'Cập nhật show answer thất bại');
    }
    return result;
}

async function applyShuffleChange(quizID, shuffle) {
    const result = await APIClient.updateShuffle(quizID, !!shuffle);
    if (!result || !result.success) {
        throw new Error((result && result.message) || 'Cập nhật shuffle thất bại');
    }
    return result;
}

async function applyAutoNextChange(quizID, autoNext) {
    const result = await APIClient.updateAutoNext(quizID, autoNext);
    if (!result || !result.success) {
        throw new Error((result && result.message) || 'Cập nhật Auto-next thất bại');
    }
    return result;
}

async function applyAllowBackChange(quizID, allowBack) {
    const result = await APIClient.updateAllowBack(quizID, allowBack);
    if (!result || !result.success) {
        throw new Error((result && result.message) || 'Cập nhật Allow-back thất bại');
    }
    return result;
}

// Cập nhật trạng thái bài thi (chỉ cập nhật local, lưu theo lô khi bấm nút)
function updateQuizStatus(quizID, isActive, toggleEl) {
    if (adminBatchSaving || isAdminToggleBusy(quizID, 'status')) {
        if (toggleEl) {
            toggleEl.checked = !isActive;
        }
        return;
    }

    stageQuizFieldChange(quizID, 'status', isActive);
}

// Cập nhật chế độ Show Answer (chỉ cập nhật local, lưu theo lô khi bấm nút)
function updateShowAnswer(quizID, showAnswer, toggleEl) {
    if (adminBatchSaving || isAdminToggleBusy(quizID, 'showAnswer')) {
        if (toggleEl) {
            toggleEl.checked = !showAnswer;
        }
        return;
    }

    stageQuizFieldChange(quizID, 'showAnswer', showAnswer);
}

// Cập nhật chế độ Hiển thị đáp án đúng khi chọn sai (chỉ cập nhật local, lưu theo lô khi bấm nút)
function updateRevealCorrectOnWrong(quizID, revealCorrectOnWrong, toggleEl) {
    if (adminBatchSaving || isAdminToggleBusy(quizID, 'revealCorrectOnWrong')) {
        if (toggleEl) {
            toggleEl.checked = !revealCorrectOnWrong;
        }
        return;
    }

    stageQuizFieldChange(quizID, 'revealCorrectOnWrong', revealCorrectOnWrong);
}

// Cập nhật đảo câu / đáp án (chỉ cập nhật local, lưu theo lô khi bấm nút)
function updateShuffle(quizID, shuffle, toggleEl) {
    if (adminBatchSaving || isAdminToggleBusy(quizID, 'shuffle')) {
        if (toggleEl) {
            toggleEl.checked = !shuffle;
        }
        return;
    }

    stageQuizFieldChange(quizID, 'shuffle', shuffle);
}

function updateShowDetailedResult(quizID, showDetailedResult, toggleEl) {
    if (adminBatchSaving || isAdminToggleBusy(quizID, 'showDetailedResult')) {
        if (toggleEl) {
            toggleEl.checked = !showDetailedResult;
        }
        return;
    }

    stageQuizFieldChange(quizID, 'showDetailedResult', showDetailedResult);
}



function updateAutoNext(quizID, autoNext, toggleEl) {
    if (adminBatchSaving || isAdminToggleBusy(quizID, 'autoNext')) {
        if (toggleEl) {
            toggleEl.checked = !autoNext;
        }
        return;
    }

    stageQuizFieldChange(quizID, 'autoNext', autoNext);
}

function updateAllowBack(quizID, allowBack, toggleEl) {
    if (adminBatchSaving || isAdminToggleBusy(quizID, 'allowBack')) {
        if (toggleEl) {
            toggleEl.checked = !allowBack;
        }
        return;
    }

    stageQuizFieldChange(quizID, 'allowBack', allowBack);
}

// Import Aiken Format
async function importAiken() {
    const quizID = document.getElementById('quizIDImport').value;
    const content = document.getElementById('aikenContent').value;
    const feedback = document.getElementById('importFeedback');

    if (!quizID) {
        feedback.className = 'feedback incorrect';
        feedback.textContent = '❌ Vui lòng chọn bài quiz!';
        return;
    }

    if (!content.trim()) {
        feedback.className = 'feedback incorrect';
        feedback.textContent = '❌ Vui lòng nhập nội dung Aiken!';
        return;
    }

    // Parse Aiken format
    const questions = parseAikenFormat(content);

    if (questions.length === 0) {
        feedback.className = 'feedback incorrect';
        feedback.textContent = '❌ Không tìm thấy câu hỏi hợp lệ!';
        return;
    }

    const proceedImport = await window.showInAppConfirm(
        `Bạn sắp nhập ${questions.length} câu hỏi vào quiz ${quizID}. Xác nhận tiếp tục?`,
        'Xác nhận import'
    );

    if (!proceedImport) {
        return;
    }

    try {
        const result = await APIClient.bulkUpload(quizID, questions);

        if (result.success) {
            feedback.className = 'feedback correct';
            feedback.textContent = `✓ Đã nhập ${questions.length} câu hỏi thành công!`;
            document.getElementById('aikenContent').value = '';
            setTimeout(() => loadAdminData(), 1000);
        } else {
            feedback.className = 'feedback incorrect';
            feedback.textContent = '❌ Lỗi nhập liệu: ' + result.message;
        }
    } catch (error) {
        console.error('Error uploading questions:', error);
        feedback.className = 'feedback incorrect';
        feedback.textContent = '❌ Lỗi kết nối!';
    }
}

// Parse định dạng Aiken
function parseAikenFormat(content) {
    return AikenParser.parse(content || '');
}

window.addEventListener('beforeunload', (event) => {
    if (getPendingChangeCount() <= 0) {
        return;
    }
    event.preventDefault();
    event.returnValue = '';
});

document.addEventListener('click', (event) => {
    if (getPendingChangeCount() <= 0) {
        return;
    }
    const target = event.target.closest('a[href]');
    if (target && !target.getAttribute('href').startsWith('#')) {
        event.preventDefault();
        pendingNavigationEvent = { href: target.getAttribute('href') };
        openUnsavedWarning();
    }
}, true);

document.addEventListener('click', (event) => {
    const panel = document.querySelector('.admin-subject-panel');
    if (!panel || !panel.classList.contains('is-open')) {
        return;
    }

    if (event.target.closest('.admin-subject-panel')) {
        return;
    }

    closeAdminSubjectDropdown();
});

document.addEventListener('click', (event) => {
    const menu = document.getElementById('adminAccountMenu');
    if (!menu) {
        return;
    }

    if (event.target.closest('#adminAccountMenu')) {
        return;
    }

    closeAdminAccountMenu();
});

window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeAdminStatsModal();
        closeAdminSubjectDropdown();
        closeAdminAccountMenu();
    }
});

window.addEventListener('resize', () => {
    syncAdminSubjectPickerUI();
});

document.querySelector('.admin-content-area').addEventListener('scroll', updateBackToTopButton, { passive: true });

// Khởi chạy
updateBackToTopButton();
initAdmin();