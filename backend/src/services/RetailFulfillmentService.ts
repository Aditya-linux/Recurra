import { logger } from '../utils/logger.js';
import { MailService } from './MailService.js';
import crypto from 'crypto';

export class RetailFulfillmentService {
  /**
   * Mocks a call to a gift card API (e.g. Bitrefill) and emails the user the activation code.
   * @param planName The name of the predefined retail plan (e.g. Spotify Premium)
   * @param userEmail The user's email address
   */
  static async fulfillOrder(planName: string, userEmail: string) {
    try {
      logger.info(`[RetailFulfillmentService] Initiating fulfillment for ${planName} to ${userEmail}`);
      
      // Simulate API call to Bitrefill or Tremendous
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generate a mock gift card / activation code
      const mockCode = `${planName.substring(0, 4).toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      
      logger.info(`[RetailFulfillmentService] Successfully purchased ${planName} code from vendor: ${mockCode}`);
      
      // Email the code to the user
      const subject = `Your ${planName} Subscription is Active!`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e2e2; border-radius: 10px;">
          <h2 style="color: #1DB954;">Subscription Confirmed</h2>
          <p>Hi there,</p>
          <p>Thank you for subscribing to <strong>${planName}</strong> via Recurra.</p>
          <p>Your payment has been successfully processed on the Stellar network. Here is your activation code:</p>
          <div style="background-color: #f3f3f3; padding: 15px; text-align: center; border-radius: 5px; font-size: 24px; font-weight: bold; letter-spacing: 2px; margin: 20px 0;">
            ${mockCode}
          </div>
          <p>To redeem this code, please visit the official ${planName} website and enter it in the gift card redemption section.</p>
          <p>Enjoy your subscription!</p>
          <p style="color: #888; font-size: 12px; margin-top: 40px;">Powered by Recurra Trustless Automation</p>
        </div>
      `;
      
      await MailService.sendEmail(userEmail, subject, html);
      logger.info(`[RetailFulfillmentService] Email sent successfully to ${userEmail}`);
      
    } catch (error: any) {
      logger.error(`[RetailFulfillmentService] Fulfillment failed for ${planName}`, { error: error.message });
      // In a real scenario, you would trigger an alert to an admin or a refund process here.
    }
  }
}
