const EndpointHelper = require('../src/endpointHelper');


test('StatusCodeError', () => {
    const error = new EndpointHelper.StatusCodeError('error message', 404);
    expect(error.message).toBe('error message');
    expect(error.statusCode).toBe(404);
})
