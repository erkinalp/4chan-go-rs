import { Controller, Post, Body, UseGuards, Get, Req } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { LoginDto, RegisterDto, RefreshDto } from "./auth.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @ApiOperation({ summary: "Authenticate and receive tokens" })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
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
}
