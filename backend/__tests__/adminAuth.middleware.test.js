process.env.NODE_ENV = 'test';
process.env.ADMIN_SECRET_KEY = 'test-admin-secret-long-enough';

const { adminAuthMiddleware } = require('../src/middleware/adminAuth.middleware');

function invoke(key) {
  const req = { headers: { 'x-admin-key': key } };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  const next = jest.fn();
  adminAuthMiddleware(req, res, next);
  return { res, next };
}

describe('adminAuthMiddleware', () => {
  test('accepts the configured admin key', () => {
    const { next } = invoke(process.env.ADMIN_SECRET_KEY);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('rejects an invalid admin key', () => {
    const { res, next } = invoke('wrong-key');
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ success: false, message: 'Forbidden' });
  });
});
