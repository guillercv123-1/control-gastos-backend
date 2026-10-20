import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import validator from '@middy/validator';
import { transpileSchema } from '@middy/validator/transpile';
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import { logger, type LogOperation } from './logger';
import type { ErrorCode } from './errors';
import { ValidationError } from './validate';

type HttpHandler = (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
) => Promise<APIGatewayProxyStructuredResultV2>;

interface AjvError {
  keyword: string;
  instancePath: string;
  message?: string;
  params: Record<string, any>;
}

const json = (statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});


const formatearErrores = (errores: AjvError[]): string =>
  errores
    .map((e) => {
      if (e.keyword === 'required') {
        const campo = e.params.missingProperty;
        return campo === 'body' ? 'debes enviar un cuerpo JSON' : `falta el campo '${campo}'`;
      }
      const campo = e.instancePath.replace(/^\/body\//, '') || 'cuerpo';
      switch (e.keyword) {
        case 'enum':
          return `'${campo}' debe ser uno de: ${(e.params.allowedValues ?? []).join(', ')}`;
        case 'exclusiveMinimum':
          return `'${campo}' debe ser mayor que ${e.params.limit}`;
        case 'minLength':
          return `'${campo}' no puede estar vacio`;
        case 'type':
          return `'${campo}' debe ser de tipo ${e.params.type}`;
        case 'pattern':
          return `'${campo}' tiene un formato invalido`;
        case 'additionalProperties':
          return `campo no permitido: '${e.params.additionalProperty}'`;
        default:
          return `'${campo}' ${e.message ?? 'es invalido'}`;
      }
    })
    .join('; ');

const httpErrorHandler = (): middy.MiddlewareObj<
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2
> => ({
  onError: (request) => {
    const err = request.error as (Error & { statusCode?: number }) | null;
    if (!err) return;


    const causa = (err as { cause?: { package?: string; data?: AjvError[] } }).cause;
    if (causa?.package === '@middy/validator' && Array.isArray(causa.data)) {
      request.response = json(400, { error: formatearErrores(causa.data) });
      return;
    }

    if (err instanceof ValidationError) {
      request.response = json(400, { error: err.message });
      return;
    }

    if (err instanceof SyntaxError || err.statusCode === 415 || err.statusCode === 422) {
      request.response = json(400, { error: 'El cuerpo debe ser JSON valido' });
      return;
    }

    if (typeof err.statusCode === 'number') {
      request.response = json(err.statusCode, { error: err.message });
      return;
    }

    logger.error({
      operation: 'http_request',
      errorCode: 'HTTP_REQUEST_FAILED',
      retryable: false,
    });
    request.response = json(500, { error: 'Error interno' });
  },
});

/**
 * Para handlers HTTP. Aplica:
 * - http-json-body-parser: parsea event.body a objeto.
 * - validator (OPCIONAL): valida event.body contra un JSON Schema si se pasa uno.
 * - errorHandler: centraliza el mapeo de errores a respuestas HTTP.
 */
export const withMiddleware = (handler: HttpHandler, bodySchema?: object) => {
  const chain = middy(handler).use(httpJsonBodyParser({ disableContentTypeError: true }));

  if (bodySchema) {
    chain.use(
      validator({
        eventSchema: transpileSchema({
          type: 'object',
          properties: { body: bodySchema },
          required: ['body'],
        }),
      }),
    );
  }

  return chain.use(httpErrorHandler());
};

/**
 * Para handlers EVENT-DRIVEN (SQS, schedule): registra cualquier error no controlado
 * y lo RELANZA, para que Lambda reintente / el mensaje caiga al DLQ. No devuelve HTTP.
 */
export const withErrorLogging = <TEvent, TResult>(
  handler: (event: TEvent) => Promise<TResult>,
  operation: LogOperation = 'event_handler',
  errorCode: ErrorCode = 'EVENT_HANDLER_FAILED',
) =>
  middy<TEvent, TResult>(handler).use({
    onError: () => {
      logger.error({
        operation,
        errorCode,
        retryable: true,
      });
    },
  });
