// src/controllers/agendamentos.js
import { query } from '../db.js';
import { addMinutes, isBefore, parse, format } from 'date-fns'; // instale: npm i date-fns

// Helper: converte '09:00' para objeto Date no dia informado
function parseHorario(dataStr, horarioStr) {
  return parse(`${dataStr} ${horarioStr}`, 'yyyy-MM-dd HH:mm', new Date());
}

// 1. Horários disponíveis
export async function getHorariosDisponiveis(barbeiroId, data, servicoId) {
  // Pegar duração do serviço (em minutos)
  const servicoRes = await query(
    'SELECT EXTRACT(EPOCH FROM duracao)/60 AS minutos FROM servicos WHERE id = $1',
    [servicoId]
  );
  if (servicoRes.rowCount === 0) throw new Error('Serviço não encontrado');
  const duracaoMin = Math.round(servicoRes.rows[0].minutos);

  // Pegar horários de trabalho do barbeiro
  const barbeiroRes = await query(
    'SELECT horarios_trabalho FROM barbeiros WHERE id = $1',
    [barbeiroId]
  );
  if (barbeiroRes.rowCount === 0) throw new Error('Barbeiro não encontrado');

  const diaSemana = new Date(data).toLocaleString('pt-BR', { weekday: 'short' }).slice(0, 3); // seg, ter...
  const horarioDia = barbeiroRes.rows[0].horarios_trabalho[diaSemana];
  if (!horarioDia) return [];

  const [inicioStr, fimStr] = horarioDia.split('-');
  let current = parseHorario(data, inicioStr);
  const endDay = parseHorario(data, fimStr);

  const slots = [];
  while (isBefore(current, endDay)) {
    slots.push(format(current, 'HH:mm'));
    current = addMinutes(current, duracaoMin);
  }

  // Pegar agendamentos existentes
  const agendRes = await query(
    `SELECT data_hora_inicio, data_hora_fim 
     FROM agendamentos 
     WHERE barbeiro_id = $1 
       AND DATE(data_hora_inicio) = $2 
       AND status != 'cancelado'`,
    [barbeiroId, data]
  );

  // Filtrar livres
  const livres = slots.filter(slot => {
    const slotStart = parseHorario(data, slot);
    const slotEnd = addMinutes(slotStart, duracaoMin);

    return !agendRes.rows.some(ag => {
      const agStart = ag.data_hora_inicio;
      const agEnd = ag.data_hora_fim;
      return slotStart < agEnd && slotEnd > agStart;
    });
  });

  return livres;
}

// 2. Criar agendamento (com transação)
export async function criarAgendamento({ clienteId, barbeiroId, servicoId, dataHoraInicio }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Pegar duração
    const { rows: [servico] } = await client.query(
      'SELECT duracao FROM servicos WHERE id = $1',
      [servicoId]
    );
    if (!servico) throw new Error('Serviço inválido');

    const dataHoraFim = new Date(dataHoraInicio);
    dataHoraFim.setSeconds(dataHoraFim.getSeconds() + servico.duracao);

    // Checar overlap
    const { rowCount } = await client.query(
      `SELECT 1 FROM agendamentos
       WHERE barbeiro_id = $1
         AND status != 'cancelado'
         AND tstzrange(data_hora_inicio, data_hora_fim) && tstzrange($2, $3)`,
      [barbeiroId, dataHoraInicio, dataHoraFim]
    );
    if (rowCount > 0) throw new Error('Horário já ocupado');

    // Inserir
    await client.query(
      `INSERT INTO agendamentos 
       (cliente_id, barbeiro_id, servico_id, data_hora_inicio, data_hora_fim, status)
       VALUES ($1, $2, $3, $4, $5, 'pendente')`,
      [clienteId, barbeiroId, servicoId, dataHoraInicio, dataHoraFim]
    );

    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}