import { Router } from 'express'
import prisma from '../prismaClient.js'
import requireWorkspaceRole from '../middleware/requireWorkspaceRole.js'

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

router.patch(
  '/:workspaceId',
  requireWorkspaceRole('OWNER'),
  async (req, res) => {
    const { name } = req.body
    if (typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ message: 'Workspace name is required' })
    }

    try {
      const updated = await prisma.workspace.updateMany({
        where: { id: req.workspaceId, ownerId: req.userId },
        data: { name: name.trim() }
      })
      if (updated.count === 0) {
        return res.status(404).json({ message: 'Workspace not found' })
      }
      const workspace = await prisma.workspace.findUnique({ where: { id: req.workspaceId } })
      return res.status(200).json(workspace)
    } catch (error) {
      console.error(error)
      return res.status(500).json({ message: 'Unable to update workspace' })
    }
  }
)

router.delete(
  '/:workspaceId',
  requireWorkspaceRole('OWNER'),
  async (req, res) => {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.task.deleteMany({ where: { project: { workspaceId: req.workspaceId } } })
        await tx.project.deleteMany({ where: { workspaceId: req.workspaceId } })
        await tx.workspaceMember.deleteMany({ where: { workspaceId: req.workspaceId } })
        await tx.workspace.delete({ where: { id: req.workspaceId, ownerId: req.userId } })
      })
      return res.status(204).send()
    } catch (error) {
      console.error(error)
      return res.status(500).json({ message: 'Unable to delete workspace' })
    }
  }
)


router.get(
  '/:workspaceId/members',
  requireWorkspaceRole('OWNER', 'ADMIN', 'MEMBER'),
  async (req, res) => {
    try {
      const members = await prisma.workspaceMember.findMany({
        where: {
          workspaceId: req.workspaceId
        },
        select: {
          role: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              username: true
            }
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      })

      return res.status(200).json(members)
    } catch (error) {
      console.error(error)
      return res.status(500).json({
        message: 'Unable to fetch workspace members'
      })
    }
  }
)

router.post(
  '/:workspaceId/members',
  requireWorkspaceRole('OWNER', 'ADMIN'),
  async (req, res) => {
    const { username, role = 'MEMBER' } = req.body

    if (typeof username !== 'string' || username.trim() === '') {
      return res.status(400).json({
        message: 'Username is required'
      })
    }

    if (!['MEMBER', 'ADMIN'].includes(role)) {
      return res.status(400).json({
        message: 'Role must be MEMBER or ADMIN'
      })
    }

    if (req.workspaceRole !== 'OWNER' && role === 'ADMIN') {
      return res.status(403).json({
        message: 'Only the workspace owner can add an admin'
      })
    }

    try {
      const user = await prisma.user.findUnique({
        where: {
          username: username.trim()
        },
        select: {
          id: true,
          username: true
        }
      })

      if (!user) {
        return res.status(404).json({
          message: 'User not found'
        })
      }

      const membership = await prisma.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId: req.workspaceId,
          role
        },
        select: {
          role: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              username: true
            }
          }
        }
      })

      return res.status(201).json(membership)
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(409).json({
          message: 'User is already a workspace member'
        })
      }

      console.error(error)
      return res.status(500).json({
        message: 'Unable to add workspace member'
      })
    }
  }
)

router.delete(
  '/:workspaceId/members/:userId',
  requireWorkspaceRole('OWNER', 'ADMIN'),
  async (req, res) => {
    const userId = Number(req.params.userId)

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'A valid user ID is required' })
    }

    try {
      const membership = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: { userId, workspaceId: req.workspaceId }
        },
        select: { role: true }
      })

      if (!membership) {
        return res.status(404).json({ message: 'Workspace member not found' })
      }

      if (membership.role === 'OWNER') {
        return res.status(403).json({ message: 'The workspace owner cannot be removed' })
      }

      if (req.workspaceRole === 'ADMIN' && membership.role === 'ADMIN') {
        return res.status(403).json({ message: 'Admins cannot remove other admins' })
      }

      await prisma.$transaction(async (tx) => {
        await tx.task.updateMany({
          where: { assigneeId: userId, project: { workspaceId: req.workspaceId } },
          data: { assigneeId: null }
        })
        await tx.workspaceMember.delete({
          where: { userId_workspaceId: { userId, workspaceId: req.workspaceId } }
        })
      })

      return res.status(204).send()
    } catch (error) {
      console.error(error)
      return res.status(500).json({ message: 'Unable to remove workspace member' })
    }
  }
)



export default router
