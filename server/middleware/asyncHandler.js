/**
 * A wrapper for async route handlers to catch errors and forward them to the global error handler.
 * This prevents the server from crashing or hanging in Express 4 when an async operation fails.
 */
const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
