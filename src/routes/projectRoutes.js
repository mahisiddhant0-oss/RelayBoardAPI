import { Router } from 'express'
import prisma from '../prismaClient.js'
import requireWorkspaceRole from '../middleware/requireWorkspaceRole.js'

const router = Router({ mergeParams: true })

router.get(
  '/',
  requireWorkspaceRole('OWNER', 'ADMIN', 'MEMBER'),
  async (req, res) => {
    try {
      const projects = await prisma.project.findMany({
        where: {
          workspaceId: req.workspaceId
        },
        include: {
          _count: {
            select: {
              tasks: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      return res.status(200).json(projects)
    } catch (error) {
      console.error(error)
      return res.status(500).json({
        message: 'Unable to fetch projects'
      })
    }
  }
)

router.post(
  '/',
  requireWorkspaceRole('OWNER', 'ADMIN'),
  async (req, res) => {
    const { name, description } = req.body

    if (typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        message: 'Project name is required'
      })
    }

    if (description !== undefined && typeof description !== 'string') {
      return res.status(400).json({
        message: 'Project description must be text'
      })
    }

    try {
      const project = await prisma.project.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          workspaceId: req.workspaceId
        }
      })

      return res.status(201).json(project)
    } catch (error) {
      console.error(error)
      return res.status(500).json({
        message: 'Unable to create project'
      })
    }
  }
)

export default router