import { gastoRepository } from '../repositories/gasto-repository';
import { toGasto, type Gasto } from '../domain/gasto';
import { calcularResumen } from '../domain/resumen';
import { cruzaUmbral } from '../domain/alerta';
import { publicarAlerta } from '../lib/sns';
import { config } from '../config/env';
import { logger } from '../lib/logger';

export class AlertaHormigaService {
  async evaluarGasto(gasto: Gasto): Promise<void> {
    // Solo los gastos hormiga mueven el total que vigilamos.
    if (!gasto.esHormiga) return;

    const mes = gasto.fecha.slice(0, 7);
    const items = await gastoRepository.listar(gasto.userId, { mes });
    const { totalHormiga } = calcularResumen(mes, items.map(toGasto));

    if (cruzaUmbral(totalHormiga, gasto.monto, config.umbralAlertaMensual)) {
      logger.info({ operation: 'expense_alert_threshold_crossed' });
      await publicarAlerta(gasto.userId, mes, totalHormiga, config.umbralAlertaMensual);
    }
  }
}

export const alertaHormigaService = new AlertaHormigaService();
