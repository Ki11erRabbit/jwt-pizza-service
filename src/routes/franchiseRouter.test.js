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


test('create franchise', async () => {
    const adminUser = await createAdminUser();
    const franchise = { name: 'franchise' + randomName(), admins: [adminUser] };
    const loginRes = await request(app).put('/api/auth').send(adminUser);
    testUserAuthToken = loginRes.body.token;
    const createFranchiseRes = await request(app).post('/api/franchise').set('Authorization', `Bearer ${testUserAuthToken}`).send(franchise);

    expect(createFranchiseRes.status).toBe(200);
})

test('create franchise store', async () => {
    const adminUser = await createAdminUser();
    const franchise = { name: 'franchise with store' + randomName(), admins: [adminUser] };
    const loginRes = await request(app).put('/api/auth').send(adminUser);
    const testUserAuthToken = loginRes.body.token;
    const createFranchiseRes = await request(app).post('/api/franchise').set('Authorization', `Bearer ${testUserAuthToken}`).send(franchise);

    const franchiseId = createFranchiseRes.body.id;
    const createStoreRes = await request(app).post(`/api/franchise/${franchiseId}/store`).set('Authorization', `Bearer ${testUserAuthToken}`).send({ name: 'store' });

    expect(createStoreRes.status).toBe(200);
})

test('delete franchise', async () => {
    const adminUser = await createAdminUser();
    const franchise = { name: 'franchise' + randomName(), admins: [adminUser] };
    const loginRes = await request(app).put('/api/auth').send(adminUser);
    const testUserAuthToken = loginRes.body.token;
    const createFranchiseRes = await request(app).post('/api/franchise').set('Authorization', `Bearer ${testUserAuthToken}`).send(franchise);

    expect(createFranchiseRes.status).toBe(200);
    
    const franchiseId = createFranchiseRes.body.id;
    const deleteFranchiseRes = await request(app).delete(`/api/franchise/${franchiseId}`).set('Authorization', `Bearer ${testUserAuthToken}`);

    expect(deleteFranchiseRes.status).toBe(200);
})


test('get user franchise', async () => {
    const adminUser = await createAdminUser();
    const franchise = { name: 'franchise' + randomName(), admins: [adminUser] };
    const loginRes = await request(app).put('/api/auth').send(adminUser);
    const testUserAuthToken = loginRes.body.token;
    const createFranchiseRes = await request(app).post('/api/franchise').set('Authorization', `Bearer ${testUserAuthToken}`).send(franchise);

    expect(createFranchiseRes.status).toBe(200);

    const getFranchiseRes = await request(app).get(`/api/franchise/${adminUser.id}`).set('Authorization', `Bearer ${testUserAuthToken}`);

    expect(getFranchiseRes.status).toBe(200);
})


test('delete franchise store', async () => {
    const adminUser = await createAdminUser();
    const franchise = { name: 'franchise with store' + randomName(), admins: [adminUser] };
    const loginRes = await request(app).put('/api/auth').send(adminUser);
    const testUserAuthToken = loginRes.body.token;
    const createFranchiseRes = await request(app).post('/api/franchise').set('Authorization', `Bearer ${testUserAuthToken}`).send(franchise);

    const franchiseId = createFranchiseRes.body.id;
    const createStoreRes = await request(app).post(`/api/franchise/${franchiseId}/store`).set('Authorization', `Bearer ${testUserAuthToken}`).send({ name: 'store' });

    expect(createStoreRes.status).toBe(200);

    const storeId = createStoreRes.body.id;
    const deleteStoreRes = await request(app).delete(`/api/franchise/${franchiseId}/store/${storeId}`).set('Authorization', `Bearer ${testUserAuthToken}`);

    expect(deleteStoreRes.status).toBe(200);
})

test('get franchises', async () => {

    const loginRes = await request(app).get('/api/franchise');

    expect(loginRes.status).toBe(200);
})

