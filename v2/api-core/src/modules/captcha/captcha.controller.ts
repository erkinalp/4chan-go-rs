import { Controller, Get, Post, Body, Ip } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { CaptchaService } from "./captcha.service";
import { VerifyCaptchaDto } from "./captcha.dto";

@ApiTags("captcha")
@Controller("captcha")
export class CaptchaController {
  constructor(private readonly captchaService: CaptchaService) {}

  @Get()
  @ApiOperation({ summary: "Generate a new captcha challenge" })
  generate(@Ip() ip: string) {
    return this.captchaService.generate(ip);
  }

  @Post("validate")
  @ApiOperation({ summary: "Validate a captcha solution" })
  validate(@Body() dto: VerifyCaptchaDto) {
    return this.captchaService.verify(dto.id, dto.solution);
  }
}
