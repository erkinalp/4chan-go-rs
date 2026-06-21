import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Ip,
  Delete,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { CaptchaService } from "./captcha.service";
import { VerifyCaptchaDto } from "./captcha.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard, Roles } from "../auth/roles.guard";
import { Role } from "@prisma/client";

@ApiTags("captcha")
@Controller("captcha")
export class CaptchaController {
  constructor(private readonly captchaService: CaptchaService) {}

  @Get()
  @ApiOperation({ summary: "Generate a new captcha challenge" })
  generate(@Ip() ip: string) {
    return this.captchaService.generate(ip);
  }

  @Post("verify")
  @ApiOperation({ summary: "Verify a captcha solution" })
  verify(@Body() dto: VerifyCaptchaDto) {
    return this.captchaService.verify(dto.id, dto.solution);
  }

  @Delete("cleanup")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Clean up expired captchas (admin only)" })
  cleanup() {
    return this.captchaService.cleanup();
  }
}
