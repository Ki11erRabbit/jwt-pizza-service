const express = require('express');
const { authRouter, setAuthUser } = require('./routes/authRouter.js');
const orderRouter = require('./routes/orderRouter.js');
const franchiseRouter = require('./routes/franchiseRouter.js');
const version = require('./version.json');
const config = require('./config.js');
const metrics = require('./metrics.js');
const logger = require('./logger.js');

const app = express();
app.use(express.json());
app.use(setAuthUser);
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
});

const apiRouter = express.Router();
app.use('/api', apiRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/order', orderRouter);
apiRouter.use('/franchise', franchiseRouter);

apiRouter.use('/docs', (req, res) => {
  // console.log('Hello');
  
  res.json({
    version: version.version,
    endpoints: [...authRouter.endpoints, ...orderRouter.endpoints, ...franchiseRouter.endpoints],
    config: { factory: config.factory.url, db: config.db.connection.host },
  });
  logger.logHttp(req, res);
});

app.get('/', (req, res) => {
  // console.log("hello")
  logger.logHttp(req, res);
    metrics.incrementGetRequests();
  res.json({
    message: 'welcome to JWT Pizza',
    version: version.version,
  });
});

app.get('/metrics', (req, res) => {
  logger.logHttp(req, res);
    metrics.incrementGetRequests();
      const response = {
        string: metrics.getLastMetric()
      };
    res.json(response);
});

app.use('*', (req, res) => {
  return res.status(404).json({
    message: 'unknown endpoint',
  });
});

// Default error handler for all exceptions and errors.
app.use((err, req, res, next) => {
  res.status(err.statusCode ?? 500).json({ message: err.message, stack: err.stack });
  logger.logHttp(req, res);
  next();
});

module.exports = app;
