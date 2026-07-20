import { Global, Module } from '@nestjs/common';
import { AppConfigService } from './app-config.service';

/** Global read access to versioned app_config (admin-tunable settings). */
@Global()
@Module({
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
