const https = require('https');

const endpoints = [
  '/auth/profile',
  '/expenses',
  '/portfolio',
  '/stocks',
  '/subscriptions',
  '/budgets',
  '/analytics'
];

const baseUrl = 'https://spend-chart-backend.onrender.com/api';

console.log('Testing remote endpoints at:', baseUrl);

endpoints.forEach(endpoint => {
  const url = baseUrl + endpoint;
  https.get(url, (res) => {
    console.log(`Endpoint: ${endpoint} -> Status Code: ${res.statusCode}`);
  }).on('error', (err) => {
    console.error(`Endpoint: ${endpoint} -> Error: ${err.message}`);
  });
});
