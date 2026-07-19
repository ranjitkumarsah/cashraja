import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseAdminVerifier } from './firebase/firebase-admin-verifier';
import { FIREBASE_VERIFIER, FirebaseVerifier } from './firebase/firebase-verifier';
import { MockFirebaseVerifier } from './firebase/mock-firebase-verifier';
import { GEOIP_SERVICE, MockGeoipService } from './geoip/geoip.service';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: FIREBASE_VERIFIER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): FirebaseVerifier =>
        config.get<string>('FIREBASE_VERIFIER') === 'firebase'
          ? new FirebaseAdminVerifier(config)
          : new MockFirebaseVerifier(),
    },
    { provide: GEOIP_SERVICE, useClass: MockGeoipService },
  ],
  exports: [AuthService],
})
export class AuthModule {}
