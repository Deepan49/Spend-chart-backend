const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const auth = require('../middleware/authMiddleware');

router.get('/summary', auth, analyticsController.getSummary);
router.get('/ai-insights', auth, analyticsController.getAIInsights);

module.exports = router;
