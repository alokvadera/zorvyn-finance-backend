const { ZodError } = require('zod');

function validationErrorHandler(err, _req, res, next) {
  if (err instanceof ZodError) {
    const details = err.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return res.status(400).json({ error: 'Validation failed', details });
  }
  next(err);
}

module.exports = { validationErrorHandler };
