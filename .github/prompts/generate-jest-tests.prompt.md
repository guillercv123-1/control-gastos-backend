---
description: "Analiza el backend y genera pruebas unitarias con Jest"
agent: "agent"
---

# Generar pruebas unitarias con Jest

Analiza el código seleccionado o el módulo indicado y genera pruebas unitarias con Jest y ts-jest.

## Etapa 1: análisis previo

Antes de modificar archivos:

1. Identifica la responsabilidad del código.
2. Revisa los imports y dependencias.
3. Localiza interfaces, tipos, servicios, repositorios y utilidades relacionados.
4. Busca pruebas existentes y replica sus convenciones.
5. Revisa `package.json`, `jest.config.cjs` y `tsconfig.json`.
6. Identifica dependencias externas que deben ser simuladas.
7. Identifica posibles dificultades de testabilidad.
8. Enumera los casos de prueba propuestos.

No escribas pruebas hasta terminar este análisis.

## Etapa 2: clasificación

Clasifica cada dependencia como:

- Lógica interna que debe ejecutarse realmente.
- Dependencia externa que debe simularse.
- Cliente AWS que debe simularse.
- Variable de entorno que debe controlarse.
- Función no determinista que debe controlarse, como fecha, identificador o aleatoriedad.

## Etapa 3: generación

Genera archivos `.test.ts` próximos al código probado o siguiendo la estructura existente del proyecto.

Las pruebas deben:

- Utilizar Jest.
- Ser compatibles con ts-jest.
- Seguir Arrange, Act, Assert.
- Evitar `any`.
- No usar imports wildcard.
- Tener nombres descriptivos en español.
- Cubrir caminos correctos y errores.
- Simular servicios externos.
- No conectarse realmente con AWS.
- No depender de credenciales.
- No modificar la implementación productiva sin justificación.
- Reutilizar factories o builders existentes.
- Mantener aislamiento entre casos.

## Etapa 4: ejecución

Después de generar las pruebas:

1. Ejecuta `npm run typecheck`.
2. Ejecuta `npm test`.
3. Corrige errores de compilación producidos por las pruebas.
4. Corrige errores de configuración de Jest.
5. No ocultes pruebas fallidas.
6. No utilices `--passWithNoTests`.
7. No elimines assertions para hacer pasar el pipeline.

## Etapa 5: resultado

Entrega un resumen con:

- Archivos analizados.
- Archivos de prueba creados o modificados.
- Casos cubiertos.
- Dependencias simuladas.
- Comandos ejecutados.
- Resultado de los tests.
- Problemas encontrados en el código productivo.
- Casos que todavía requieren pruebas.
- Recomendaciones de refactorización, sin aplicarlas automáticamente si exceden el alcance.