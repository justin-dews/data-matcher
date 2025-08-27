// Structured logging utilities for edge functions

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogContext {
  module?: string;
  operation?: string;
  jobId?: string;
  duration?: number;
  [key: string]: any;
}

export class Logger {
  constructor(private module: string, private level: LogLevel = LogLevel.INFO) {}

  debug(message: string, context?: LogContext): void {
    if (this.level <= LogLevel.DEBUG) {
      this.log('DEBUG', message, context);
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.level <= LogLevel.INFO) {
      this.log('INFO', message, context);
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.level <= LogLevel.WARN) {
      this.log('WARN', message, context);
    }
  }

  error(message: string, error?: Error, context?: LogContext): void {
    if (this.level <= LogLevel.ERROR) {
      const errorContext = {
        ...context,
        error: error?.message,
        stack: error?.stack
      };
      this.log('ERROR', message, errorContext);
    }
  }

  private log(level: string, message: string, context?: LogContext): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      module: this.module,
      message,
      ...context
    };
    
    console.log(JSON.stringify(logEntry));
  }

  operation<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    this.info(`Starting operation: ${name}`);
    
    return fn()
      .then((result) => {
        const duration = Date.now() - start;
        this.info(`Completed operation: ${name}`, { duration });
        return result;
      })
      .catch((error) => {
        const duration = Date.now() - start;
        this.error(`Failed operation: ${name}`, error, { duration });
        throw error;
      });
  }
}

export function createLogger(module: string, level?: LogLevel): Logger {
  return new Logger(module, level);
}