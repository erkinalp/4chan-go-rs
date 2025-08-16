import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GNAPService } from './gnap.service';

@Injectable()
export class GNAPGuard implements CanActivate {
  constructor(private gnapService: GNAPService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header required');
    }

    const tokenParts = authHeader.split(' ');
    if (tokenParts.length !== 2 || tokenParts[0] !== 'GNAP') {
      throw new UnauthorizedException('Invalid authorization format');
    }

    const token = tokenParts[1];
    try {
      const userContext = await this.gnapService.validateToken(token);
      request.user = userContext;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
