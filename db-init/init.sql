CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  -- RGPD (minimisation) : uniquement le PRÉNOM du bénévole, facultatif
  assignee VARCHAR(50)
);

-- Données de départ 100 % fictives : prénoms inventés, jamais ceux de vraies personnes
INSERT INTO tasks (title, completed, assignee) VALUES
  ('Réviser Git', FALSE, 'Zélinoa'),
  ('Préparer la distribution des repas', FALSE, 'Maxelo'),
  ('Imprimer les affiches de l''association', TRUE, 'Lunévia'),
  ('Appeler le fournisseur de matériel', FALSE, NULL);
