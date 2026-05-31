import sgMail from '@sendgrid/mail';
import { logger } from '../utils/logger.js';

export class MailService {
  private static isConfigured = false;
  private static defaultFrom = 'noreply@recurra.io';

  public static init() {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (apiKey && apiKey.startsWith('SG.')) {
      sgMail.setApiKey(apiKey);
      this.isConfigured = true;
      logger.info('MailService initialized with SendGrid');
    } else {
      logger.warn('SENDGRID_API_KEY missing or invalid. MailService falling back to console logging (Development Mode).');
    }
    
    if (process.env.SENDGRID_FROM_EMAIL) {
      this.defaultFrom = process.env.SENDGRID_FROM_EMAIL;
    }
  }

  public static async sendEmail(to: string, subject: string, htmlContent: string) {
    if (!this.isConfigured) {
      logger.info(`\n [DEV MODE - EMAIL MOCKED]\nTo: ${to}\nSubject: ${subject}\nContent:\n${htmlContent.replace(/<[^>]+>/g, '')}\n`);
      return;
    }

    try {
      await sgMail.send({
        to,
        from: this.defaultFrom,
        subject,
        html: htmlContent,
      });
      logger.info(`Email sent successfully to ${to}`, { subject });
    } catch (error) {
      logger.error('Failed to send email via SendGrid', { error: (error as Error).message });
    }
  }

  public static async sendSubscriptionCreatedEmail(to: string, planName: string, amountStr: string) {
    const subject = `Welcome to your ${planName} subscription!`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
        <h2 style="color: #333;">Subscription Confirmed</h2>
        <p>Hi there,</p>
        <p>Your subscription to <strong>${planName}</strong> was created successfully.</p>
        <p><strong>Amount:</strong> ${amountStr}</p>
        <p>You can manage your automated payments anytime in your Recurra Dashboard.</p>
        <br/>
        <p>Thanks for using Recurra!</p>
      </div>
    `;
    await this.sendEmail(to, subject, html);
  }

  public static async sendSubscriptionCancelledEmail(to: string, planName: string) {
    const subject = `Subscription Cancelled: ${planName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
        <h2 style="color: #333;">Subscription Cancelled</h2>
        <p>Hi there,</p>
        <p>Your recurring payments to <strong>${planName}</strong> have been stopped.</p>
        <p>You will not be billed again for this plan.</p>
        <br/>
        <p>Thanks for using Recurra!</p>
      </div>
    `;
    await this.sendEmail(to, subject, html);
  }

  public static async sendPaymentExecutedEmail(to: string, planName: string, amountStr: string, paymentNumber: number, nextPaymentDate: string) {
    const subject = `Payment Processed: ${planName} (#${paymentNumber})`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
        <h2 style="color: #10b981;">Payment Successful</h2>
        <p>Hi there,</p>
        <p>Your recurring payment for <strong>${planName}</strong> has been processed successfully.</p>
        <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 6px 0; color: #6b7280;">Amount</td><td style="padding: 6px 0; text-align: right; font-weight: 600;">${amountStr}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280;">Payment #</td><td style="padding: 6px 0; text-align: right; font-weight: 600;">${paymentNumber}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280;">Next Payment</td><td style="padding: 6px 0; text-align: right; font-weight: 600;">${nextPaymentDate}</td></tr>
          </table>
        </div>
        <p style="color: #6b7280; font-size: 13px;">This payment was automated by the Recurra smart contract on the Stellar network.</p>
        <br/>
        <p>Thanks for using Recurra!</p>
      </div>
    `;
    await this.sendEmail(to, subject, html);
  }

  public static async sendPaymentFailedEmail(to: string, planName: string, reason: string) {
    const subject = `Payment Failed: ${planName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
        <h2 style="color: #ef4444;">Payment Failed</h2>
        <p>Hi there,</p>
        <p>We were unable to process your recurring payment for <strong>${planName}</strong>.</p>
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; color: #dc2626;"><strong>Reason:</strong> ${reason || 'Insufficient balance'}</p>
        </div>
        <p><strong>What to do:</strong></p>
        <ul style="color: #374151;">
          <li>Ensure your wallet has sufficient USDC balance</li>
          <li>Check that your authorization to the merchant is still active</li>
          <li>Visit your Recurra Dashboard to review your subscription</li>
        </ul>
        <p style="color: #6b7280; font-size: 13px;">If this issue persists, your subscription may be paused until payment is resolved.</p>
        <br/>
        <p>Thanks for using Recurra!</p>
      </div>
    `;
    await this.sendEmail(to, subject, html);
  }

  public static async sendSubscriptionExpiringEmail(to: string, planName: string, paymentsRemaining: number) {
    const subject = `Subscription Expiring Soon: ${planName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
        <h2 style="color: #f59e0b;">Subscription Expiring</h2>
        <p>Hi there,</p>
        <p>Your subscription to <strong>${planName}</strong> has <strong>${paymentsRemaining} payment${paymentsRemaining === 1 ? '' : 's'}</strong> remaining.</p>
        <p>After the final payment, your subscription will expire automatically.</p>
        <p>To continue using the service, you can renew your subscription from the Recurra platform.</p>
        <br/>
        <p>Thanks for using Recurra!</p>
      </div>
    `;
    await this.sendEmail(to, subject, html);
  }
}

// Initialize on load
MailService.init();
