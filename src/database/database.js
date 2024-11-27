const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const config = require('../config.js');
const { StatusCodeError } = require('../endpointHelper.js');
const { Role } = require('../model/model.js');
const dbModel = require('./dbModel.js');
const logger = require('../logger.js');

class DB {
  constructor() {
    this.initialized = this.initializeDatabase();
  }

  async getMenu() {
    const connection = await this.getConnection();
    const query = `SELECT * FROM menu`;
    logger.logSQL(query)
    try {
      const rows = await this.query(connection, query);
      return rows;
    } finally {
      connection.end();
    }
  }

  async addMenuItem(item) {
    const connection = await this.getConnection();
    const query = `INSERT INTO menu (title, description, image, price) VALUES (?, ?, ?, ?)`;
    const parameters = [item.title, item.description, item.image, item.price];
    logger.logSQL(query, parameters);
    try {
      const addResult = await this.query(connection, query, parameters);
      return { ...item, id: addResult.insertId };
    } finally {
      connection.end();
    }
  }

  async addUser(user) {
    const connection = await this.getConnection();
    try {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      let query = `INSERT INTO user (name, email, password) VALUES (?, ?, ?)`;
      let parameters = [user.name, user.email, hashedPassword];

      logger.logSQL(query, parameters, [2]);

      const userResult = await this.query(connection, query, parameters);
      const userId = userResult.insertId;
      for (const role of user.roles) {
        switch (role.role) {
          case Role.Franchisee: {
            const franchiseId = await this.getID(connection, 'name', role.object, 'franchise');
            query = `INSERT INTO userRole (userId, role, objectId) VALUES (?, ?, ?)`;
            parameters = [userId, role.role, franchiseId];
            logger.logSQL(query, parameters);
            await this.query(connection, query, parameters);
            break;
          }
          default: {
            query = `INSERT INTO userRole (userId, role, objectId) VALUES (?, ?, ?)`;
            parameters = [userId, role.role, 0];
            logger.logSQL(query,parameters, [], "Add user default branch")
            await this.query(connection, query, parameters);
            break;
          }
        }
      }
      return { ...user, id: userId, password: undefined };
    } finally {
      connection.end();
    }
  }

  async getUser(email, password) {
    const connection = await this.getConnection();
    try {
      let query = `SELECT * FROM user WHERE email=?`;
      let parameters = [email];
      logger.logSQL(query, parameters)
      const userResult = await this.query(connection, query, parameters);
      const user = userResult[0];
      if (!user || !(await bcrypt.compare(password, user.password))) {
        throw new StatusCodeError('unknown user', 404);
      }

      query = `SELECT * FROM userRole WHERE userId=?`;
      parameters = [user.id];

      logger.logSQL(query, parameters);

      const roleResult = await this.query(connection, query, parameters);
      const roles = roleResult.map((r) => {
        return { objectId: r.objectId || undefined, role: r.role };
      });

      return { ...user, roles: roles, password: undefined };
    } finally {
      connection.end();
    }
  }


