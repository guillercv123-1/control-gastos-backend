export type ErrorCode =
  | 'STREAM_RECORD_PROCESSING_FAILED'
  | 'IMPORT_INVALID_EVENT'
  | 'IMPORT_S3_READ_FAILED'
  | 'IMPORT_CSV_INVALID'
  | 'IMPORT_DYNAMODB_WRITE_FAILED'
  | 'IMPORT_PROCESSING_FAILED'
  | 'DYNAMODB_UNPROCESSED_ITEMS'
  | 'REPORT_GENERATION_FAILED'
  | 'HTTP_REQUEST_FAILED'
  | 'EVENT_HANDLER_FAILED';

export class AppError extends Error {
  constructor(
    readonly errorCode: ErrorCode,
    readonly retryable: boolean,
    readonly count?: number,
  ) {
    super(errorCode);
    this.name = 'AppError';
  }
}