test('get user franchises empty', async () => {
    const loginRes = await request(app).put('/api/auth').send(testUser);
    testUserAuthToken = loginRes.body.token;

    const getRes = await request(app).get(`/api/franchise/${testUserID}`).set('Authorization', `Bearer ${testUserAuthToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body).toMatchObject([]);

})


test('get user franchises', async () => {
    const adminUser = await createAdminUser();
    const franchise = { name: 'franchise' + randomName(), admins: [adminUser] };
    const loginRes = await request(app).put('/api/auth').send(adminUser);
    const testUserAuthToken = loginRes.body.token;
    const createFranchiseRes = await request(app).post('/api/franchise').set('Authorization', `Bearer ${testUserAuthToken}`).send(franchise);
    expect(createFranchiseRes.status).toBe(200);
    const getRes = await request(app).get(`/api/franchise/${adminUser.id}`).set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(getRes.status).toBe(200);
    //expect(getRes.body.length).toBe(1);
})

/*test('get user franchises fail', async () => {
    const adminUser = await createAdminUser();
    const franchise = { name: 'franchise' + randomName(), admins: [adminUser] };
    const loginRes = await request(app).put('/api/auth').send(adminUser);
    const testUserAuthToken = loginRes.body.token;
    const createFranchiseRes = await request(app).post('/api/franchise').set('Authorization', `Bearer ${testUserAuthToken}`).send(franchise);
    expect(createFranchiseRes.status).toBe(200);
    const getRes = await request(app).get(`/api/franchise/${adminUser.id + 1}`).set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body).toMatchObject([]);
})*/



test('create franchise not admin', async () => {
    const loginRes = await request(app).put('/api/auth').send(testUser);
    const testUserAuthToken = loginRes.body.token;
    const franchise = { name: 'franchise' + randomName() + randomName(), admins: [testUser] };
    const createRes = await request(app).post('/api/franchise').set('Authorization', `Bearer ${testUserAuthToken}`).send(franchise);
    expect(createRes.status).toBe(403);
    expect(createRes.body.message).toBe('unable to create a franchise');
})


test('delete franchise not admin', async () => {
    const loginRes = await request(app).put('/api/auth').send(testUser);
    const testUserAuthToken = loginRes.body.token;
    
    const adminUser = await createAdminUser();
    const adminLoginRes = await request(app).put('/api/auth').send(adminUser);
    const adminTestUserAuthToken = adminLoginRes.body.token;
    const franchise = { name: 'franchise' + randomName(), admins: [adminUser] };
    const createFranchiseRes = await request(app).post('/api/franchise').set('Authorization', `Bearer ${adminTestUserAuthToken}`).send(franchise);

    expect(createFranchiseRes.status).toBe(200);
    const franchiseId = createFranchiseRes.body.id;

    const deleteRes = await request(app).delete(`/api/franchise/${franchiseId}`).set('Authorization', `Bearer ${testUserAuthToken}`);

    expect(deleteRes.body.message).toBe('unable to delete a franchise');
    expect(deleteRes.status).toBe(403);
})


test('create franchise store not admin', async () => {
    const loginRes = await request(app).put('/api/auth').send(testUser);
    const testUserAuthToken = loginRes.body.token;
    
    const adminUser = await createAdminUser();
    const adminLoginRes = await request(app).put('/api/auth').send(adminUser);
    const adminTestUserAuthToken = adminLoginRes.body.token;
    const franchise = { name: 'franchise' + randomName(), admins: [adminUser] };
    const createFranchiseRes = await request(app).post('/api/franchise').set('Authorization', `Bearer ${adminTestUserAuthToken}`).send(franchise);

    expect(createFranchiseRes.status).toBe(200);
    const franchiseId = createFranchiseRes.body.id;

    const createStoreRes = await request(app).post(`/api/franchise/${franchiseId}/store`).set('Authorization', `Bearer ${testUserAuthToken}`).send({ name: 'store' });

    expect(createStoreRes.status).toBe(403);
    expect(createStoreRes.body.message).toBe('unable to create a store');
})
