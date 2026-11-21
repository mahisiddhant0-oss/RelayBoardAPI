import express from 'express'
import authRoutes from './routes/authRoutes.js'
import todoRoutes from './routes/todoRoutes.js'
import authMiddleware from './middleware/authMiddleware.js'


const app = express()
const PORT = process.env.PORT || 5003

app.use(express.json())

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' })
})

app.use('/auth', authRoutes)

app.use('/todos',authMiddleware , todoRoutes)

app.use((req, res) => {
    res.status(404).json({
        message: 'Route not found'
    })
})

app.listen(PORT , ()=> {console.log(`Server running on port : ${PORT}`)})
