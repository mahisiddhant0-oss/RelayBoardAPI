import { Router } from 'express'
import prisma from '../prismaClient.js'
import requireProjectInWorkspace from '../middleware/requireProjectInWorkspace.js'
import requireWorkspaceRole from '../middleware/requireWorkspaceRole.js'

const router = Router({ mergeParams: true })
const workspaceMembers = ['OWNER', 'ADMIN', 'MEMBER']
const taskStatuses = ['TODO', 'IN_PROGRESS', 'DONE']

router.get(
  '/',
  requireWorkspaceRole(...workspaceMembers),
  requireProjectInWorkspace,
  async (req, res) => {
    try {
      const tasks = await prisma.task.findMany({
        where: { projectId: req.projectId },
        include: {
          assignee: {
            select: { id: true, username: true }
          }
        },
        orderBy: { updatedAt: 'desc' }
      })

      return res.status(200).json(tasks)
    } catch (error) {
      console.error(error)
      return res.status(500).json({ message: 'Unable to fetch tasks' })
    }
  }
)

router.post(
  '/',
  requireWorkspaceRole(...workspaceMembers),
  requireProjectInWorkspace,
  async (req, res) => {
    const { title, description } = req.body

    if (typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ message: 'Task title is required' })
    }

    if (description !== undefined && typeof description !== 'string') {
      return res.status(400).json({ message: 'Task description must be text' })
    }

    try {
      const task = await prisma.task.create({
        data: {
          title: title.trim(),
          description: description?.trim() || null,
          projectId: req.projectId
        },
        include: {
          assignee: {
            select: { id: true, username: true }
          }
        }
      })

      return res.status(201).json(task)
    } catch (error) {
      console.error(error)
      return res.status(500).json({ message: 'Unable to create task' })
    }
  }
)

router.patch(
  '/:taskId/status',
  requireWorkspaceRole(...workspaceMembers),
  requireProjectInWorkspace,
  async (req, res) => {
    const taskId = Number(req.params.taskId)
    const { status } = req.body

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return res.status(400).json({ message: 'A valid task ID is required' })
    }

    if (!taskStatuses.includes(status)) {
      return res.status(400).json({
        message: 'Status must be TODO, IN_PROGRESS, or DONE'
      })
    }

    try {
      const updateResult = await prisma.task.updateMany({
        where: {
          id: taskId,
          projectId: req.projectId
        },
        data: { status }
      })

      if (updateResult.count === 0) {
        return res.status(404).json({
          message: 'Task not found in this project'
        })
      }

      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: {
          assignee: {
            select: { id: true, username: true }
          }
        }
      })

      return res.status(200).json(task)
    } catch (error) {
      console.error(error)
      return res.status(500).json({
        message: 'Unable to update task status'
      })
    }
  }
)

export default router
