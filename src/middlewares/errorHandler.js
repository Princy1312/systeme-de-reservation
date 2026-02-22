/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Erreur interne du serveur';

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    message = `Ce ${field} est déjà utilisé.`;
    statusCode = 400;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    message = errors.join(', ');
    statusCode = 400;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    message = 'Token invalide.';
    statusCode = 401;
  }

  if (err.name === 'TokenExpiredError') {
    message = 'Token expiré. Veuillez vous reconnecter.';
    statusCode = 401;
  }

  // Multer error
  if (err.code === 'LIMIT_FILE_SIZE') {
    message: 'Fichier trop volumineux. Taille maximale : 5 MB.';
    statusCode = 400;
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * 404 Not Found handler
 */
const notFound = (req, res, next) => {
  const error = new Error(`Route non trouvée : ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

module.exports = { errorHandler, notFound };
