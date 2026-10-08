import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { HealthService } from "./health.service";

// These routes are excluded from the global API prefix (see setGlobalPrefix
// in index.ts) so k8s probes and docker-compose healthchecks can hit them at
// the conventional root paths /health and /ready.
@ApiTags("health")
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get("health")
  @ApiOperation({ summary: "Liveness check" })
  check() {
    return this.healthService.check();
  }

  @Get("ready")
  @ApiOperation({ summary: "Readiness probe (includes DB connectivity)" })
  ready() {
    return this.healthService.ready();
  }
}
