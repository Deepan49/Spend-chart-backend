const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const auth = require('../middleware/authMiddleware');

router.get('/', auth, subscriptionController.getSubscriptions);
router.post('/', auth, subscriptionController.createSubscription);
router.put('/:id', auth, subscriptionController.updateSubscription);
router.delete('/:id', auth, subscriptionController.deleteSubscription);
router.post('/:id/pay', auth, subscriptionController.paySubscription);

module.exports = router;
