
// ==================== AUTHENTICATION ====================

function handleLogin(data) {
    const sheetsRef = getSheetsRef_();
    const username = String(data.username || '').trim();
    const passwordHash = String(data.passwordHash || '').trim();
    const passwordHashLegacy = String(data.passwordHashLegacy || '').trim();

    if (!username || !passwordHash) {
        return JsonResponse({
            success: false,
            message: 'Thiếu tên đăng nhập hoặc mật khẩu'
        });
    }

    if (isRateLimited_('login', username)) {
        const state = getRateLimitState_('login', username);
        return JsonResponse({
            success: false,
            message: 'Thông tin đăng nhập không hợp lệ hoặc tạm thời bị khóa. Vui lòng thử lại sau.',
            blockedUntil: state.blockedUntil
        });
    }

    const userSchema = getUsersSchema_(sheetsRef.users);

    // Tìm user trong sheet
    const usersData = sheetsRef.users.getDataRange().getValues();
    for (let i = 1; i < usersData.length; i++) {
        const rowUsername = String(usersData[i][userSchema.username] || '').trim();
        const rowPasswordHash = String(usersData[i][userSchema.passwordHash] || '').trim();

        if (rowUsername.toLowerCase() !== username.toLowerCase()) {
            continue;
        }

        const verifyResult = verifyStoredPasswordHash_(rowPasswordHash, passwordHash, passwordHashLegacy);
        if (verifyResult.valid) {
            const role = String(usersData[i][userSchema.role] || 'User').trim() || 'User';
            const fullName = String(usersData[i][userSchema.fullName] || '').trim();
            const actualUsername = rowUsername;

            if (verifyResult.migrateToSalted) {
                sheetsRef.users.getRange(i + 1, userSchema.passwordHash + 1).setValue(passwordHash);
            }

            clearRateLimitFailures_('login', username);
            
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

    registerRateLimitFailure_('login', username);

    return JsonResponse({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không đúng'
    });
}


function handleRegisterUser(data) {
    const sheetsRef = getSheetsRef_();
    const usersSheet = sheetsRef.users;
    const referralSheet = sheetsRef.referralCodes;

    if (!usersSheet) {
        return JsonResponse({ success: false, message: 'Sheet Users không tồn tại' });
    }

    if (!referralSheet) {
        return JsonResponse({ success: false, message: 'Sheet ReferralCodes không tồn tại' });
    }

    const fullName = String(data.fullName || '').trim();
    const username = String(data.username || '').trim();
    const password = String(data.password || '');
    const passwordHashInput = String(data.passwordHash || '').trim();
    const referralCodeInput = String(data.referralCode || '').trim();

    if (!fullName || !username || (!password && !passwordHashInput) || !referralCodeInput) {
        return JsonResponse({ success: false, message: 'Vui lòng nhập đầy đủ thông tin' });
    }

    if (username.length < 4 || username.length > 30) {
        return JsonResponse({ success: false, message: 'Username phải từ 4 đến 30 ký tự' });
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
        return JsonResponse({ success: false, message: 'Username chỉ được chứa chữ, số, dấu chấm, gạch dưới, gạch ngang' });
    }

    if (password && password.length < 6) {
        return JsonResponse({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) {
        return JsonResponse({ success: false, message: 'Hệ thống đang bận, vui lòng thử lại sau ít phút' });
    }

    try {
        const usersData = usersSheet.getDataRange().getValues();
        const userSchema = getUsersSchema_(usersSheet);

        for (let i = 1; i < usersData.length; i++) {
            const existingUsername = String(usersData[i][userSchema.username] || '').trim();
            if (existingUsername && existingUsername.toLowerCase() === username.toLowerCase()) {
                return JsonResponse({ success: false, message: 'Tên đăng nhập đã tồn tại' });
            }
        }

        const referralData = referralSheet.getDataRange().getValues();
        if (!referralData || referralData.length < 2) {
            return JsonResponse({ success: false, message: 'Không có mã giới thiệu khả dụng' });
        }

        const referralSchema = getReferralCodesSchema_(referralSheet);
        const normalizedCode = referralCodeInput.toUpperCase();
        let referralRowIndex = -1;

        for (let i = 1; i < referralData.length; i++) {
            const codeValue = String(referralData[i][referralSchema.code] || '').trim().toUpperCase();
            if (codeValue === normalizedCode) {
                referralRowIndex = i;
                break;
            }
        }

        if (referralRowIndex < 1) {
            return JsonResponse({ success: false, message: 'Mã giới thiệu không hợp lệ' });
        }

        const referralStatus = String(referralData[referralRowIndex][referralSchema.status] || '').trim().toLowerCase();
        if (referralStatus !== 'active') {
            return JsonResponse({ success: false, message: 'Mã giới thiệu đã được sử dụng hoặc bị vô hiệu hóa' });
        }

        const now = new Date();
        const passwordHash = passwordHashInput || hashPasswordWithSalt_(password);
        const safeUsername = username;

        const newUserRow = new Array(Math.max(userSchema.maxIndex + 1, usersSheet.getLastColumn() || 1)).fill('');
        newUserRow[userSchema.username] = safeUsername;
        newUserRow[userSchema.passwordHash] = passwordHash;
        newUserRow[userSchema.role] = 'User';
        newUserRow[userSchema.fullName] = fullName;
        if (userSchema.createdAt >= 0) {
            newUserRow[userSchema.createdAt] = now;
        }

        usersSheet.appendRow(newUserRow);

        referralSheet.getRange(referralRowIndex + 1, referralSchema.status + 1).setValue('Used');
        referralSheet.getRange(referralRowIndex + 1, referralSchema.usedBy + 1).setValue(safeUsername);
        if (referralSchema.usedAt >= 0) {
            referralSheet.getRange(referralRowIndex + 1, referralSchema.usedAt + 1).setValue(now);
        }
        moveReferralCodeRowToBottom_(referralSheet, referralRowIndex + 1);

        return JsonResponse({
            success: true,
            message: 'Tạo tài khoản thành công'
        });
    } catch (error) {
        Logger.log('Register error: ' + error.toString());
        return JsonResponse({ success: false, message: 'Không thể tạo tài khoản lúc này' });
    } finally {
        lock.releaseLock();
    }
}


function moveReferralCodeRowToBottom_(referralSheet, rowNumber) {
    if (!referralSheet || !rowNumber || rowNumber <= 1) {
        return;
    }

    const lastRow = referralSheet.getLastRow();
    if (rowNumber >= lastRow) {
        return;
    }

    const lastCol = Math.max(referralSheet.getLastColumn(), 1);
    const rowValues = referralSheet.getRange(rowNumber, 1, 1, lastCol).getValues();

    referralSheet.deleteRow(rowNumber);
    referralSheet.getRange(referralSheet.getLastRow() + 1, 1, 1, lastCol).setValues(rowValues);
}


function getUsersSchema_(usersSheet) {
    const fallback = {
        username: 0,
        passwordHash: 1,
        role: 2,
        fullName: 3,
        adminPinHash: 4,
        createdAt: 5,
        maxIndex: 5
    };

    if (!usersSheet) {
        return fallback;
    }

    const lastCol = Math.max(usersSheet.getLastColumn(), 1);
    const headers = usersSheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
    const normalizedHeaders = headers.map((item) => normalizeHeaderName_(item));

    const username = findHeaderIndex_(normalizedHeaders, ['username', 'user', 'taikhoan'], fallback.username);
    const passwordHash = findHeaderIndex_(normalizedHeaders, ['passwordhash', 'password', 'matkhau'], fallback.passwordHash);
    const role = findHeaderIndex_(normalizedHeaders, ['role', 'vaitro'], fallback.role);
    const fullName = findHeaderIndex_(normalizedHeaders, ['fullname', 'hoten', 'name'], fallback.fullName);
    const adminPinHash = findHeaderIndex_(normalizedHeaders, ['adminpinhash', 'adminpin'], fallback.adminPinHash);
    const createdAt = findHeaderIndex_(normalizedHeaders, ['createdat', 'createdtime', 'ngaytao'], -1);

    const maxIndex = Math.max(
        username,
        passwordHash,
        role,
        fullName,
        adminPinHash,
        createdAt,
        fallback.maxIndex
    );

    return {
        username: username,
        passwordHash: passwordHash,
        role: role,
        fullName: fullName,
        adminPinHash: adminPinHash,
        createdAt: createdAt,
        maxIndex: maxIndex
    };
}


function getReferralCodesSchema_(referralSheet) {
    const fallback = {
        code: 0,
        status: 1,
        usedBy: 2,
        usedAt: 3
    };

    if (!referralSheet) {
        return fallback;
    }

    const lastCol = Math.max(referralSheet.getLastColumn(), 1);
    const headers = referralSheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
    const normalizedHeaders = headers.map((item) => normalizeHeaderName_(item));

    return {
        code: findHeaderIndex_(normalizedHeaders, ['code', 'magioithieu', 'referralcode'], fallback.code),
        status: findHeaderIndex_(normalizedHeaders, ['status', 'trangthai'], fallback.status),
        usedBy: findHeaderIndex_(normalizedHeaders, ['usedby', 'useby', 'nguoidung'], fallback.usedBy),
        usedAt: findHeaderIndex_(normalizedHeaders, ['usedat', 'thoigiandung', 'ngaydung'], fallback.usedAt)
    };
}


function sha256Hex_(plainText) {
    const digest = Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        String(plainText || ''),
        Utilities.Charset.UTF_8
    );

    return digest.map(function(byte) {
        const value = byte < 0 ? byte + 256 : byte;
        return ('0' + value.toString(16)).slice(-2);
    }).join('');
}


function hashPasswordWithSalt_(plainPassword) {
    return sha256Hex_(`${String(plainPassword || '')}${PASSWORD_SALT}`);
}


function verifyStoredPasswordHash_(storedHash, saltedHashInput, legacyHashInput) {
    const normalizedStored = String(storedHash || '').trim();
    const normalizedSalted = String(saltedHashInput || '').trim();
    const normalizedLegacy = String(legacyHashInput || '').trim();

    if (!normalizedStored || !normalizedSalted) {
        return { valid: false, migrateToSalted: false };
    }

    if (normalizedStored === normalizedSalted) {
        return { valid: true, migrateToSalted: false };
    }

    if (normalizedLegacy && normalizedStored === normalizedLegacy) {
        return { valid: true, migrateToSalted: true };
    }

    return { valid: false, migrateToSalted: false };
}


function getJwtSecrets_() {
    const cache = CacheService.getScriptCache();
    const cachedSecrets = cache.get(JWT_SECRET_CACHE_KEY);
    if (cachedSecrets) {
        try {
            const parsed = JSON.parse(cachedSecrets);
            if (parsed && parsed.current) {
                return parsed;
            }
        } catch (e) {
            // Ignore cache parse failures and load from Script Properties.
        }
    }

    const properties = PropertiesService.getScriptProperties();
    const currentRaw = properties.getProperty(JWT_SECRET_CURRENT_PROPERTY_KEY);
    const legacyRaw = properties.getProperty(JWT_SECRET_LEGACY_PROPERTY_KEY);
    const previousRaw = properties.getProperty(JWT_SECRET_PREVIOUS_PROPERTY_KEY);

    const current = String(currentRaw || legacyRaw || '').trim();
    const previous = String(previousRaw || '').trim();

    if (!current) {
        throw new Error('Thiếu JWT secret. Hãy cấu hình QUIZ_JWT_SECRET_CURRENT (hoặc QUIZ_JWT_SECRET cho hệ thống cũ).');
    }

    const secrets = {
        current: current,
        previous: previous && previous !== current ? previous : ''
    };

    cache.put(JWT_SECRET_CACHE_KEY, JSON.stringify(secrets), JWT_SECRET_CACHE_TTL_SECONDS);
    return secrets;
}


function getJwtSecret_() {
    return getJwtSecrets_().current;
}


function rotateJwtSecret_(newSecret) {
    const normalizedNewSecret = String(newSecret || '').trim();
    if (!normalizedNewSecret) {
        throw new Error('New JWT secret is required');
    }

    const currentSecrets = getJwtSecrets_();
    if (currentSecrets.current === normalizedNewSecret) {
        return {
            success: true,
            message: 'JWT secret không thay đổi.',
            currentKey: JWT_SECRET_CURRENT_PROPERTY_KEY,
            previousKey: JWT_SECRET_PREVIOUS_PROPERTY_KEY
        };
    }

    const properties = PropertiesService.getScriptProperties();
    properties.setProperty(JWT_SECRET_PREVIOUS_PROPERTY_KEY, currentSecrets.current);
    properties.setProperty(JWT_SECRET_CURRENT_PROPERTY_KEY, normalizedNewSecret);
    properties.deleteProperty(JWT_SECRET_LEGACY_PROPERTY_KEY);

    CacheService.getScriptCache().remove(JWT_SECRET_CACHE_KEY);

    return {
        success: true,
        message: 'Đã rotate JWT secret thành công.',
        currentKey: JWT_SECRET_CURRENT_PROPERTY_KEY,
        previousKey: JWT_SECRET_PREVIOUS_PROPERTY_KEY
    };
}


function isValidTokenSignature_(payloadB64, signatureB64) {
    const secrets = getJwtSecrets_();
    const candidates = [secrets.current, secrets.previous].filter(function(secret, index, arr) {
        return !!secret && arr.indexOf(secret) === index;
    });

    for (let i = 0; i < candidates.length; i++) {
        const expectedSignature = Utilities.computeHmacSha256Signature(payloadB64, candidates[i]);
        if (Utilities.base64Encode(expectedSignature) === signatureB64) {
            return true;
        }
    }

    return false;
}


function generateToken(username, role) {
    const payload = {
        username: username,
        role: role,
        timestamp: Date.now(),
        sessionId: Utilities.getUuid()
    };

    const payloadB64 = Utilities.base64Encode(JSON.stringify(payload));
    const signatureBytes = Utilities.computeHmacSha256Signature(payloadB64, getJwtSecret_());
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


function getRateLimitKey_(scope, subject) {
    return `rate_limit_${String(scope || 'default')}_${String(subject || 'anonymous').toLowerCase()}`;
}


function getRateLimitState_(scope, subject) {
    const key = getRateLimitKey_(scope, subject);
    const cache = CacheService.getScriptCache();

    try {
        const raw = cache.get(key);
        if (!raw) {
            return {
                key: key,
                failures: 0,
                blockedUntil: 0
            };
        }

        const parsed = JSON.parse(raw);
        return {
            key: key,
            failures: Number(parsed.failures || 0),
            blockedUntil: Number(parsed.blockedUntil || 0)
        };
    } catch (e) {
        return {
            key: key,
            failures: 0,
            blockedUntil: 0
        };
    }
}


function isRateLimited_(scope, subject) {
    const state = getRateLimitState_(scope, subject);
    return state.blockedUntil > Date.now();
}


function registerRateLimitFailure_(scope, subject) {
    const state = getRateLimitState_(scope, subject);
    const cache = CacheService.getScriptCache();
    const now = Date.now();

    const failures = (state.failures || 0) + 1;
    const blockedUntil = failures >= AUTH_RATE_LIMIT_MAX_ATTEMPTS
        ? now + (AUTH_RATE_LIMIT_BLOCK_SECONDS * 1000)
        : 0;

    const ttl = blockedUntil > now
        ? AUTH_RATE_LIMIT_BLOCK_SECONDS
        : AUTH_RATE_LIMIT_WINDOW_SECONDS;

    cache.put(state.key, JSON.stringify({
        failures: failures,
        blockedUntil: blockedUntil
    }), ttl);
}


function clearRateLimitFailures_(scope, subject) {
    const key = getRateLimitKey_(scope, subject);
    CacheService.getScriptCache().remove(key);
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

        if (!isValidTokenSignature_(payloadB64, signatureB64)) {
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


function handleGetAccountInfo(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token) {
        return JsonResponse({ success: false, message: 'Invalid token' });
    }

    const userSchema = getUsersSchema_(sheetsRef.users);
    const usersData = sheetsRef.users.getDataRange().getValues();

    let fullName = '';
    let username = token.username;

    for (let i = 1; i < usersData.length; i++) {
        const rowUsername = String(usersData[i][userSchema.username] || '').trim();
        if (!rowUsername || rowUsername.toLowerCase() !== String(token.username || '').toLowerCase()) {
            continue;
        }

        username = rowUsername;
        fullName = String(usersData[i][userSchema.fullName] || '').trim();
        break;
    }

    const snapshot = getDashboardStatsSnapshot_(sheetsRef, username);

    return JsonResponse({
        success: true,
        account: {
            fullName: fullName,
            username: username,
            role: token.role
        },
        statsSnapshot: snapshot
    });
}


function handleChangePassword(data) {
    const sheetsRef = getSheetsRef_();
    const token = verifyToken(data.token);
    if (!token) {
        return JsonResponse({ success: false, message: 'Invalid token' });
    }

    const oldPasswordHash = String(data.oldPasswordHash || '').trim();
    const oldPasswordHashLegacy = String(data.oldPasswordHashLegacy || '').trim();
    const newPasswordHash = String(data.newPasswordHash || '').trim();

    if (!oldPasswordHash || !newPasswordHash) {
        return JsonResponse({ success: false, message: 'Thiếu dữ liệu mật khẩu' });
    }

    if (oldPasswordHash === newPasswordHash) {
        return JsonResponse({ success: false, message: 'Mật khẩu mới phải khác mật khẩu cũ' });
    }

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) {
        return JsonResponse({ success: false, message: 'Hệ thống đang bận, vui lòng thử lại sau ít phút' });
    }

    try {
        const userSchema = getUsersSchema_(sheetsRef.users);
        const usersData = sheetsRef.users.getDataRange().getValues();

        for (let i = 1; i < usersData.length; i++) {
            const rowUsername = String(usersData[i][userSchema.username] || '').trim();
            if (!rowUsername || rowUsername.toLowerCase() !== String(token.username || '').toLowerCase()) {
                continue;
            }

            const rowPasswordHash = String(usersData[i][userSchema.passwordHash] || '').trim();
            const verifyResult = verifyStoredPasswordHash_(rowPasswordHash, oldPasswordHash, oldPasswordHashLegacy);
            if (!verifyResult.valid) {
                return JsonResponse({ success: false, message: 'Mật khẩu hiện tại không chính xác' });
            }

            sheetsRef.users.getRange(i + 1, userSchema.passwordHash + 1).setValue(newPasswordHash);
            return JsonResponse({ success: true, message: 'Đổi mật khẩu thành công' });
        }

        return JsonResponse({ success: false, message: 'Không tìm thấy tài khoản' });
    } finally {
        lock.releaseLock();
    }
}
