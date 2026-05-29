import crypto from 'crypto';

/**
 * Recurra Merchant SDK
 * 
 * Utility functions for merchants to securely integrate with Recurra.
 */

export const RecurraMerchantSdk = {
  /**
   * Verifies the cryptographic signature of a Recurra webhook payload.
   * 
   * @param payloadString The raw JSON string of the request body.
   * @param signatureHeader The value of the 'Recurra-Signature' header.
   * @param secret The webhook signing secret provided in the Recurra dashboard.
   * @returns boolean True if the signature is valid, false otherwise.
   */
  verifyWebhookSignature: (payloadString: string, signatureHeader: string, secret: string): boolean => {
    if (!signatureHeader || !payloadString || !secret) {
      return false;
    }

    try {
      // The signature header is expected to be in the format: sha256=HEX_STRING
      const parts = signatureHeader.split('=');
      if (parts.length !== 2 || parts[0] !== 'sha256') {
        return false;
      }

      const providedSignature = parts[1];

      // Compute the expected HMAC using the raw payload string and the secret
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payloadString);
      const expectedSignature = hmac.digest('hex');

      // Use a constant-time comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(providedSignature || '')
      );
    } catch (e) {
      return false;
    }
  },

  /**
   * Helper function to sign a payload (Used internally by Recurra)
   */
  signPayload: (payloadString: string, secret: string): string => {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payloadString);
    return `sha256=${hmac.digest('hex')}`;
  }
};
