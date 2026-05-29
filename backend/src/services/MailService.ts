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
}

// Initialize on load
MailService.init();
