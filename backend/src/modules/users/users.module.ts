import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';

/** User profile endpoints (GET /api/me). */
@Module({
  controllers: [UsersController],
})
export class UsersModule {}
