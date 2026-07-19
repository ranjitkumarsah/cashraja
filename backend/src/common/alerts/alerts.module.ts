import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ALERT_SERVICE, AlertService, ConsoleAlertService, WebhookAlertService } from './alert.service';

@Global()
@Module({
  providers: [
    {
      provide: ALERT_SERVICE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): AlertService => {
        const webhookUrl = config.get<string>('ALERT_WEBHOOK_URL') ?? '';
        return webhookUrl !== ''
          ? new WebhookAlertService(webhookUrl)
          : new ConsoleAlertService();
      },
    },
  ],
  exports: [ALERT_SERVICE],
})
export class AlertsModule {}
