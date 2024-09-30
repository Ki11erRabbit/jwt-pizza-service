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
let testUserID;

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
    testUserID = registerRes.body.user.id;
});

test('login', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expect(loginRes.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);

  const { password, ...user } = { ...testUser, roles: [{ role: 'diner' }] };
  expect(loginRes.body.user).toMatchObject(user);
  expect(password).toBe('a');
});

test('logout', async () => {
  const logoutRes = await request(app).delete('/api/auth').set('Authorization', `Bearer ${testUserAuthToken}`);
  expect(logoutRes.status).toBe(200);
  expect(logoutRes.body.message).toBe('logout successful');
});


test('update user', async () => {
    const adminUser = await createAdminUser();
    const loginRes = await request(app).put('/api/auth').send(adminUser);
    const testUserAuthToken = loginRes.body.token;
    const updateRes = await request(app).put(`/api/auth/${testUserID}`).set('Authorization', `Bearer ${testUserAuthToken}`).send({ email: "new@new.com", password: "new" });

    expect(updateRes.status).toBe(200);
})

test('create admin', async () => {
    const admin = await createAdminUser();

    const loginRes = await request(app).put('/api/auth').send(admin);
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
    
    const { password, ...user } = { ...admin, roles: [{ role: 'admin' }] };
    expect(loginRes.body.user).toMatchObject(user);
    expect(password).toBe('toomanysecrets');

})


test('bad auth', async () => {
    const loginRes = await request(app).put('/api/auth').send(testUser);
    const testUserAuthToken = loginRes.body.token;
    const badAuthRes = await request(app).put(`/api/auth/${testUserID}`).set('Authorization', `Bearer ${testUserAuthToken}bad`).send(testUser);
    
    expect(badAuthRes.status).toBe(401);
})

test('regiser but missing info', async () => {
    const registerRes = await request(app).post('/api/auth').send({ name: 'pizza diner', email: '', password: 'a' });
    expect(registerRes.status).toBe(400);

})
