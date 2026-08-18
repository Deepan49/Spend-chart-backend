const express = require('express');
const router = express.Router();

const { adminAuth, requireRole } = require('../middleware/adminAuthMiddleware');
const adminAuthController = require('../controllers/adminAuthController');
const adminUserController = require('../controllers/adminUserController');
const adminTransactionController = require('../controllers/adminTransactionController');
const adminFeatureFlagController = require('../controllers/adminFeatureFlagController');
const adminSupportController = require('../controllers/adminSupportController');
const adminErrorLogController = require('../controllers/adminErrorLogController');
const adminHealthController = require('../controllers/adminHealthController');
const adminAnalyticsController = require('../controllers/adminAnalyticsController');
const adminBroadcastController = require('../controllers/adminBroadcastController');

// ── Public / Client Endpoints ────────────────────────────────────────────────
router.post('/public/support/submit', adminSupportController.submitTicketFromUser);
router.post('/public/errors/log', adminErrorLogController.logError);
router.get('/public/features/active', adminFeatureFlagController.getActiveFlagsForClient);

// ── Admin Auth Routes ────────────────────────────────────────────────────────
router.post('/auth/login', adminAuthController.login);
router.get('/auth/me', adminAuth, adminAuthController.getMe);
router.get('/auth/admins', adminAuth, requireRole(['super_admin']), adminAuthController.listAdmins);
router.post('/auth/admins', adminAuth, requireRole(['super_admin']), adminAuthController.createAdmin);
router.put('/auth/admins/:id/status', adminAuth, requireRole(['super_admin']), adminAuthController.updateAdminStatus);
router.get('/auth/audit-logs', adminAuth, requireRole(['super_admin', 'support']), adminAuthController.getAuditLogs);

// ── User Management Routes ───────────────────────────────────────────────────
router.get('/users', adminAuth, adminUserController.getUsers);
router.get('/users/:id', adminAuth, adminUserController.getUserDetails);
router.put('/users/:id/status', adminAuth, requireRole(['super_admin', 'support']), adminUserController.updateUserStatus);
router.delete('/users/:id', adminAuth, requireRole(['super_admin']), adminUserController.deleteUser);
router.post('/users/:id/reset-password', adminAuth, requireRole(['super_admin']), adminUserController.resetUserPassword);
router.post('/users/:id/impersonate', adminAuth, requireRole(['super_admin', 'support']), adminUserController.generateImpersonateToken);

// ── Transactions Overview Routes ─────────────────────────────────────────────
router.get('/transactions', adminAuth, adminTransactionController.getTransactions);
router.get('/transactions/:id', adminAuth, adminTransactionController.getTransactionDetails);

// ── Feature Flags & Remote Config Routes ─────────────────────────────────────
router.get('/features', adminAuth, adminFeatureFlagController.getFeatureFlags);
router.post('/features', adminAuth, requireRole(['super_admin']), adminFeatureFlagController.createFeatureFlag);
router.put('/features/:id', adminAuth, requireRole(['super_admin']), adminFeatureFlagController.updateFeatureFlag);
router.delete('/features/:id', adminAuth, requireRole(['super_admin']), adminFeatureFlagController.deleteFeatureFlag);

// ── Support / Feedback Inbox Routes ──────────────────────────────────────────
router.get('/support/tickets', adminAuth, adminSupportController.getTickets);
router.get('/support/tickets/:id', adminAuth, adminSupportController.getTicketDetails);
router.put('/support/tickets/:id', adminAuth, requireRole(['super_admin', 'support']), adminSupportController.updateTicket);

// ── Error & Crash Monitoring Routes ──────────────────────────────────────────
router.get('/errors', adminAuth, adminErrorLogController.getErrors);
router.put('/errors/:id/status', adminAuth, requireRole(['super_admin', 'support']), adminErrorLogController.updateErrorStatus);

// ── System Health Routes ─────────────────────────────────────────────────────
router.get('/health', adminAuth, adminHealthController.getHealthStatus);
router.post('/health/check', adminAuth, requireRole(['super_admin', 'support']), adminHealthController.triggerHealthCheck);

// ── Analytics Dashboard Routes ───────────────────────────────────────────────
router.get('/analytics/dashboard', adminAuth, adminAnalyticsController.getDashboardAnalytics);

// ── Broadcast Notifications Routes ───────────────────────────────────────────
router.get('/broadcasts', adminAuth, adminBroadcastController.getBroadcasts);
router.post('/broadcasts', adminAuth, requireRole(['super_admin']), adminBroadcastController.createBroadcast);
router.delete('/broadcasts/:id', adminAuth, requireRole(['super_admin']), adminBroadcastController.deleteBroadcast);

module.exports = router;
