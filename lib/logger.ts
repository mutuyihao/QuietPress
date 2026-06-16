type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

function serializeError(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause:
        error.cause instanceof Error
          ? serializeError(error.cause)
          : error.cause,
    };
  }

  return error;
}

function normalizeFields(fields: LogFields): LogFields {
  const normalized: LogFields = {};

  for (const [key, value] of Object.entries(fields)) {
    normalized[key] =
      key === "err" || key === "error" ? serializeError(value) : value;
  }

  return normalized;
}

function write(level: LogLevel, msg: string, fields: LogFields = {}) {
  const entry = {
    level,
    time: new Date().toISOString(),
    msg,
    ...normalizeFields(fields),
  };
  const line = JSON.stringify(entry);

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (msg: string, fields?: LogFields) => write("debug", msg, fields),
  info: (msg: string, fields?: LogFields) => write("info", msg, fields),
  warn: (msg: string, fields?: LogFields) => write("warn", msg, fields),
  error: (msg: string, fields?: LogFields) => write("error", msg, fields),
};