  async updateUser(userId, email, password) {
    const connection = await this.getConnection();
    try {
      const query_params = [];
      const parameters = [];
      const sanitize = [];
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        query_params.push("password=?");
        parameters.push(`'${hashedPassword}'`);
        sanitize.push(0);
        //params.push(`password='${hashedPassword}'`);
      }
      if (email) {
        query_params.push("email=?");
        parameters.push(`'${email}'`)
        //params.push(`email='${email}'`);
      }
      if (parameters.length > 0) {
        const query = `UPDATE user SET ${query_params.join(', ')} WHERE id=?`;
        parameters.push(`${userId}`)

        logger.logSQL(query, parameters, sanitize, "Scrutinize")

        await this.query(connection, query, parameters);
      }
      return this.getUser(email, password);
    } finally {
      connection.end();
    }
  }

  async loginUser(userId, token) {
    token = this.getTokenSignature(token);
    const connection = await this.getConnection();
    const query = `INSERT INTO auth (token, userId) VALUES (?, ?)`;
    const parameters = [token, userId];
    logger.logSQL(query, parameters, [0]);
    try {
      await this.query(connection, query, parameters);
    } finally {
      connection.end();
    }
  }

  async isLoggedIn(token) {
    token = this.getTokenSignature(token);
    const connection = await this.getConnection();
    const query = `SELECT userId FROM auth WHERE token=?`;
    const parameters = [token];
    logger.logSQL(query, parameters, [0]);
    try {
      const authResult = await this.query(connection, query, parameters);
      return authResult.length > 0;
    } finally {
      connection.end();
    }
  }

  async logoutUser(token) {
    token = this.getTokenSignature(token);
    const connection = await this.getConnection();
    const query = `DELETE FROM auth WHERE token=?`;
    const parameters = [token];

    logger.logSQL(query, parameters, [0]);

    try {
      await this.query(connection, query, parameters);
    } finally {
      connection.end();
    }
  }

  async getOrders(user, page = 1) {
    const connection = await this.getConnection();
    try {
      const outer_query = `SELECT id, franchiseId, storeId, date FROM dinerOrder WHERE dinerId=? LIMIT ?,?`;
      const outer_query_parameters = [user.id, offset, config.db.listPerPage]

      logger.logSQL(outer_query, outer_query_parameters, [], "Scrutinize");

      const offset = this.getOffset(page, config.db.listPerPage);
      const orders = await this.query(connection, outer_query, outer_query_parameters);
      for (const order of orders) {
        const inner_query = `SELECT id, menuId, description, price FROM orderItem WHERE orderId=?`;
        const inner_query_params = [order.id];

        logger.logSQL(inner_query, inner_query_params);

        let items = await this.query(connection, inner_query, inner_query_params);
        order.items = items;
      }
      return { dinerId: user.id, orders: orders, page };
    } finally {
      connection.end();
    }
  }

  async addDinerOrder(user, order) {
    const connection = await this.getConnection();
    try {
      const outer_query = `INSERT INTO dinerOrder (dinerId, franchiseId, storeId, date) VALUES (?, ?, ?, now())`;
      const outer_query_parameters = [user.id, order.franchiseId, order.storeId];

      logger.logSQL(outer_query, outer_query_parameters);

      const orderResult = await this.query(connection, outer_query, outer_query_parameters);
      const orderId = orderResult.insertId;
      for (const item of order.items) {
        const menuId = await this.getID(connection, 'id', item.menuId, 'menu');

        const query = `INSERT INTO orderItem (orderId, menuId, description, price) VALUES (?, ?, ?, ?)`;
        const parameters = [orderId, menuId, item.description, item.price];

        logger.logSQL(query, parameters);

        await this.query(connection, query, parameters);
      }
      return { ...order, id: orderId };
    } finally {
      connection.end();
    }
  }

  async createFranchise(franchise) {
    const connection = await this.getConnection();
    try {
      for (const admin of franchise.admins) {

        const query = `SELECT id, name FROM user WHERE email=?`;
        const parameters = [admin.email];

        logger.logSQL(query, parameters)

        const adminUser = await this.query(connection, query, parameters);
        if (adminUser.length == 0) {
          throw new StatusCodeError(`unknown user for franchise admin ${admin.email} provided`, 404);
        }
        admin.id = adminUser[0].id;
        admin.name = adminUser[0].name;
      }

      const outer_query = `INSERT INTO franchise (name) VALUES (?)`;
      const outer_parameters = [franchise.name];

      logger.logSQL(outer_parameters, outer_parameters);

      const franchiseResult = await this.query(connection, outer_query, outer_parameters);
      franchise.id = franchiseResult.insertId;

      for (const admin of franchise.admins) {
        const query = `INSERT INTO userRole (userId, role, objectId) VALUES (?, ?, ?)`;
        const parameters = [admin.id, Role.Franchisee, franchise.id];

        logger.logSQL(query, parameters);

        await this.query(connection, query, parameters);
      }

      return franchise;
    } finally {
      connection.end();
    }
  }

  async deleteFranchise(franchiseId) {
    const connection = await this.getConnection();
    try {
      await connection.beginTransaction();
      try {
        const query1 = `DELETE FROM store WHERE franchiseId=?`;
        const parameters1 = [franchiseId];

        logger.logSQL(query1, parameters1);

        await this.query(connection, query1, parameters1);
        const query2 = `DELETE FROM userRole WHERE objectId=?`;
        const parameters2 = [franchiseId];

        logger.logSQL(query2, parameters2);

        await this.query(connection, query2, parameters2);
        const query3 = `DELETE FROM franchise WHERE id=?`;
        const parameters3 = [franchiseId];

        logger.logSQL(query3, parameters3);

        await this.query(connection, query3, parameters3);
        await connection.commit();
      } catch {
        await connection.rollback();
        throw new StatusCodeError('unable to delete franchise', 500);
      }
    } finally {
      connection.end();
    }
  }

  async getFranchises(authUser) {
    const connection = await this.getConnection();
    try {
      const outer_query = `SELECT id, name FROM franchise`;
      logger.logSQL(outer_query);
      const franchises = await this.query(connection, outer_query);
      for (const franchise of franchises) {
        if (authUser?.isRole(Role.Admin)) {
          await this.getFranchise(franchise);
        } else {
          const inner_query = `SELECT id, name FROM store WHERE franchiseId=?`;
          const inner_params = [franchise.id];
          logger.logSQL(inner_query, inner_params);
          franchise.stores = await this.query(connection, inner_query, inner_params);
        }
      }
      return franchises;
    } finally {
      connection.end();
    }
  }

  async getUserFranchises(userId) {
    const connection = await this.getConnection();
    try {
      const top_query = `SELECT objectId FROM userRole WHERE role='franchisee' AND userId=?`;
      const top_params = [userId];

      logger.logSQL(top_query, top_params);

      let franchiseIds = await this.query(connection, top_query, top_params);
      if (franchiseIds.length === 0) {
        return [];
      }

      franchiseIds = franchiseIds.map((v) => v.objectId);
      let franchisePlaceholder = franchiseIds.map((v) => {
        if (v !== undefined) {
          return "?"
        } else {
          return "?"
        }
      });

      const bottom_query = `SELECT id, name FROM franchise WHERE id in (${franchisePlaceholder.join(',')})`
      const bottom_params = franchiseIds;

      logger.logSQL(bottom_query, bottom_params);

      const franchises = await this.query(connection, bottom_query, bottom_params);
      for (const franchise of franchises) {
        await this.getFranchise(franchise);
      }
      return franchises;
    } finally {
      connection.end();
    }
  }

  async getFranchise(franchise) {
    const connection = await this.getConnection();
    try {
      const query1 = `SELECT u.id, u.name, u.email FROM userRole AS ur JOIN user AS u ON u.id=ur.userId WHERE ur.objectId=? AND ur.role='franchisee'`;
      const parameters1 = [franchise.id];

      logger.logSQL(query1, parameters1);

      franchise.admins = await this.query(connection, query1, parameters1);

      const query2 = `SELECT s.id, s.name, COALESCE(SUM(oi.price), 0) AS totalRevenue FROM dinerOrder AS do JOIN orderItem AS oi ON do.id=oi.orderId RIGHT JOIN store AS s ON s.id=do.storeId WHERE s.franchiseId=? GROUP BY s.id`;
      const parameters2 = [franchise.id];

      logger.logSQL(query2, parameters2);

      franchise.stores = await this.query(
        connection,
        query2,
        parameters2
      );

      return franchise;
    } finally {
      connection.end();
    }
  }

  async createStore(franchiseId, store) {
    const connection = await this.getConnection();
    try {
      const query = `INSERT INTO store (franchiseId, name) VALUES (?, ?)`;
      const parameters = [franchiseId, store.name];

      logger.logSQL(query, parameters);

      const insertResult = await this.query(connection, query, parameters);
      return { id: insertResult.insertId, franchiseId, name: store.name };
    } finally {
      connection.end();
    }
  }

  async deleteStore(franchiseId, storeId) {
    const connection = await this.getConnection();
    try {
      const query = `DELETE FROM store WHERE franchiseId=? AND id=?`;
      const parameters = [franchiseId, storeId];

      logger.logSQL(query, parameters);

      await this.query(connection, query, parameters);
    } finally {
      connection.end();
    }
  }

  getOffset(currentPage = 1, listPerPage) {
    return (currentPage - 1) * [listPerPage];
  }

  getTokenSignature(token) {
    const parts = token.split('.');
    if (parts.length > 2) {
      return parts[2];
    }
    return '';
  }

  async query(connection, sql, params) {
    const [results] = await connection.execute(sql, params);
    return results;
  }

  async getID(connection, key, value, table) {
    const query = `SELECT id FROM ? WHERE ?=?`
    const parameters = [table, key, value]

    logger.logSQL(query, parameters, [], "Scrutinize");

    const [rows] = await connection.execute(query, parameters);
    if (rows.length > 0) {
      return rows[0].id;
    }
    throw new Error('No ID found');
  }

  async getConnection() {
    // Make sure the database is initialized before trying to get a connection.
    await this.initialized;
    return this._getConnection();
  }

  async _getConnection(setUse = true) {
    const connection = await mysql.createConnection({
      host: config.db.connection.host,
      user: config.db.connection.user,
      password: config.db.connection.password,
      connectTimeout: config.db.connection.connectTimeout,
      decimalNumbers: true,
    });
    if (setUse) {
      await connection.query(`USE ${config.db.connection.database}`);
    }
    return connection;
  }

  async initializeDatabase() {
    try {
      const connection = await this._getConnection(false);
      try {
        const dbExists = await this.checkDatabaseExists(connection);
        console.log(dbExists ? 'Database exists' : 'Database does not exist, creating it');

        await connection.query(`CREATE DATABASE IF NOT EXISTS ${config.db.connection.database}`);
        await connection.query(`USE ${config.db.connection.database}`);

        if (!dbExists) {
          console.log('Successfully created database');
        }

        for (const statement of dbModel.tableCreateStatements) {
          await connection.query(statement);
        }

        if (!dbExists) {
          const defaultAdmin = { name: '常用名字', email: 'a@jwt.com', password: 'admin', roles: [{ role: Role.Admin }] };
          this.addUser(defaultAdmin);
        }
      } finally {
        connection.end();
      }
    } catch (err) {
      console.error(JSON.stringify({ message: 'Error initializing database', exception: err.message, connection: config.db.connection }));
    }
  }

  async checkDatabaseExists(connection) {
    const [rows] = await connection.execute(`SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`, [config.db.connection.database]);
    return rows.length > 0;
  }
}

const db = new DB();
module.exports = { Role, DB: db };
