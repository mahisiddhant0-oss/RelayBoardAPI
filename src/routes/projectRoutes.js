import { Router } from 'express'
import prisma from '../prismaClient.js'
import requireWorkspaceRole from '../middleware/requireWorkspaceRole.js'
import requireProjectInWorkspace from '../middleware/requireProjectInWorkspace.js'

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

router.patch(
  '/:projectId',
  requireWorkspaceRole('OWNER', 'ADMIN'),
  requireProjectInWorkspace,
  async (req, res) => {
    const { name, description } = req.body

    if (name === undefined && description === undefined) {
      return res.status(400).json({ message: 'Name or description is required' })
    }
    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
      return res.status(400).json({ message: 'Project name must not be empty' })
    }
    if (description !== undefined && description !== null && typeof description !== 'string') {
      return res.status(400).json({ message: 'Project description must be text or null' })
    }

    try {
      const updated = await prisma.project.updateMany({
        where: { id: req.projectId, workspaceId: req.workspaceId },
        data: {
          ...(name !== undefined && { name: name.trim() }),
          ...(description !== undefined && { description: description?.trim() || null })
        }
      })

      if (updated.count === 0) {
        return res.status(404).json({ message: 'Project not found in this workspace' })
      }
      const project = await prisma.project.findUnique({ where: { id: req.projectId } })
      return res.status(200).json(project)
    } catch (error) {
      console.error(error)
      return res.status(500).json({ message: 'Unable to update project' })
    }
  }
)

router.delete(
  '/:projectId',
  requireWorkspaceRole('OWNER', 'ADMIN'),
  requireProjectInWorkspace,
  async (req, res) => {
    try {
      const deleted = await prisma.$transaction(async (tx) => {
        await tx.task.deleteMany({ where: { projectId: req.projectId } })
        return tx.project.deleteMany({
          where: { id: req.projectId, workspaceId: req.workspaceId }
        })
      })

      if (deleted.count === 0) {
        return res.status(404).json({ message: 'Project not found in this workspace' })
      }
      return res.status(204).send()
    } catch (error) {
      console.error(error)
      return res.status(500).json({ message: 'Unable to delete project' })
    }
  }
)

export default router
