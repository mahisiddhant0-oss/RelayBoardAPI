import { Router } from 'express'
import prisma from '../prismaClient.js'

const router = Router()









router.get('/', async (req, res) => {
  try {
    const workspaces = await prisma.workspace.findMany({
      where: {
        members: {
          some: {
            userId: req.userId
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return res.status(200).json(workspaces)
  } catch (error) {
    console.error(error)
    return res.status(500).json({
      message: 'Unable to fetch workspaces'
    })
  }
})

router.post('/', async (req, res) => {
  const { name } = req.body

  if (typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({
      message: 'Workspace name is required'
    })
  }

  try {
    const workspace = await prisma.$transaction(async (tx) => {
      const createdWorkspace = await tx.workspace.create({
        data: {
          name: name.trim(),
          ownerId: req.userId
        }
      })

      await tx.workspaceMember.create({
        data: {
          userId: req.userId,
          workspaceId: createdWorkspace.id,
          role: 'OWNER'
        }
      })

      return createdWorkspace
    })

    return res.status(201).json(workspace)
  } catch (error) {
    console.error(error)
    return res.status(500).json({
      message: 'Unable to create workspace'
    })
  }
})
export default router