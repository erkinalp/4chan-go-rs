import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common';
import { GNAPService, GNAPGrantRequest, GNAPGrantResponse } from '../auth/gnap.service';
import { GNAPGuard } from '../auth/gnap.guard';
import { CurrentUser } from '../auth/gnap.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly gnapService: GNAPService) {}

  @Post('grant')
  async requestGrant(@Body() grantRequest: GNAPGrantRequest): Promise<GNAPGrantResponse> {
    return this.gnapService.requestGrant(grantRequest);
  }

  @Post('continue')
  @UseGuards(GNAPGuard)
  async continueGrant(@Body() body: { interact_ref?: string }): Promise<GNAPGrantResponse> {
    return this.gnapService.continueGrant('continue-token', body.interact_ref);
  }

  @Post('introspect')
  @UseGuards(GNAPGuard)
  async introspectToken(@CurrentUser() user: any) {
    return user;
  }

  @Get('user')
  @UseGuards(GNAPGuard)
  async getCurrentUser(@CurrentUser() user: any) {
    return user;
  }
}
