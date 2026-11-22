import prisma from '../prismaClient.js'

function requireWorkspaceRole(...allowedRoles) {
  return async (req, res, next) => {
    const workspaceId = Number(req.params.workspaceId)

if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
  return res.status(400).json({
    message: 'A valid workspace ID is required'
  })
}

try {
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId: req.userId,
        workspaceId
      }
    },
    select: {
      role: true
    }
  })

  if (!membership) {
    return res.status(403).json({
      message: 'You are not a member of this workspace'
    })
  }

  if (!allowedRoles.includes(membership.role)) {
    return res.status(403).json({
      message: 'You do not have permission for this action'
    })
  }

  req.workspaceId = workspaceId
  req.workspaceRole = membership.role

  return next()
} catch (error) {
  console.error(error)
  return res.status(500).json({
    message: 'Unable to verify workspace access'
  })
}
  }
}

export default requireWorkspaceRole 