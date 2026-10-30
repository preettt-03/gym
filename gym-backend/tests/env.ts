// Runs before any module loads. Suites make far more auth requests from one
// "IP" than real traffic would; the limiter itself isn't under test here.
process.env.AUTH_RATE_LIMIT_MAX ??= '1000';
// Fail fast in tests if the real Gemini API stalls (it sometimes never answers).
process.env.GEMINI_TIMEOUT_MS ??= '8000';
