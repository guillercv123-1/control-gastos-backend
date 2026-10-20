import { describe, expect, it } from "@jest/globals";
import { cruzaUmbral } from './alerta';

describe('cruzaUmbral', () => {
  it('debe detectar cuando un gasto hace alcanzar el umbral mensual', () => {
    // Arrange
    const totalHormigaDespues = 100;
    const montoGasto = 20;
    const umbral = 100;

    // Act
    const resultado = cruzaUmbral(totalHormigaDespues, montoGasto, umbral);

    // Assert
    expect(resultado).toBe(true);
  });

  it('debe detectar el cruce cuando el total queda exactamente en el umbral', () => {
    // Arrange
    const totalHormigaDespues = 100;
    const montoGasto = 1;
    const umbral = 100;

    // Act
    const resultado = cruzaUmbral(totalHormigaDespues, montoGasto, umbral);

    // Assert
    expect(resultado).toBe(true);
  });

  it('no debe volver a detectar el cruce si el total previo ya estaba en el umbral', () => {
    // Arrange
    const totalHormigaDespues = 120;
    const montoGasto = 20;
    const umbral = 100;

    // Act
    const resultado = cruzaUmbral(totalHormigaDespues, montoGasto, umbral);

    // Assert
    expect(resultado).toBe(false);
  });

  it('no debe detectar un cruce cuando el total todavía está por debajo del umbral', () => {
    // Arrange
    const totalHormigaDespues = 99;
    const montoGasto = 20;
    const umbral = 100;

    // Act
    const resultado = cruzaUmbral(totalHormigaDespues, montoGasto, umbral);

    // Assert
    expect(resultado).toBe(false);
  });

  it('debe detectar el cruce cuando el total anterior era menor al umbral', () => {
    // Arrange
    const totalHormigaDespues = 100;
    const montoGasto = 10;
    const umbral = 100;

    // Act
    const resultado = cruzaUmbral(totalHormigaDespues, montoGasto, umbral);

    // Assert
    expect(resultado).toBe(true);
  });
});
