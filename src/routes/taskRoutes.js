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
    const { status } = req.query

    if (status !== undefined && !taskStatuses.includes(status)) {
      return res.status(400).json({
        message: 'Status must be TODO, IN_PROGRESS, or DONE'
      })
    }

    try {
      const tasks = await prisma.task.findMany({
        where: {
          projectId: req.projectId,
          ...(status !== undefined && { status })
        },
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

router.patch(
  '/:taskId/assignee',
  requireWorkspaceRole('OWNER', 'ADMIN'),
  requireProjectInWorkspace,
  async (req, res) => {
    const taskId = Number(req.params.taskId)
    const { username } = req.body

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return res.status(400).json({
        message: 'A valid task ID is required'
      })
    }

    if (
      username !== null &&
      (typeof username !== 'string' || username.trim() === '')
    ) {
      return res.status(400).json({
        message: 'Username must be text or null'
      })
    }

    try {
      let assigneeId = null

      if (username !== null) {
        const membership = await prisma.workspaceMember.findFirst({
          where: {
            workspaceId: req.workspaceId,
            user: {
              username: username.trim()
            }
          },
          select: {
            userId: true
          }
        })

        if (!membership) {
          return res.status(400).json({
            message: 'Assignee must be a member of this workspace'
          })
        }

        assigneeId = membership.userId
      }

      const updateResult = await prisma.task.updateMany({
        where: {
          id: taskId,
          projectId: req.projectId
        },
        data: {
          assigneeId
        }
      })

      if (updateResult.count === 0) {
        return res.status(404).json({
          message: 'Task not found in this project'
        })
      }

      const task = await prisma.task.findUnique({
        where: {
          id: taskId
        },
        include: {
          assignee: {
            select: {
              id: true,
              username: true
            }
          }
        }
      })

      return res.status(200).json(task)
    } catch (error) {
      console.error(error)
      return res.status(500).json({
        message: 'Unable to update task assignee'
      })
    }
  }
)

router.patch(
  '/:taskId',
  requireWorkspaceRole(...workspaceMembers),
  requireProjectInWorkspace,
  async (req, res) => {
    const taskId = Number(req.params.taskId)
    const { title, description } = req.body

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return res.status(400).json({ message: 'A valid task ID is required' })
    }

    if (title === undefined && description === undefined) {
      return res.status(400).json({ message: 'Title or description is required' })
    }

    if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
      return res.status(400).json({ message: 'Task title must not be empty' })
    }

    if (description !== undefined && description !== null && typeof description !== 'string') {
      return res.status(400).json({ message: 'Task description must be text or null' })
    }

    try {
      const updateResult = await prisma.task.updateMany({
        where: { id: taskId, projectId: req.projectId },
        data: {
          ...(title !== undefined && { title: title.trim() }),
          ...(description !== undefined && { description: description?.trim() || null })
        }
      })

      if (updateResult.count === 0) {
        return res.status(404).json({ message: 'Task not found in this project' })
      }

      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { assignee: { select: { id: true, username: true } } }
      })
      return res.status(200).json(task)
    } catch (error) {
      console.error(error)
      return res.status(500).json({ message: 'Unable to update task' })
    }
  }
)

router.delete(
  '/:taskId',
  requireWorkspaceRole('OWNER', 'ADMIN'),
  requireProjectInWorkspace,
  async (req, res) => {
    const taskId = Number(req.params.taskId)

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return res.status(400).json({ message: 'A valid task ID is required' })
    }

    try {
      const deleteResult = await prisma.task.deleteMany({
        where: { id: taskId, projectId: req.projectId }
      })

      if (deleteResult.count === 0) {
        return res.status(404).json({ message: 'Task not found in this project' })
      }

      return res.status(204).send()
    } catch (error) {
      console.error(error)
      return res.status(500).json({ message: 'Unable to delete task' })
    }
  }
)

export default router
