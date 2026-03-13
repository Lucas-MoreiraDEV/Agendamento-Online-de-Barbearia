import { Router } from 'express';
import getAgendamentos, { pool } from '../database.js';
import { getBarbeiros, getServicos, getHorariosLivres, verificarDuracaoServico, cadastroAutomatico } from '../database.js';

const router = Router();

router.get('/admin', async (req, res) => {
  try {
    const agendamentos = await getAgendamentos();
    const barbeiros = await getBarbeiros();
    const servicos = await getServicos();
    const horariosLivres = await getHorariosLivres(1, '2025-02-25', 30);
    res.render('admin', { agendamentos, barbeiros, servicos });
  } catch (error) {
    console.error('Erro ao buscar agendamentos:', error);
    res.status(500).render('admin', { error: 'Erro ao carregar os agendamentos.' });
  }
});

router.get('/api/horarios', async (req, res) => {
    const { barbeiroId, data, duracao } = req.query;

    const horariosLivres = await getHorariosLivres(barbeiroId, data, duracao);
    res.json(horariosLivres);
});


router.post('/admin/agendamentos', async (req, res) => {
  try {
    const { cliente, telefone, barbeiros_id, servicos_id, data, horario, observacoes } = req.body;
    const duracaoServico = await verificarDuracaoServico(servicos_id);
    const clienteId = await cadastroAutomatico(cliente, telefone);
    await criarAgendamento(clienteId, barbeiros_id, servicos_id, data, horario, duracaoServico, 'confirmed');
    res.redirect('/admin');
  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
    res.status(500).render('admin', { error: 'Erro ao criar o agendamento.' });
  }
});
router.delete("/admin/agendamentos/:id", async (req, res) => {
    const id = req.params.id;

    try {
        await pool.query(
            "DELETE FROM agendamentos WHERE id = $1",
            [id]
        );

        res.sendStatus(200);

    } catch(err){
        console.error(err);
        res.sendStatus(500);
    }
});

router.get('/admin/agendar', async (req, res) => {
  try {
    res.render('admin/agendar');
  } catch (error) {
    console.error('Erro ao carregar a página de agendamento:', error);
    res.status(500).render('error', { error: 'Erro ao carregar a página de agendamento.' });
  }
});

router.get('/api/horarios-livres', async (req, res) => {
  const { barbeiroId, data } = req.query;

  if (!barbeiroId || !data) {
    return res.status(400).json({ error: 'Parâmetros obrigatórios: barbeiroId e data' });
  }

  try {
    const horarios = await getHorariosLivres(Number(barbeiroId), data);
    res.json({ horariosLivres: horarios });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar horários' });
  }
});

router.get('/adminteste', async (req, res) => {
  try {
    const barbeiroId = req.query.barbeiroId || 1;
    const data = req.query.data || '2025-02-25';
    const duracaoMin = req.query.duracaoMin || 30;

    res.json(horariosLivres);
  } catch (error) {
    console.error('Erro ao buscar horários livres:', error);
    res.status(500).json({ error: 'Erro ao buscar horários livres.' });
  }
});

router.get('/admin/barbeiros', async (req, res) => {
  try {
    const barbeiros = await getBarbeiros();
    res.render('admin/barbeiros', { barbeiros });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao carregar barbeiros');
  }
});
router.post('/admin/barbeiros', async (req, res) => {
  try {
    const nome = req.body.nome;
    const urlFoto = req.body.foto_url;
    const ativo = req.body.ativo;
    const horarios_trabalho = req.body.horarios_trabalho;
    const novoBarbeiro = { nome, urlFoto, ativo, horarios_trabalho };
    await pool.query('INSERT INTO barbeiros (nome, foto_url, ativo, horarios_trabalho) VALUES ($1, $2, $3, $4)', [novoBarbeiro.nome, novoBarbeiro.urlFoto, novoBarbeiro.ativo, novoBarbeiro.horarios_trabalho]);
    res.redirect('/admin/barbeiros');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao adicionar barbeiro');
  }
});


router.get('/admin/servicos', async (req, res) => {
  try {
    const servicos = await getServicos();
    res.render('admin/servicos', { servicos });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { error: 'Erro ao carregar os serviços.' });
  }
});
router.post('/admin/servicos', async (req, res) => {
    try {
        const nome = req.body.nome;
        const preco = req.body.preco;
        const duracao = req.body.duracao_min;
        const novoServico = { nome, preco, duracao };
        await pool.query('INSERT INTO servicos (nome, preco, duracao_min) VALUES ($1, $2, $3)', [novoServico.nome, novoServico.preco, novoServico.duracao]);
        res.redirect('/admin/servicos');
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { error: 'Erro ao adicionar serviço.' });
    }
});

export default router;
