
const request = require('supertest');
const app = require('../service');

const { Role, DB } = require('../database/database.js');

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}


async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  await DB.addUser(user);

  user.password = 'toomanysecrets';
  return user;
}

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
});

test('get menu', async () => {
  const getRes = await request(app).get('/api/order/menu');
  expect(getRes.status).toBe(200);
  expect(getRes.body).toMatchObject([]);
})

test('add menu item', async () => {
    const adminUser = await createAdminUser();
    const loginRes = await request(app).put('/api/auth').send(adminUser);
    const testUserAuthToken = loginRes.body.token;
    const addRes = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${testUserAuthToken}`).send({ title:"Bread", description: "No topping, no sauce, just carbs", image:"pizza9.png", price: 10 });
    expect(addRes.status).toBe(200);
})

test('get orders for user', async () => {
    const loginRes = await request(app).put('/api/auth').send(testUser);
    const testUserAuthToken = loginRes.body.token;
    const getRes = await request(app).get('/api/order').set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(getRes.status).toBe(200);
})

test('create order for user', async () => {
    const loginRes = await request(app).put('/api/auth').send(testUser);
    testUserAuthToken = loginRes.body.token;
    expect(loginRes.status).toBe(200);
    const createRes = await request(app).post('/api/order').set('Authorization', `Bearer ${testUserAuthToken}`).send({ franchiseId: 1, storeId:1, items:[{ menuId: 1, description: "Bread", price: 10 }] });
    expect(createRes.status).toBe(200);
})


test('create order for user fail', async () => {
    const loginRes = await request(app).put('/api/auth').send(testUser);
    testUserAuthToken = loginRes.body.token;
    expect(loginRes.status).toBe(200);
    const createRes = await request(app).post('/api/order').set('Authorization', `Bearer ${testUserAuthToken}`).send({ franchiseId: 1, items:[{ menuId: 1, description: "Bread", price: 10 }] });
    expect(createRes.status).toBe(500);
})


test('add menu item fail', async () => {
    const loginRes = await request(app).put('/api/auth').send(testUser);
    const testUserAuthToken = loginRes.body.token;
    const addRes = await request(app).post('/api/order').set('Authorization', `Bearer ${testUserAuthToken}`).send({ franchiseID: 1, storeId: 1, items: [{ title:"Bread", description: "No topping, no sauce, just carbs", image:"pizza9.png", price: 10 }]});
    expect(addRes.status).toBe(401);
})
