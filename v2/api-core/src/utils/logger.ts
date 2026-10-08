import { createLogger, format, transports } from "winston";

const winstonLogger = createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    process.env.NODE_ENV === "production"
      ? format.json()
      : format.combine(format.colorize(), format.simple()),
  ),
  transports: [new transports.Console()],
});

export const Logger = {
  log(message: string) {
    winstonLogger.info(message);
  },
  error(message: string, trace?: string) {
    winstonLogger.error(message, { trace });
  },
  warn(message: string) {
    winstonLogger.warn(message);
  },
  debug(message: string) {
    winstonLogger.debug(message);
  },
};
