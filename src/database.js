import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
pool.connect()
  .then(() => console.log('Conectado ao PostgreSQL com sucesso'))
  .catch(err => console.error('Erro ao conectar ao banco:', err));



export default async function getAgendamentos() {
    const result = await pool.query(`SELECT agendamentos.id,
                                    clientes.nome AS nome_cliente,
                                    barbeiros.nome AS nome_barbeiro,
                                    servicos.nome AS nome_servico,
                                    agendamentos.data,
                                    agendamentos.horario,
                                    agendamentos.duracao_min,
                                    agendamentos.status
                                    FROM agendamentos
                                    INNER JOIN clientes ON agendamentos.clientes_id = clientes.id
                                    INNER JOIN barbeiros ON agendamentos.barbeiros_id = barbeiros.id
                                    INNER JOIN servicos ON agendamentos.servicos_id = servicos.id
                                    ORDER BY agendamentos.data DESC, agendamentos.horario DESC`);
    return result.rows;
};

export async function getBarbeiros() {
  const { rows: barbeiros } = await pool.query(`
      SELECT 
        id, 
        nome, 
        ativo,
        horarios_trabalho
      FROM public.barbeiros
      ORDER BY nome ASC
    `);
  return barbeiros;
};

export async function getServicos() {
  const { rows: servicos } = await pool.query(`
      SELECT 
        id, 
        nome, 
        duracao_min, 
        preco
      FROM public.servicos
      ORDER BY id ASC
    `);
  return servicos;
};


function gerarSlotsHorarios(horaInicio, horaFim, passo) {
  // Converter strings para minutos desde meia-noite
  const paraMinutos = (horario) => {
    const [h, m] = horario.split(':').map(Number);
    return h * 60 + m;
  };

  const inicioMin = paraMinutos(horaInicio);
  const fimMin    = paraMinutos(horaFim);

  if (inicioMin >= fimMin || passo <= 0) {
    return [];
  }

  const slots = [];
  let atual = inicioMin;

  while (atual <= fimMin) {
    const horas = Math.floor(atual / 60).toString().padStart(2, '0');
    const minutos = (atual % 60).toString().padStart(2, '0');
    slots.push(`${horas}:${minutos}`);
    atual += passo;
  }

  return slots;
}

export async function getHorariosLivres(barbeiroId, data, duracaoServicoMin) {
  try {
    // 1. Buscar horários de trabalho do barbeiro
    const barbeiroResult = await pool.query(
      'SELECT horarios_trabalho FROM barbeiros WHERE id = $1',
      [barbeiroId]
    );

    if (barbeiroResult.rowCount === 0) {
      throw new Error('Barbeiro não encontrado');
    }

    const horariosTrabalho = barbeiroResult.rows[0].horarios_trabalho || {};

    // Pegar o dia da semana (seg, ter, etc.)
    const dataObj = new Date(data);
    const diaSemana = dataObj.toLocaleString('pt-BR', { weekday: 'short' }).toLowerCase().slice(0, 3);

    const horarioTrabalhoDia = horariosTrabalho[diaSemana];

    if (!horarioTrabalhoDia) {
      return "Barbeiro nao trabalha nesse dia"; // barbeiro não trabalha nesse dia
    }

    // 2. Gerar todos os slots possíveis do dia com base no horário de trabalho e duração do serviço
    const [horaInicio, horaFim] = horarioTrabalhoDia.split('-');
    const slotsPossiveis = gerarSlotsHorarios(horaInicio, horaFim, 15);



    // 3. Buscar horas e duração dos agendamentos já existentes para o barbeiro nesse dia
    const dataLimpa = String(data).split('T')[0].trim(); // garante só '2025-02-25'

    const agendResult = await pool.query(
      `SELECT horario, duracao_min 
      FROM agendamentos 
      WHERE barbeiros_id = $1 
        AND data = $2::date`,
      [barbeiroId, dataLimpa]
    );

    const ocupados = agendResult.rows;

    // 4. Filtrar os slots possíveis removendo os que se sobrepõem com os agendamentos existentes
    const horariosFiltrado = slotsPossiveis.filter(slot => {
      // Converter slot atual para minutos desde meia-noite
      const [h, m] = slot.split(':').map(Number);
      const slotInicioMin = h * 60 + m;
      const slotFimMin = slotInicioMin + duracaoServicoMin;

      // Verificar se há algum agendamento que se sobrepõe
      for (const agendamento of ocupados) {
        const [ah, am] = agendamento.horario.split(':').map(Number);
        const agInicioMin = ah * 60 + am;
        const agFimMin = agInicioMin + agendamento.duracao_min;

        // Sobreposição: se o slot desejado cruza com o agendamento existente
        if (
          (slotInicioMin < agFimMin && slotFimMin > agInicioMin) ||
          (slotInicioMin >= agInicioMin && slotInicioMin < agFimMin)
        ) {
          return false; // slot ocupado ou não cabe
        }
      }
      return true; // slot livre
    });

    return horariosFiltrado.sort(); // ordena cronologicamente

  } catch (error) {
    console.error('Erro ao buscar horários livres:', error);
    throw error;
  }
}

export async function verificarDuracaoServico(servicoId) {
  try {
    const result = await pool.query(
      'SELECT duracao_min FROM servicos WHERE id = $1',
      [servicoId]
    );

    if (result.rowCount === 0) {
      throw new Error('Serviço não encontrado');
    }

    return result.rows[0].duracao_min;
  } catch (error) {
    console.error('Erro ao verificar duração do serviço:', error);
    throw error;
  }
}

export async function cadastroAutomatico(nome, telefone) {
    let cliente = await pool.query(
        "SELECT id FROM clientes WHERE telefone = $1",
        [telefone]
    );

    if(cliente.rows.length === 0){
        cliente = await pool.query(
            "INSERT INTO clientes(nome, telefone) VALUES ($1,$2) RETURNING id",
            [nome, telefone]
        );
    }

    const clienteId = cliente.rows[0].id;
    return clienteId;
}

export async function criarAgendamento(clienteId, barbeiroId, servicoId, data, horario, duracao_min, status = 'pending', observacoes = '') {
    try {
        await pool.query(
            `INSERT INTO agendamentos (clientes_id, barbeiros_id, servicos_id, data, horario, duracao_min, status, observacoes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [clienteId, barbeiroId, servicoId, data, horario, duracao_min, status, observacoes]
        );
    } catch (error) {
        console.error('Erro ao criar agendamento:', error);
        throw error;
    }
}

export { pool };