import { Controller, Get, Post, Body, Ip } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { CaptchaService } from "./captcha.service";
import { PowTokenService } from "./pow-token.service";
import {
  VerifyCaptchaDto,
  RedeemPowChallengeDto,
  VerifyPowTokenDto,
} from "./captcha.dto";

@ApiTags("captcha")
@Controller("captcha")
export class CaptchaController {
  constructor(
    private readonly captchaService: CaptchaService,
    private readonly powTokenService: PowTokenService,
  ) {}

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

  @Get("pow/challenge")
  @ApiOperation({
    summary: "Issue a proof-of-work challenge (Privacy-Pass-style)",
  })
  powChallenge() {
    return this.powTokenService.issueChallenge();
  }

  @Post("pow/redeem")
  @ApiOperation({
    summary: "Submit a PoW solution and receive a single-use token",
  })
  powRedeem(@Body() dto: RedeemPowChallengeDto) {
    return this.powTokenService.redeemChallenge(dto.challenge_id, dto.nonce);
  }

  @Post("pow/verify")
  @ApiOperation({
    summary: "Verify and consume a PoW token (single-use)",
  })
  async powVerify(@Body() dto: VerifyPowTokenDto) {
    const valid = await this.powTokenService.verifyPowToken(dto.token);
    if (!valid) {
      return { valid: false };
    }
    return { valid: true };
  }
}
