import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

/**
 * OpenTelemetry SDK wiring. Started in bootstrap only when
 * OTEL_SDK_ENABLED=true; exports traces via OTLP/HTTP to
 * OTEL_EXPORTER_OTLP_ENDPOINT (default http://localhost:4318), which the
 * OpenTelemetry Collector forwards to Jaeger.
 */
export function createTracingSdk(): NodeSDK {
  const traceExporter = new OTLPTraceExporter();

  return new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? "api-core",
    }),
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
    ],
  });
}
