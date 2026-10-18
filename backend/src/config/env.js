import 'dotenv/config';

for (const k of [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET',
  'TOKEN_ENC_KEY'
]) {
  if (!process.env[k]) {
    throw new Error(`Missing environment variable: ${k}`);
  }
}

if (!/^[0-9a-f]{64}$/i.test(process.env.TOKEN_ENC_KEY)) {
  throw new Error('TOKEN_ENC_KEY must be 64 hex characters');
}

export const env = {
  port: Number(process.env.PORT || 4000),

  isProd: process.env.NODE_ENV === 'production',

  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  // MySQL
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  },

  jwtSecret: process.env.JWT_SECRET,

  encKey: Buffer.from(process.env.TOKEN_ENC_KEY, 'hex'),

  anthropicKey: process.env.ANTHROPIC_API_KEY,

  aiModel: process.env.AI_MODEL || 'claude-sonnet-4-6',

  tavilyKey: process.env.TAVILY_API_KEY,

  ms: {
    clientId: process.env.MS_CLIENT_ID,
    clientSecret: process.env.MS_CLIENT_SECRET,
    redirectUri:
      process.env.MS_REDIRECT_URI ||
      'http://localhost:4000/api/v1/onenote/callback'
  }
};