---
description: "Reglas para crear y mantener pruebas automáticas con Jest"
applyTo: "**/*.test.ts,**/*.spec.ts"
---

# Estándares de pruebas con Jest

## Objetivo

Las pruebas deben verificar comportamientos observables y reglas de negocio, no detalles internos irrelevantes.

## Estructura

- Utilizar `describe` para agrupar pruebas relacionadas.
- Utilizar `it` o `test` con descripciones claras.
- Escribir los nombres de las pruebas en español.
- Utilizar la estructura Arrange, Act, Assert.
- Mantener cada prueba independiente.
- No depender del orden de ejecución.
- No compartir estado mutable entre pruebas.

Ejemplo de estructura:

```typescript
describe("nombre de la unidad evaluada", () => {
  it("debe devolver el resultado esperado cuando la entrada es válida", () => {
    // Arrange

    // Act

    // Assert
  });
});