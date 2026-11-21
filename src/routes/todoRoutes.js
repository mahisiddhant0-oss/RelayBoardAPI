import express from 'express'

import prisma from '../prismaClient.js'

const router = express.Router()

//get all todos for logged-in user
router.get('/',async(req,res)=>{
    const todos = await prisma.todo.findMany({
        where : {
            userId : req.userId
        }
    })
    res.json(todos)
})

router.post('/', async (req,res)=>{
    const { task } = req.body
    if (typeof task !== 'string' || task.trim() === '') {
        return res.status(400).json({
            message: 'Task is required'
        })
    }

    const todo = await prisma.todo.create({
        data : {
            task: task.trim(),
            userId : req.userId
        }
    })

    return res.status(201).json(todo)

}
)

router.put('/:id',async(req,res)=>{
    const {completed} = req.body
    const {id} =req.params
    const updateResult = await prisma.todo.updateMany({
        where : {
            id : parseInt(id),
            userId : req.userId
        },
        data : {
            completed : !!completed
        }


    })


    if (updateResult.count === 0) {
        return res.status(404).json({
            message: 'Todo not found'
        })
    }

    return res.json({
    message: 'Todo updated'
    })
})

router.delete('/:id', async (req, res) => {
  const { id } = req.params

  const deleteResult = await prisma.todo.deleteMany({
    where: {
      id: Number(id),
      userId: req.userId
    }
  })

  if (deleteResult.count === 0) {
    return res.status(404).json({
      message: 'Todo not found'
    })
  }

  return res.status(204).send()
})
export default router