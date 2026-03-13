const requiredVars = ['PORT', 'MONGO_URI', 'JWT_SECRET', 'JWT_EXPIRES_IN', 'CLIENT_URL'];

const missing = requiredVars.filter(v => !process.env[v]);

if (missing.length > 0) {
  console.error(`Missing required env var: ${missing[0]}`);
  process.exit(1);
}

module.exports = {
  PORT: process.env.PORT,
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
  CLIENT_URL: process.env.CLIENT_URL
};
