const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const Joi = require('joi');

const app = express();
// Port INTERNE au conteneur : docker-compose le publie sur 3001 ("3001:3000")
const PORT = 3000;

// Ne pas annoncer la techno utilisée dans les en-têtes de réponse
app.disable('x-powered-by');

// Seul le frontend a le droit d'appeler l'API depuis un navigateur (jamais "*")
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
}));

// Middleware pour parser les corps de requêtes au format JSON
app.use(express.json());

// Connexion à PostgreSQL (paramètres fournis par docker-compose.yml via le .env)
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 5432,
});

// ---------- Validation avec Joi ----------
// Le contrôle du formulaire aide l'utilisateur ; seul celui-ci protège les données.

const titleSchema = Joi.string().trim().min(1).max(255).messages({
  'string.base': 'Le titre doit être du texte.',
  'string.empty': 'Le titre est obligatoire.',
  'string.min': 'Le titre est obligatoire.',
  'string.max': 'Le titre ne doit pas dépasser 255 caractères.',
  'any.required': 'Le titre est obligatoire.',
});

const completedSchema = Joi.boolean().messages({
  'boolean.base': 'Le champ completed doit être un booléen.',
});

const createTaskSchema = Joi.object({
  title: titleSchema.required(),
});

const updateTaskSchema = Joi.object({
  title: titleSchema,
  completed: completedSchema,
}).min(1).messages({
  'object.min': 'Aucun champ à modifier.',
});

// Middleware : valide req.body, retire les champs inconnus, puis passe à la route
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body ?? {}, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const messages = error.details.map((detail) => detail.message).join(' ');
      return res.status(400).json({ error: messages });
    }

    req.body = value;
    return next();
  };
}

// ---------- Routes ----------

// GET /tasks : liste les tâches, avec filtre optionnel ?status=completed|pending
app.get('/tasks', async (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT * FROM tasks';
  if (status === 'completed') sql += ' WHERE completed = TRUE';
  else if (status === 'pending') sql += ' WHERE completed = FALSE';
  sql += ' ORDER BY id';

  try {
    const result = await pool.query(sql);
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /tasks/:id
app.get('/tasks/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (Number.isNaN(id)) {
    return res.status(404).json({ error: 'Tâche non trouvée.' });
  }

  try {
    const result = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tâche non trouvée.' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /tasks
app.post('/tasks', validate(createTaskSchema), async (req, res) => {
  const { title } = req.body;

  try {
    const result = await pool.query(
      'INSERT INTO tasks (title) VALUES ($1) RETURNING *',
      [title]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /tasks/:id
app.put('/tasks/:id', validate(updateTaskSchema), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { title, completed } = req.body;

  if (Number.isNaN(id)) {
    return res.status(404).json({ error: 'Tâche non trouvée.' });
  }

  try {
    // COALESCE : si un champ n'est pas envoyé (null), on garde l'ancienne valeur
    const result = await pool.query(
      `UPDATE tasks
       SET title = COALESCE($1, title),
           completed = COALESCE($2, completed)
       WHERE id = $3
       RETURNING *`,
      [title ?? null, completed ?? null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tâche non trouvée.' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /tasks/:id/completed : inverse l'état complété / non complété
app.patch('/tasks/:id/completed', async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (Number.isNaN(id)) {
    return res.status(404).json({ error: 'Tâche non trouvée.' });
  }

  try {
    const result = await pool.query(
      'UPDATE tasks SET completed = NOT completed WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tâche non trouvée.' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /tasks/:id
app.delete('/tasks/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (Number.isNaN(id)) {
    return res.status(404).json({ error: 'Tâche non trouvée.' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tâche non trouvée.' });
    }

    return res.json({
      message: 'Tâche supprimée avec succès.',
      task: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Lancement du serveur (toujours en dernier)
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});