import { Injectable, OnModuleInit } from "@nestjs/common";
import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "prom-client";

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();

  readonly httpRequestsTotal: Counter<"method" | "endpoint" | "status"> =
    new Counter({
      name: "http_requests_total",
      help: "Total number of HTTP requests",
      labelNames: ["method", "endpoint", "status"],
      registers: [this.registry],
    });

  readonly httpRequestDuration: Histogram<"method" | "endpoint"> =
    new Histogram({
      name: "http_request_duration_seconds",
      help: "HTTP request latencies in seconds",
      labelNames: ["method", "endpoint"],
      registers: [this.registry],
    });

  onModuleInit() {
    collectDefaultMetrics({ register: this.registry });
  }

  async metrics(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
