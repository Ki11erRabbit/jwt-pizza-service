const EndpointHelper = require('../src/endpointHelper');


test('StatusCodeError', () => {
    const error = new EndpointHelper.StatusCodeError('error message', 404);
    expect(error.message).toBe('error message');
    expect(error.statusCode).toBe(404);
})

test('asyncHandler', async () => {
    const fn = jest.fn();
    const req = {};
    const res = {};
    const next = jest.fn();
    const handler = EndpointHelper.asyncHandler(fn);
    await handler(req, res, next);
    expect(fn).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
})
