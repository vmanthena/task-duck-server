export const MINIMAL_ENV = {
  BCRYPT_SALT: '',
  PASSWORD_VERIFIER: '',
  ANTHROPIC_API_KEY: '',
  OPENAI_API_KEY: '',
  GEMINI_API_KEY: '',
  JWT_SECRET: 'test-secret-key-for-jwt-signing-1234',
  SESSION_HOURS: '24',
  PORT: '0',
};

export const MOCK_PROVIDER_ENV = {
  ...MINIMAL_ENV,
  // No API keys → mock provider auto-available
};

export const FULL_AUTH_ENV = {
  ...MINIMAL_ENV,
  PASSWORD_VERIFIER: '$2a$15$someverifierhash',
  BCRYPT_SALT: '$2a$15$abcdefghijklmnopqrstuv',
  BCRYPT_COST: '15',
};

export const WITH_ANTHROPIC_ENV = {
  ...MINIMAL_ENV,
  ANTHROPIC_API_KEY: 'sk-ant-test-key-1234567890',
};
