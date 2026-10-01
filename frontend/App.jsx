import { useEffect, useRef, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL
const MAX_TITLE_LENGTH = 255
const MAX_ASSIGNEE_LENGTH = 50
const CONTACT_EMAIL = 'contact@association.example'

// Prénom : lettres (accents compris), espaces, tirets et apostrophes (comme côté API)
const NAME_PATTERN = /^[\p{L}][\p{L} '’-]*$/u

const FILTERS = [
  { value: 'all', label: 'Toutes' },
  { value: 'pending', label: 'Non complétées' },
  { value: 'completed', label: 'Complétées' },
]

// Contrôles du formulaire : ils aident l'utilisateur, l'API revérifie tout de son côté
function validateTitle(value) {
  if (value === '') return 'Le titre est obligatoire.'
  if (value.length > MAX_TITLE_LENGTH) {
    return `Le titre ne doit pas dépasser ${MAX_TITLE_LENGTH} caractères.`
  }
  return ''
}

function validateAssignee(value) {
  if (value === '') return '' // facultatif
  if (value.length > MAX_ASSIGNEE_LENGTH) {
    return `Le prénom ne doit pas dépasser ${MAX_ASSIGNEE_LENGTH} caractères.`
  }
  if (!NAME_PATTERN.test(value)) {
    return 'Le prénom ne doit contenir que des lettres, espaces, tirets ou apostrophes.'
  }
  return ''
}

// Appel générique à l'API : renvoie le JSON, ou lève une erreur lisible
async function request(path, options) {
  const response = await fetch(`${API_URL}${path}`, options)
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const error = new Error(data?.error || 'Erreur serveur.')
    error.fromApi = true
    throw error
  }
  return data
}

// Message affiché à l'utilisateur quand un appel échoue
function toErrorText(error) {
  return error.fromApi
    ? error.message
    : "Impossible de joindre l'API. Vérifiez qu'elle est démarrée."
}

function App() {
  const [tasks, setTasks] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState('')
  const [titleError, setTitleError] = useState('')
  const [assigneeError, setAssigneeError] = useState('')
  const [message, setMessage] = useState(null) // { type: 'success' | 'error', text }
  const titleInputRef = useRef(null)
  const assigneeInputRef = useRef(null)

  // Charge la liste au démarrage et à chaque changement de filtre
  useEffect(() => {
    let ignore = false

    async function loadTasks() {
      try {
        const query = filter === 'all' ? '' : `?status=${filter}`
        const data = await request(`/tasks${query}`)
        if (!ignore) setTasks(data)
      } catch (error) {
        if (!ignore) setMessage({ type: 'error', text: toErrorText(error) })
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    loadTasks()
    return () => {
      ignore = true
    }
  }, [filter])

  // Une tâche reste visible seulement si elle correspond au filtre actif
  function matchesFilter(task) {
    return filter === 'all' || (filter === 'completed') === task.completed
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const cleanTitle = title.trim()
    const cleanAssignee = assignee.trim()

    const newTitleError = validateTitle(cleanTitle)
    const newAssigneeError = validateAssignee(cleanAssignee)
    setTitleError(newTitleError)
    setAssigneeError(newAssigneeError)

    if (newTitleError) {
      titleInputRef.current.focus()
      return
    }
    if (newAssigneeError) {
      assigneeInputRef.current.focus()
      return
    }

    try {
      const created = await request('/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Le prénom n'est envoyé que s'il est renseigné (minimisation)
        body: JSON.stringify({
          title: cleanTitle,
          assignee: cleanAssignee || undefined,
        }),
      })
      if (matchesFilter(created)) setTasks((previous) => [...previous, created])
      setTitle('')
      setAssignee('')
      setMessage({ type: 'success', text: `Tâche « ${created.title} » ajoutée.` })
      titleInputRef.current.focus()
    } catch (error) {
      setMessage({ type: 'error', text: toErrorText(error) })
    }
  }

  async function handleToggle(task) {
    try {
      const updated = await request(`/tasks/${task.id}/completed`, { method: 'PATCH' })
      setTasks((previous) =>
        previous
          .map((item) => (item.id === updated.id ? updated : item))
          .filter(matchesFilter)
      )
      setMessage({
        type: 'success',
        text: `Tâche « ${updated.title} » marquée comme ${
          updated.completed ? 'complétée' : 'non complétée'
        }.`,
      })
    } catch (error) {
      setMessage({ type: 'error', text: toErrorText(error) })
    }
  }

  // Droit à l'effacement : retire le prénom sans supprimer la tâche
  async function handleRemoveAssignee(task) {
    try {
      const updated = await request(`/tasks/${task.id}/assignee`, { method: 'DELETE' })
      setTasks((previous) =>
        previous.map((item) => (item.id === updated.id ? updated : item))
      )
      setMessage({
        type: 'success',
        text: `Bénévole retiré de la tâche « ${updated.title} ».`,
      })
    } catch (error) {
      setMessage({ type: 'error', text: toErrorText(error) })
    }
  }

  async function handleDelete(task) {
    try {
      await request(`/tasks/${task.id}`, { method: 'DELETE' })
      setTasks((previous) => previous.filter((item) => item.id !== task.id))
      setMessage({ type: 'success', text: `Tâche « ${task.title} » supprimée.` })
    } catch (error) {
      setMessage({ type: 'error', text: toErrorText(error) })
    }
  }

  return (
    <>
      <a className="skip-link" href="#contenu">
        Aller au contenu principal
      </a>

      <header className="app-header">
        <div className="container">
          <h1>Gestion des tâches</h1>
        </div>
      </header>

      <main id="contenu" className="container">
        {/* Zones d'annonce pour lecteurs d'écran : toujours présentes dans la page */}
        <div className="messages">
          <p role="status" className="message message-success">
            {message?.type === 'success' ? message.text : ''}
          </p>
          <p role="alert" className="message message-error">
            {message?.type === 'error' ? message.text : ''}
          </p>
        </div>

        <section aria-labelledby="add-heading">
          <h2 id="add-heading">Ajouter une tâche</h2>
          <form onSubmit={handleSubmit} noValidate className="add-form">
            <div className="field">
              <label htmlFor="task-title">Titre de la tâche</label>
              <input
                id="task-title"
                type="text"
                ref={titleInputRef}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={MAX_TITLE_LENGTH}
                required
                aria-invalid={titleError ? 'true' : 'false'}
                aria-describedby={titleError ? 'task-title-error' : undefined}
              />
              {titleError && (
                <p id="task-title-error" className="field-error">
                  {titleError}
                </p>
              )}
            </div>

            <div className="field">
              <label htmlFor="task-assignee">Prénom du bénévole (facultatif)</label>
              <input
                id="task-assignee"
                type="text"
                ref={assigneeInputRef}
                value={assignee}
                onChange={(event) => setAssignee(event.target.value)}
                maxLength={MAX_ASSIGNEE_LENGTH}
                autoComplete="off"
                aria-invalid={assigneeError ? 'true' : 'false'}
                aria-describedby={
                  assigneeError
                    ? 'task-assignee-error privacy-notice'
                    : 'privacy-notice'
                }
              />
              {assigneeError && (
                <p id="task-assignee-error" className="field-error">
                  {assigneeError}
                </p>
              )}
            </div>

            <button type="submit" className="button button-primary">
              Ajouter la tâche
            </button>
          </form>

          {/* RGPD : information des personnes (qui, pourquoi, combien de temps, comment) */}
          <p id="privacy-notice" className="privacy-notice">
            L’association collecte le prénom saisi uniquement pour savoir quel
            bénévole s’occupe de la tâche. Il est conservé tant que la tâche existe
            et supprimé en même temps qu’elle. Pour le faire retirer plus tôt, utilisez
            le bouton « Retirer le bénévole » ou écrivez à{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </section>

        <section aria-labelledby="list-heading">
          <h2 id="list-heading">Liste des tâches</h2>

          <div role="group" aria-label="Filtrer les tâches" className="filters">
            {FILTERS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className="button button-filter"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {loading && <p className="status-text">Chargement des tâches…</p>}

          {!loading && tasks.length === 0 && (
            <p className="status-text">Aucune tâche à afficher.</p>
          )}

          {tasks.length > 0 && (
            <ul className="task-list">
              {tasks.map((task) => (
                <li key={task.id} className="task">
                  <input
                    type="checkbox"
                    id={`task-${task.id}`}
                    checked={task.completed}
                    onChange={() => handleToggle(task)}
                  />
                  <div className="task-content">
                    {/* Affiché comme du texte : React échappe le HTML (pas de XSS) */}
                    <label htmlFor={`task-${task.id}`}>{task.title}</label>
                    {task.assignee && (
                      <span className="task-assignee">Bénévole : {task.assignee}</span>
                    )}
                  </div>
                  <div className="task-actions">
                    {task.assignee && (
                      <button
                        type="button"
                        className="button button-secondary"
                        aria-label={`Retirer le bénévole ${task.assignee} de la tâche ${task.title}`}
                        onClick={() => handleRemoveAssignee(task)}
                      >
                        Retirer le bénévole
                      </button>
                    )}
                    <button
                      type="button"
                      className="button button-danger"
                      aria-label={`Supprimer la tâche ${task.title}`}
                      onClick={() => handleDelete(task)}
                    >
                      Supprimer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  )
}

export default App
