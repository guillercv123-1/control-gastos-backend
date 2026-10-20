# Control de Gastos — Backend Node.js + TypeScript sobre AWS

Backend serverless para registrar y analizar **gastos hormiga** (Yape, Plin, efectivo, retiros).
La estrella es el backend **Node.js / TypeScript**; AWS es la plataforma; **Angular** es el frontend (fase posterior).

## Arquitectura objetivo
Cognito · API Gateway (HTTP API) · AWS Lambda (Node.js/TS) · DynamoDB (+ Streams) · S3 · CloudFront · SQS · SNS · EventBridge Scheduler. Todo en servicios *always-free* (~$0/mes).

## Estructura (capas)
    src/
      handlers/      # entradas Lambda (delgadas: parsean y responden)
      services/      # logica de negocio
      repositories/  # acceso a datos DynamoDB (SDK v3, DocumentClient)
      domain/        # tipos del dominio + reglas (claves, flag hormiga)
      lib/           # utilidades (dynamo, validacion, respuestas, logger, identidad)
      config/        # variables de entorno
    template.yaml    # infraestructura (AWS SAM, build con esbuild)

## Autenticacion (Cognito)
Los endpoints de /gastos requieren un token JWT de Cognito. /health es publico.
Crear usuario de prueba y obtener token (reemplaza POOL_ID y CLIENT_ID por los Outputs):

    aws cognito-idp admin-create-user --user-pool-id POOL_ID --username TU_EMAIL --message-action SUPPRESS
    aws cognito-idp admin-set-user-password --user-pool-id POOL_ID --username TU_EMAIL --password "PASSWORD" --permanent
    aws cognito-idp initiate-auth --auth-flow USER_PASSWORD_AUTH --client-id CLIENT_ID \
      --auth-parameters USERNAME=TU_EMAIL,PASSWORD="PASSWORD"

Copia el "IdToken" de la respuesta y mandalo en el header:  Authorization: Bearer <IdToken>

## Endpoints
    GET    /health                       -> publico
    POST   /gastos                       -> crea un gasto        (requiere token)
    GET    /gastos[?mes=&categoria=&metodo=]  -> lista/filtra    (requiere token)
    GET    /gastos/{id}                  -> un gasto por id      (requiere token)

## Modelo de datos (tabla unica `control-gastos`)
    PK = USER#<userId>          SK = GASTO#<ulid>
    GSI1PK = USER#<userId>#<YYYY-MM>   GSI1SK = <fecha>#<ulid>
El userId es ahora el `sub` del usuario autenticado en Cognito.

