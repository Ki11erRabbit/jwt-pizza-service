
const request = require('supertest');
const app = require('../service.js');

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

beforeEach(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@order-test.com';
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
    expect(loginRes.status).toBe(200);
    const testUserAuthToken = loginRes.body.token;
    const getRes = await request(app).get('/api/order').set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(getRes.status).toBe(200);
})

test('create order for user', async () => {
    const adminUser = await createAdminUser();
    const franchise = { name: 'franchise with store' + randomName(), admins: [adminUser] };
    const loginRes = await request(app).put('/api/auth').send(adminUser);
    const testUserAuthToken = loginRes.body.token;
    const createFranchiseRes = await request(app).post('/api/franchise').set('Authorization', `Bearer ${testUserAuthToken}`).send(franchise);

    const franchiseId = createFranchiseRes.body.id;
    const createStoreRes = await request(app).post(`/api/franchise/${franchiseId}/store`).set('Authorization', `Bearer ${testUserAuthToken}`).send({ name: 'store' });

    expect(createStoreRes.status).toBe(200);
    const storeId = createStoreRes.body.id;

    const addRes = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${testUserAuthToken}`).send({ title:"Bread", description: "No topping, no sauce, just carbs", image:"pizza9.png", price: 10 });
    expect(addRes.status).toBe(200);

    const menuId = addRes.body[0].id;
    // console.log("menuId", menuId);
    // console.log("storeId", storeId);
    // console.log("franchiseId", franchiseId);

    const createRes = await request(app).post('/api/order').set('Authorization', `Bearer ${testUserAuthToken}`).send({ franchiseId: franchiseId, storeId: storeId, items:[{ menuId: menuId, description: "Bread", price: 10 }] });
    expect(createRes.status).toBe(200);
})


test('create order for user fail', async () => {
    const adminUser = await createAdminUser();
    const loginRes = await request(app).put('/api/auth').send(adminUser);
    const testUserAuthToken = loginRes.body.token;
    expect(loginRes.status).toBe(200);

    const createRes = await request(app).post('/api/order').set('Authorization', `Bearer ${testUserAuthToken}`).send({ franchiseId: 1, items:[{ menuId: 1, description: "Bread", price: 10 }] });
    expect(createRes.status).toBe(500);
})


test('add menu item fail', async () => {
    const loginRes = await request(app).put('/api/auth').send(testUser);
    const testUserAuthToken = loginRes.body.token;
    const addRes = await request(app).post('/api/order').set('Authorization', `Bearer ${testUserAuthToken}`).send({ franchiseID: 1, storeId: 1, items: [{ title:"Bread", description: "No topping, no sauce, just carbs", image:"pizza9.png", price: 10 }]});
    expect(addRes.status).toBe(500);
})


test('create order with bad request', async () => {
    const adminUser = await createAdminUser();
    const franchise = { name: 'franchise with store' + randomName(), admins: [adminUser] };
    const loginRes = await request(app).put('/api/auth').send(adminUser);
    testUserAuthToken = loginRes.body.token;
    const createFranchiseRes = await request(app).post('/api/franchise').set('Authorization', `Bearer ${testUserAuthToken}`).send(franchise);

    const franchiseId = createFranchiseRes.body.id;
    const createStoreRes = await request(app).post(`/api/franchise/${franchiseId}/store`).set('Authorization', `Bearer ${testUserAuthToken}`).send({ name: 'store' });

    expect(createStoreRes.status).toBe(200);
    //const storeId = createStoreRes.body.id;

    const addRes = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${testUserAuthToken}`).send({ title:"Bread", description: "No topping, no sauce, just carbs", image:"pizza9.png", price: 10 });
    expect(addRes.status).toBe(200);

    const menuId = addRes.body[0].id;
    // console.log("menuId", menuId);
    // console.log("storeId", storeId);
    // console.log("franchiseId", franchiseId);

    const createRes = await request(app).post('/api/order').set('Authorization', `Bearer ${testUserAuthToken}`).send({ items:[{ menuId: menuId, description: "Bread", price: 10 }] });
    expect(createRes.status).toBe(500);
})

test('add menu item not admin', async () => {
    const loginRes = await request(app).put('/api/auth').send(testUser);
    const testUserAuthToken = loginRes.body.token;
    const addRes = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${testUserAuthToken}`).send({ franchiseID: 1, storeId: 1, items: [{ title:"Bread", description: "No topping, no sauce, just carbs", image:"pizza9.png", price: 10 }]});
    expect(addRes.status).toBe(403);
    expect(addRes.body.message).toBe('unable to add menu item');
})



