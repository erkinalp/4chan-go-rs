import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Request, Response } from "express";
import { Observable, finalize } from "rxjs";
import { MetricsService } from "./metrics.service";

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const endTimer = this.metricsService.httpRequestDuration.startTimer();

    return next.handle().pipe(
      finalize(() => {
        const response = context.switchToHttp().getResponse<Response>();
        // Use the route pattern (e.g. /api/v1/posts/:id) as the endpoint
        // label to bound cardinality; fall back to the raw path segment.
        const route = request.route as { path?: string } | undefined;
        const endpoint =
          (typeof route?.path === "string" && route.path) ||
          request.path ||
          "unknown";

        endTimer({ method: request.method, endpoint });
        this.metricsService.httpRequestsTotal
          .labels(request.method, endpoint, String(response.statusCode))
          .inc();
      }),
    );
  }
}
