import express from 'express'
import authRoutes from './routes/authRoutes.js'
import authMiddleware from './middleware/authMiddleware.js'
import workspaceRoutes from './routes/workspaceRoutes.js'
import projectRoutes from './routes/projectRoutes.js'
import taskRoutes from './routes/taskRoutes.js'

const app = express()
const PORT = process.env.PORT || 5003

app.use(express.json())

app.use((req, res, next) => {
    if (
        ['POST', 'PUT', 'PATCH'].includes(req.method) &&
        (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body))
    ) {
        return res.status(400).json({ message: 'Request body must be a JSON object' })
    }
    return next()
})

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' })
})

app.use('/auth', authRoutes)
app.use('/workspaces', authMiddleware, workspaceRoutes)

app.use(
  '/workspaces/:workspaceId/projects',
  authMiddleware,
  projectRoutes
)

app.use(
  '/workspaces/:workspaceId/projects/:projectId/tasks',
  authMiddleware,
  taskRoutes
)

app.use((req, res) => {
    res.status(404).json({
        message: 'Route not found'
    })
})

app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({ message: 'Invalid JSON request body' })
    }
    console.error(error)
    return res.status(500).json({ message: 'Internal server error' })
})

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => console.log(`Server running on port : ${PORT}`))
}

export default app
