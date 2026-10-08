import { Controller, Post, Body, UseGuards, Get, Req } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import {
  LoginDto,
  RegisterDto,
  RefreshDto,
  Verify2FADto,
  TwoFactorChallengeDto,
  PasswordConfirmDto,
} from "./auth.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @ApiOperation({
    summary: "Authenticate; returns tokens, or a 2FA challenge when enabled",
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post("2fa/challenge")
  @ApiOperation({
    summary: "Complete a login paused for 2FA (TOTP or backup code)",
  })
  challenge2FA(@Body() dto: TwoFactorChallengeDto) {
    return this.authService.verifyTwoFactorChallenge(
      dto.challenge_token,
      dto.code,
    );
  }

  @Post("register")
  @ApiOperation({ summary: "Register a new user account" })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.username, dto.email, dto.password);
  }

  @Post("refresh")
  @ApiOperation({ summary: "Refresh an access token" })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refresh_token);
  }

  @Post("logout")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Invalidate refresh token" })
  logout(@Body() dto: RefreshDto) {
    return this.authService.logout(dto.refresh_token);
  }

  @Get("me")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get current authenticated user" })
  me(@Req() req: any) {
    return req.user;
  }

  @Post("2fa/enable")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Enable 2FA for the authenticated user" })
  enable2FA(@Req() req: any) {
    return this.authService.enable2FA(req.user.id);
  }

  @Post("2fa/verify")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Verify a 2FA code; returns backup codes on first activation",
  })
  verify2FA(@Req() req: any, @Body() dto: Verify2FADto) {
    return this.authService.verify2FA(req.user.id, dto.code);
  }

  @Post("2fa/disable")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Disable 2FA (requires password); revokes all sessions",
  })
  disable2FA(@Req() req: any, @Body() dto: PasswordConfirmDto) {
    return this.authService.disable2FA(req.user.id, dto.password);
  }

  @Post("2fa/backup-codes")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Regenerate backup codes (requires password)",
  })
  regenerateBackupCodes(@Req() req: any, @Body() dto: PasswordConfirmDto) {
    return this.authService.regenerateBackupCodes(req.user.id, dto.password);
  }
}
