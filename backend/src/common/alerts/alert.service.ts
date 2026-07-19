import { Injectable, Logger } from '@nestjs/common';

export interface AlertPayload {
  type: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Pluggable alert sink (reconciliation drift, fraud spikes, ...).
 * Bind ALERT_SERVICE to a concrete implementation; jobs depend only on the interface.
 */
export interface AlertService {
  alert(payload: AlertPayload): Promise<void>;
}

export const ALERT_SERVICE = 'ALERT_SERVICE';

/** Default sink: structured log at error level. */
@Injectable()
export class ConsoleAlertService implements AlertService {
  private readonly logger = new Logger('Alert');

  async alert(payload: AlertPayload): Promise<void> {
    this.logger.error({ alert: payload.type, message: payload.message, ...payload.details });
  }
}

/** Slack-compatible webhook sink; falls back to logging when the POST fails. */
@Injectable()
export class WebhookAlertService implements AlertService {
  private readonly logger = new Logger('Alert');

  constructor(private readonly webhookUrl: string) {}

  async alert(payload: AlertPayload): Promise<void> {
    this.logger.error({ alert: payload.type, message: payload.message, ...payload.details });
    try {
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: `[${payload.type}] ${payload.message}`,
          details: payload.details ?? {},
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Alert webhook responded ${res.status}`);
      }
    } catch (err) {
      this.logger.warn(`Alert webhook delivery failed: ${(err as Error).message}`);
    }
  }
}
