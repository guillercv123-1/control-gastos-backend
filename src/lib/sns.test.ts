import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { mockClient } from 'aws-sdk-client-mock';
import { config } from '../config/env';
import { publicarAlerta, publicarMensaje } from './sns';

const snsMock = mockClient(SNSClient);

describe('publicarMensaje', () => {
  const topicArnOriginal = config.alertTopicArn;

  beforeEach(() => {
    jest.clearAllMocks();
    snsMock.reset();
    config.alertTopicArn = 'arn:aws:sns:us-east-1:123456789012:alertas-pruebas';
  });

  afterEach(() => {
    config.alertTopicArn = topicArnOriginal;
  });

  it('debe publicar el subject y el mensaje al topic configurado', async () => {
    // Arrange
    const subject = 'Aviso de prueba';
    const message = 'Contenido de prueba';
    snsMock.on(PublishCommand).resolves({});

    // Act
    await publicarMensaje(subject, message);

    // Assert
    const llamada = snsMock.commandCalls(PublishCommand)[0];
    expect(llamada).toBeDefined();
    expect(llamada?.args[0].input).toEqual({
      TopicArn: 'arn:aws:sns:us-east-1:123456789012:alertas-pruebas',
      Subject: subject,
      Message: message,
    });
  });

  it('debe publicar la alerta con el usuario, el mes, los importes y el umbral', async () => {
    // Arrange
    snsMock.on(PublishCommand).resolves({});

    // Act
    await publicarAlerta('usuario-1', '2025-02', 125.5, 100);

    // Assert
    const llamada = snsMock.commandCalls(PublishCommand)[0];
    expect(llamada).toBeDefined();
    expect(llamada?.args[0].input).toEqual({
      TopicArn: 'arn:aws:sns:us-east-1:123456789012:alertas-pruebas',
      Subject: 'Gastos hormiga sobre el limite (2025-02)',
      Message:
        'Alerta de gastos hormiga\n\n' +
        'Tus gastos hormiga de 2025-02 ya suman S/ 125.50, ' +
        'por encima de tu limite de S/ 100.00.\n\n' +
        'Usuario: usuario-1\nRevisa tu resumen para ver por donde se esta yendo la plata.',
    });
  });

  it('debe utilizar topic ARN vacío cuando ALERT_TOPIC_ARN no está definida', async () => {
    // Arrange
    const valorOriginal = process.env.ALERT_TOPIC_ARN;
    delete process.env.ALERT_TOPIC_ARN;

    try {
      await jest.isolateModulesAsync(async () => {
        const { SNSClient: ClienteSNS, PublishCommand: ComandoPublicar } =
          await import('@aws-sdk/client-sns');
        const { mockClient: simularCliente } = await import('aws-sdk-client-mock');
        const mockAislado = simularCliente(ClienteSNS);
        try {
          mockAislado.on(ComandoPublicar).resolves({});
          const { publicarMensaje: publicarMensajeAislado } = await import('./sns');

          // Act
          await publicarMensajeAislado('Aviso', 'Mensaje');

          // Assert
          const llamada = mockAislado.commandCalls(ComandoPublicar)[0];
          expect(llamada?.args[0].input.TopicArn).toBe('');
        } finally {
          mockAislado.restore();
        }
      });
    } finally {
      if (valorOriginal === undefined) {
        delete process.env.ALERT_TOPIC_ARN;
      } else {
        process.env.ALERT_TOPIC_ARN = valorOriginal;
      }
    }
  });

  it('debe pasar sin validar un ALERT_TOPIC_ARN con formato incorrecto', async () => {
    // Arrange
    const topicArnInvalido = 'no-es-un-arn';
    const valorOriginal = process.env.ALERT_TOPIC_ARN;
    process.env.ALERT_TOPIC_ARN = topicArnInvalido;

    try {
      await jest.isolateModulesAsync(async () => {
        const { SNSClient: ClienteSNS, PublishCommand: ComandoPublicar } =
          await import('@aws-sdk/client-sns');
        const { mockClient: simularCliente } = await import('aws-sdk-client-mock');
        const mockAislado = simularCliente(ClienteSNS);
        try {
          mockAislado.on(ComandoPublicar).resolves({});
          const { publicarMensaje: publicarMensajeAislado } = await import('./sns');

          // Act
          await publicarMensajeAislado('Aviso', 'Mensaje');

          // Assert
          const llamada = mockAislado.commandCalls(ComandoPublicar)[0];
          expect(llamada?.args[0].input.TopicArn).toBe(topicArnInvalido);
        } finally {
          mockAislado.restore();
        }
      });
    } finally {
      if (valorOriginal === undefined) {
        delete process.env.ALERT_TOPIC_ARN;
      } else {
        process.env.ALERT_TOPIC_ARN = valorOriginal;
      }
    }
  });

  it('debe propagar errores inesperados de SNS', async () => {
    // Arrange
    const error = new Error('Fallo de SNS');
    snsMock.on(PublishCommand).rejects(error);

    // Act
    const operacion = publicarMensaje('Aviso', 'Mensaje');

    // Assert
    await expect(operacion).rejects.toBe(error);
  });
});
