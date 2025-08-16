import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GNAPUserContext } from './gnap.service';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): GNAPUserContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
