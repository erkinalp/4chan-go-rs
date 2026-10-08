import { Module } from "@nestjs/common";
import { CaptchaController } from "./captcha.controller";
import { CaptchaService } from "./captcha.service";
import { PowTokenService } from "./pow-token.service";

@Module({
  controllers: [CaptchaController],
  providers: [CaptchaService, PowTokenService],
  exports: [CaptchaService, PowTokenService],
})
export class CaptchaModule {}
