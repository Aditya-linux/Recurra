import { logger } from '../utils/logger.js';

export class WhatsAppService {
  private static readonly API_VERSION = 'v19.0';
  private static readonly BASE_URL = `https://graph.facebook.com/${this.API_VERSION}`;

  /**
   * Send a WhatsApp template message for a new subscription
   * @param toPhoneNumber The recipient's phone number in international format without the '+' (e.g., '14155552671')
   * @param templateName The name of the approved template in the Meta Dashboard
   * @param templateParams Array of string parameters to inject into the template {{1}}, {{2}}, etc.
   */
  public static async sendSubscriptionReceipt(
    toPhoneNumber: string,
    templateName: string,
    templateParams: string[]
  ): Promise<boolean> {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      logger.warn('WhatsAppService: Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID. Skipping message.');
      return false;
    }

    // Format phone number: remove any non-digit characters
    const cleanNumber = toPhoneNumber.replace(/\D/g, '');

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanNumber,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: 'en_US', // Modify if using a different language code
        },
        components: [
          {
            type: 'body',
            parameters: templateParams.map(param => ({
              type: 'text',
              text: param
            }))
          }
        ]
      }
    };

    try {
      const url = `${this.BASE_URL}/${phoneNumberId}/messages`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json() as any;

      if (!response.ok) {
        logger.error('WhatsAppService: Failed to send message via Meta API', {
          status: response.status,
          error: data.error || data,
        });
        return false;
      }

      logger.info('WhatsAppService: Message sent successfully', {
        messageId: data.messages?.[0]?.id,
        to: cleanNumber
      });
      return true;

    } catch (error: any) {
      logger.error('WhatsAppService: Network error', { error: error.message });
      return false;
    }
  }
}
