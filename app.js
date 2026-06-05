const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const stockRoutes = require('./routes/stockRoutes');
const authRoutes = require('./routes/authRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const portfolioRoutes = require('./routes/portfolioRoutes');
const goldHoldingRoutes = require('./routes/goldHoldingRoutes');
const mfHoldingRoutes = require('./routes/mfHoldingRoutes');
const bondHoldingRoutes = require('./routes/bondHoldingRoutes');
const accountRoutes = require('./routes/accountRoutes');
const budgetRoutes = require('./routes/budgetRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');

const app = express();
app.use(cors());
app.use(express.json());

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

app.use('/api/stocks', stockRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/portfolio/gold', goldHoldingRoutes);
app.use('/api/portfolio/mf', mfHoldingRoutes);
app.use('/api/portfolio/bonds', bondHoldingRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
