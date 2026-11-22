import express from 'express'
import authRoutes from './routes/authRoutes.js'
import authMiddleware from './middleware/authMiddleware.js'
import workspaceRoutes from './routes/workspaceRoutes.js'
import projectRoutes from './routes/projectRoutes.js'
import taskRoutes from './routes/taskRoutes.js'

const app = express()
const PORT = process.env.PORT || 5003

app.use(express.json())

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

app.listen(PORT , ()=> {console.log(`Server running on port : ${PORT}`)})
