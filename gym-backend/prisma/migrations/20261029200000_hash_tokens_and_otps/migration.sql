-- Refresh tokens: keep every live session working by hashing the stored tokens
-- in place (same SHA-256 hex the app now computes from the cookie).
ALTER TABLE "refresh_tokens" RENAME COLUMN "token" TO "tokenHash";
UPDATE "refresh_tokens" SET "tokenHash" = encode(sha256(convert_to("tokenHash", 'UTF8')), 'hex');
ALTER INDEX "refresh_tokens_token_key" RENAME TO "refresh_tokens_tokenHash_key";

-- OTPs: the keyed hash needs the server secret, which SQL doesn't have. Codes only
-- live 10 minutes anyway, so retire any open ones and wipe the plaintext.
UPDATE "otp_codes" SET "consumedAt" = COALESCE("consumedAt", NOW()), "code" = '';
ALTER TABLE "otp_codes" RENAME COLUMN "code" TO "codeHash";
