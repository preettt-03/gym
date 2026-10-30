// The code must never reach the client once a real SMS provider is set, or in production.
describe('SMS test-mode guard', () => {
  const load = (env: Record<string, string>) => {
    jest.resetModules();
    Object.assign(process.env, env);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@/lib/sms') as typeof import('@/lib/sms');
  };
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('returns the code only in development without a provider', () => {
    expect(load({ NODE_ENV: 'development', SMS_PROVIDER: '' }).devCode('123456')).toEqual({ devCode: '123456' });
  });

  it('never returns it with a provider configured', () => {
    expect(load({ NODE_ENV: 'development', SMS_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 't', TWILIO_FROM_NUMBER: '+10000000000' }).devCode('123456')).toEqual({});
  });

  it('never returns it in production', () => {
    expect(load({ NODE_ENV: 'production', SMS_PROVIDER: '' }).devCode('123456')).toEqual({});
  });
});
