import { config } from '../config/env';
import type { ErrorCode } from './errors';

export type LogOperation =
  | 'expense_created'
  | 'expense_alert_threshold_crossed'
  | 'http_request'
  | 'event_handler'
  | 'import_upload_url_created'
  | 'import_validate_object_key'
  | 'import_read_s3_object'
  | 'import_parse_csv'
  | 'import_partial_csv'
  | 'import_persist_gastos'
  | 'import_partial_success'
  | 'import_success'
  | 'monthly_report_started'
  | 'monthly_report_no_data'
  | 'monthly_report_published'
  | 'monthly_report'
  | 'sqs_import_message'
  | 'stream_record_processing';

export type LogSourceType = 'csv' | 'dynamodb' | 'dynamodb_stream' | 's3' | 'sqs';

export interface LogContext {
  operation: LogOperation;
  errorCode?: ErrorCode;
  retryable?: boolean;
  count?: number;
  durationMs?: number;
  sourceType?: LogSourceType;
}

type LogLevel = 'info' | 'warn' | 'error';

const escribir = (level: LogLevel, context: LogContext): void => {
  const entry = {
    service: config.serviceName,
    stage: config.stage,
    operation: context.operation,
    ...(context.errorCode === undefined ? {} : { errorCode: context.errorCode }),
    ...(context.retryable === undefined ? {} : { retryable: context.retryable }),
    ...(context.count === undefined ? {} : { count: context.count }),
    ...(context.durationMs === undefined ? {} : { durationMs: context.durationMs }),
    ...(context.sourceType === undefined ? {} : { sourceType: context.sourceType }),
  };
  const serialized = JSON.stringify(entry);

  if (level === 'error') {
    console.error(serialized);
    return;
  }
  if (level === 'warn') {
    console.warn(serialized);
    return;
  }
  console.log(serialized);
};

// En Lambda, console.* va directo a CloudWatch Logs.
export const logger = {
  info: (context: LogContext): void => escribir('info', context),
  warn: (context: LogContext): void => escribir('warn', context),
  error: (context: LogContext): void => escribir('error', context),
};
