// src/index.js
import express from 'express';
import { getHorariosDisponiveis, criarAgendamento } from './controllers/agendamentos.js';

const app = express();
app.use(express.json());

app.get('/api/horarios-disponiveis', async (req, res) => {
  try {
    const { barbeiroId, data, servicoId } = req.query;
    const horarios = await getHorariosDisponiveis(Number(barbeiroId), data, Number(servicoId));
    res.json(horarios);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ... outras rotas

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});