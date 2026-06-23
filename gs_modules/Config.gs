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

const SPREADSHEET_ID = ''; 
const JWT_SECRET_CURRENT_PROPERTY_KEY = 'QUIZ_JWT_SECRET_CURRENT';
const JWT_SECRET_PREVIOUS_PROPERTY_KEY = 'QUIZ_JWT_SECRET_PREVIOUS';
const JWT_SECRET_LEGACY_PROPERTY_KEY = 'QUIZ_JWT_SECRET';
const JWT_SECRET_CACHE_KEY = 'quiz_jwt_secrets_cache_v2';
const JWT_SECRET_CACHE_TTL_SECONDS = 300;
const PASSWORD_SALT = 'TsByinChei';
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const AUTH_RATE_LIMIT_MAX_ATTEMPTS = 5;
const AUTH_RATE_LIMIT_WINDOW_SECONDS = 5 * 60;
const AUTH_RATE_LIMIT_BLOCK_SECONDS = 5 * 60;
