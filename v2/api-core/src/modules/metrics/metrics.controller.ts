import { Controller, Get, Header, Res } from "@nestjs/common";
import { ApiExcludeEndpoint } from "@nestjs/swagger";
import { Response } from "express";
import { MetricsService } from "./metrics.service";

@Controller()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  // Excluded from the global API prefix via setGlobalPrefix() so Prometheus
  // can scrape /metrics uniformly across services.
  @ApiExcludeEndpoint()
  @Get("metrics")
  @Header("Cache-Control", "no-cache")
  async metrics(@Res({ passthrough: true }) res: Response): Promise<string> {
    res.setHeader("Content-Type", this.metricsService.contentType);
    return this.metricsService.metrics();
  }
}
