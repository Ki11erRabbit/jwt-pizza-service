const request = require('supertest');
const franchiseRouter = require('./franchiseRouter');
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

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
});


test('create franchise', async () => {
    const loginRes = await request(app).put('/api/auth').send(testUser);
    expect(loginRes.status).toBe(200);

    const testUserAuthToken = loginRes.body.token;

    const franchise = { name: 'franchise', admins: [testUser] };
    const createFranchiseRes = await request(app).post('/api/franchise').set('Authorization', `Bearer ${testUserAuthToken}`).send(franchise);

    expect(createFranchiseRes.status).toBe(200);
})

