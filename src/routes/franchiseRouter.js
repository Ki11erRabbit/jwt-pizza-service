const express = require('express');
const { DB, Role } = require('../database/database.js');
const { authRouter } = require('./authRouter.js');
const { StatusCodeError, asyncHandler } = require('../endpointHelper.js');

const logger = require('../logger.js');
const metrics = require('../metrics.js');

const franchiseRouter = express.Router();

franchiseRouter.endpoints = [
  {
    method: 'GET',
    path: '/api/franchise',
    description: 'List all the franchises',
    example: `curl localhost:3000/api/franchise`,
    response: [{ id: 1, name: 'pizzaPocket', admins: [{ id: 4, name: 'pizza franchisee', email: 'f@jwt.com' }], stores: [{ id: 1, name: 'SLC', totalRevenue: 0 }] }],
  },
  {
    method: 'GET',
    path: '/api/franchise/:userId',
    requiresAuth: true,
    description: `List a user's franchises`,
    example: `curl localhost:3000/api/franchise/4  -H 'Authorization: Bearer tttttt'`,
    response: [{ id: 2, name: 'pizzaPocket', admins: [{ id: 4, name: 'pizza franchisee', email: 'f@jwt.com' }], stores: [{ id: 4, name: 'SLC', totalRevenue: 0 }] }],
  },
  {
    method: 'POST',
    path: '/api/franchise',
    requiresAuth: true,
    description: 'Create a new franchise',
    example: `curl -X POST localhost:3000/api/franchise -H 'Content-Type: application/json' -H 'Authorization: Bearer tttttt' -d '{"name": "pizzaPocket", "admins": [{"email": "f@jwt.com"}]}'`,
    response: { name: 'pizzaPocket', admins: [{ email: 'f@jwt.com', id: 4, name: 'pizza franchisee' }], id: 1 },
  },
  {
    method: 'DELETE',
    path: '/api/franchise/:franchiseId',
    requiresAuth: true,
    description: `Delete a franchises`,
    example: `curl -X DELETE localhost:3000/api/franchise/1 -H 'Authorization: Bearer tttttt'`,
    response: { message: 'franchise deleted' },
  },
  {
    method: 'POST',
    path: '/api/franchise/:franchiseId/store',
    requiresAuth: true,
    description: 'Create a new franchise store',
    example: `curl -X POST localhost:3000/api/franchise/1/store -H 'Content-Type: application/json' -d '{"franchiseId": 1, "name":"SLC"}' -H 'Authorization: Bearer tttttt'`,
    response: { id: 1, name: 'SLC', totalRevenue: 0 },
  },
  {
    method: 'DELETE',
    path: '/api/franchise/:franchiseId/store/:storeId',
    requiresAuth: true,
    description: `Delete a store`,
    example: `curl -X DELETE localhost:3000/api/franchise/1/store/1  -H 'Authorization: Bearer tttttt'`,
    response: { message: 'store deleted' },
  },
];

// getFranchises
franchiseRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    metrics.incrementGetRequests();
    res.json(await DB.getFranchises(req.user));
    logger.logHttp(req, res);
  })
);

// getUserFranchises
franchiseRouter.get(
  '/:userId',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    metrics.incrementGetRequests();
    let result = [];
    const userId = Number(req.params.userId);
    if (req.user.id === userId || req.user.isRole(Role.Admin)) {
      result = await DB.getUserFranchises(userId);
    }
    
    res.json(result);
    logger.logHttp(req, res);
  })
);

// createFranchise
franchiseRouter.post(
  '/',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    metrics.incrementPostRequests();
    if (!req.user.isRole(Role.Admin)) {
      logger.logHttp(req, res);
      throw new StatusCodeError('unable to create a franchise', 403);
    }

    const franchise = req.body;
    res.send(await DB.createFranchise(franchise));
    logger.logHttp(req, res);
  })
);

// deleteFranchise
franchiseRouter.delete(
  '/:franchiseId',
  asyncHandler(async (req, res) => {
    metrics.incrementDeleteRequests();
    if (!req.user.isRole(Role.Admin)) {
      logger.logHttp(req, res);
      throw new StatusCodeError('unable to delete a franchise', 403);
    }

    const franchiseId = Number(req.params.franchiseId);
    await DB.deleteFranchise(franchiseId);
    res.json({ message: 'franchise deleted' });
    logger.logHttp(req, res);
  })
);

// createStore
franchiseRouter.post(
  '/:franchiseId/store',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    metrics.incrementPostRequests();
    const franchiseId = Number(req.params.franchiseId);
    const franchise = await DB.getFranchise({ id: franchiseId });
    if (!franchise || (!req.user.isRole(Role.Admin) && !franchise.admins.some((admin) => admin.id === req.user.id))) {
      logger.logHttp(req, res);
      throw new StatusCodeError('unable to create a store', 403);
    }

    
    logger.logHttp(req, res);
    res.send(await DB.createStore(franchise.id, req.body));
  })
);

// deleteStore
franchiseRouter.delete(
  '/:franchiseId/store/:storeId',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    metrics.incrementDeleteRequests();
    const franchiseId = Number(req.params.franchiseId);
    const franchise = await DB.getFranchise({ id: franchiseId });
    if (!franchise || (!req.user.isRole(Role.Admin) && !franchise.admins.some((admin) => admin.id === req.user.id))) {
      logger.logHttp(req, res);
      throw new StatusCodeError('unable to delete a store', 403);
    }

    const storeId = Number(req.params.storeId);
    await DB.deleteStore(franchiseId, storeId);
    logger.logHttp(req, res);

    res.json({ message: 'store deleted' });
  })
);

module.exports = franchiseRouter;
