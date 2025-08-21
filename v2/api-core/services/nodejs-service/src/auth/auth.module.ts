import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GNAPService } from './gnap.service';
import { GNAPGuard } from './gnap.guard';

@Module({
  imports: [ConfigModule],
  providers: [GNAPService, GNAPGuard],
  exports: [GNAPService, GNAPGuard],
})
export class AuthModule {}
