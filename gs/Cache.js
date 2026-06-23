
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
