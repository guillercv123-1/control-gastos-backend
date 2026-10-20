# Instrucciones generales del proyecto

## Contexto del proyecto

Este repositorio contiene el backend `control-gastos-backend`.

Tecnologías principales:

- Node.js 22.
- TypeScript.
- AWS Lambda.
- Serverless Framework 4.
- AWS SDK v3.
- Middy.
- DynamoDB.
- Amazon S3.
- Amazon SNS.
- Jest y ts-jest para pruebas automáticas.
- npm como gestor de dependencias.
- GitHub Actions para integración y despliegue continuo.

## Objetivos generales

Al analizar o modificar código:

1. Comprender primero la estructura existente del proyecto.
2. Mantener la arquitectura y convenciones actuales salvo que exista un problema claro.
3. Evitar cambios masivos que no estén relacionados con la tarea solicitada.
4. Explicar los problemas identificados antes de modificar código importante.
5. Priorizar código legible, mantenible, testeable y seguro.
6. No inventar archivos, endpoints, variables de entorno ni recursos AWS.
7. Revisar las importaciones, rutas y nombres reales antes de generar código.
8. No dejar código incompleto, comentarios TODO innecesarios ni implementaciones simuladas.

## Reglas de TypeScript

- Evitar `any`. Utilizar tipos, interfaces, genéricos o `unknown` con validaciones.
- No utilizar imports wildcard como `import * as`.
- Utilizar imports explícitos.
- Mantener habilitado el tipado estricto.
- Evitar conversiones forzadas con `as` salvo que estén justificadas.
- Evitar funciones excesivamente largas.
- Aplicar responsabilidad única.
- Utilizar nombres descriptivos para variables, funciones, clases e interfaces.
- Evitar números y cadenas mágicas.
- Utilizar constantes o enumeraciones cuando aporten claridad.
- Preferir retornos tempranos para reducir anidaciones.
- No silenciar errores de TypeScript.
- No introducir dependencias nuevas sin explicar su necesidad.

## Manejo de errores

- No dejar bloques `catch` vacíos.
- Conservar el error original cuando sea relevante.
- No exponer credenciales, tokens, datos internos o trazas sensibles.
- Los handlers deben devolver respuestas de error consistentes.
- Diferenciar errores de validación, errores funcionales y errores técnicos.
- Registrar información útil sin exponer secretos.

## Reglas para AWS

- Utilizar AWS SDK v3 con clientes e imports explícitos.
- Evitar crear clientes AWS repetidamente dentro de cada invocación cuando puedan reutilizarse.
- No escribir credenciales AWS en el código.
- Obtener configuración sensible desde variables de entorno o servicios autorizados.
- Validar las variables de entorno requeridas.
- Evitar permisos IAM con comodines cuando sea posible.
- No modificar recursos de infraestructura sin revisar primero `serverless.yml`.

## Reglas para dependencias

- Utilizar npm.
- Mantener `package-lock.json` versionado.
- Utilizar `npm ci` en integración continua.
- No utilizar pnpm ni yarn.
- Antes de agregar una dependencia, comprobar si la funcionalidad ya puede resolverse con las dependencias existentes.

## Calidad obligatoria

Después de modificar código, ejecutar o comprobar conceptualmente:

```bash
npm run typecheck
npm test
npm run package -- --stage dev