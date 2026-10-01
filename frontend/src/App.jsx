import { useEffect, useRef, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL
const MAX_TITLE_LENGTH = 255

const FILTERS = [
  { value: 'all', label: 'Toutes' },
  { value: 'pending', label: 'Non complétées' },
  { value: 'completed', label: 'Complétées' },
]

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
  const [titleError, setTitleError] = useState('')
  const [message, setMessage] = useState(null) // { type: 'success' | 'error', text }
  const titleInputRef = useRef(null)

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

    // Contrôle côté formulaire : aide l'utilisateur (l'API revérifie de son côté)
    if (cleanTitle === '') {
      setTitleError('Le titre est obligatoire.')
      titleInputRef.current.focus()
      return
    }
    if (cleanTitle.length > MAX_TITLE_LENGTH) {
      setTitleError(`Le titre ne doit pas dépasser ${MAX_TITLE_LENGTH} caractères.`)
      titleInputRef.current.focus()
      return
    }
    setTitleError('')

    try {
      const created = await request('/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: cleanTitle }),
      })
      if (matchesFilter(created)) setTasks((previous) => [...previous, created])
      setTitle('')
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
      <header className="app-header">
        <h1>Gestion des tâches</h1>
      </header>

      <main>
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
            <button type="submit" className="button button-primary">
              Ajouter la tâche
            </button>
          </form>
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

          {loading && <p>Chargement des tâches…</p>}

          {!loading && tasks.length === 0 && <p>Aucune tâche à afficher.</p>}

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
                  {/* Le titre est affiché comme du texte : React échappe le HTML (pas de XSS) */}
                  <label htmlFor={`task-${task.id}`}>{task.title}</label>
                  <button
                    type="button"
                    className="button button-danger"
                    aria-label={`Supprimer la tâche ${task.title}`}
                    onClick={() => handleDelete(task)}
                  >
                    Supprimer
                  </button>
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