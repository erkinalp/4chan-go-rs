import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { HealthService } from "./health.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: "Basic health check" })
  check() {
    return this.healthService.check();
  }

  @Get("ready")
  @ApiOperation({ summary: "Readiness probe (includes DB connectivity)" })
  ready() {
    return this.healthService.ready();
  }
}
