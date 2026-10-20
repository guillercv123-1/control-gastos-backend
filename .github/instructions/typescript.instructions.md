---
description: "Estándares de desarrollo y revisión para archivos TypeScript"
applyTo: "**/*.ts"
---

# Estándares para TypeScript

Al crear, revisar o modificar archivos TypeScript:

## Tipado

- No utilizar `any`.
- Usar `unknown` para valores externos cuya estructura todavía no ha sido validada.
- Crear interfaces o tipos para entradas, respuestas, entidades y dependencias.
- Tipar explícitamente parámetros y valores de retorno en servicios, repositorios y handlers.
- Evitar aserciones de tipo innecesarias.
- No silenciar errores con `@ts-ignore`.

## Imports

- No utilizar imports wildcard.
- Utilizar imports explícitos.
- Eliminar imports no utilizados.
- Mantener un orden consistente en las importaciones.
- Utilizar las rutas y aliases existentes en el proyecto.
- No inventar aliases que no estén configurados en `tsconfig.json`.

## Diseño

- Mantener una responsabilidad principal por función.
- Separar validación, lógica de negocio y acceso a infraestructura.
- Evitar lógica de negocio directamente acoplada al handler de AWS Lambda.
- Añadir inyección de dependencias cuando facilite las pruebas y no complique innecesariamente el diseño.
- Evitar estados globales mutables.
- Preferir funciones puras para cálculos y transformaciones.
- Evitar duplicación de lógica.

## Funciones asíncronas

- Utilizar `async` y `await` de forma consistente.
- No omitir el manejo de promesas.
- No utilizar `forEach` con callbacks asíncronos.
- Utilizar `Promise.all` únicamente cuando las operaciones puedan ejecutarse de forma concurrente con seguridad.
- Manejar correctamente errores producidos por AWS SDK.

## Revisión de código

Antes de proponer un cambio:

1. Identificar el propósito del archivo.
2. Revisar sus dependencias.
3. Buscar usos del código que será modificado.
4. Revisar tipos e interfaces relacionados.
5. Comprobar si existen pruebas.
6. Detectar posibles impactos indirectos.
7. Realizar el cambio mínimo necesario.

Después del cambio:

1. Comprobar que no existan imports rotos.
2. Comprobar que no existan símbolos sin utilizar.
3. Comprobar que `npm run typecheck` pueda finalizar correctamente.
4. Crear o actualizar las pruebas relacionadas.