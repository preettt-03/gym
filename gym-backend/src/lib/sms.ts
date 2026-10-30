import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { AppError } from '@/middlewares/errorHandler';

export const isSmsConfigured =
  (env.SMS_PROVIDER === 'msg91' && Boolean(env.MSG91_AUTH_KEY && env.MSG91_OTP_TEMPLATE_ID)) ||
  (env.SMS_PROVIDER === 'twilio' && Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER));

/** Mobile sign-in works when a provider is set up — or in dev/test, where codes go to the log. */
export const isPhoneAuthAvailable = isSmsConfigured || env.NODE_ENV !== 'production';

/** Sends a one-time code to an E.164 number. Throws 502 if the provider rejects it. */
export async function sendOtpSms(phone: string, code: string) {
  if (!isSmsConfigured) {
    if (env.NODE_ENV === 'production') throw new AppError('Mobile sign-in is not configured', 503);
    logger.info(`[sms:stub] to=${phone} code=${code}`);
    return;
  }

  const res =
    env.SMS_PROVIDER === 'msg91'
      ? // MSG91 Flow API: the DLT template holds the wording; we pass the code as ##otp##.
        await fetch('https://control.msg91.com/api/v5/flow', {
          method: 'POST',
          headers: { authkey: env.MSG91_AUTH_KEY!, 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ template_id: env.MSG91_OTP_TEMPLATE_ID, short_url: '0', recipients: [{ mobiles: phone.replace('+', ''), otp: code }] }),
        })
      : await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
          method: 'POST',
          headers: {
            authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ To: phone, From: env.TWILIO_FROM_NUMBER!, Body: `${code} is your King's Fitness code. It expires in 10 minutes. Don't share it.` }),
        });

  if (!res.ok) {
    logger.error('SMS send failed', { provider: env.SMS_PROVIDER, status: res.status, body: await res.text().catch(() => '') });
    throw new AppError("Couldn't send the SMS right now. Try again in a minute.", 502);
  }
}
