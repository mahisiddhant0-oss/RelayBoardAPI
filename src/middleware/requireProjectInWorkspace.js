import prisma from '../prismaClient.js'

async function requireProjectInWorkspace(req, res, next) {
  const projectId = Number(req.params.projectId)

  if (!Number.isInteger(projectId) || projectId <= 0) {
    return res.status(400).json({
      message: 'A valid project ID is required'
    })
  }

  try {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspaceId: req.workspaceId
      },
      select: { id: true }
    })

    if (!project) {
      return res.status(404).json({
        message: 'Project not found in this workspace'
      })
    }

    req.projectId = projectId
    return next()
  } catch (error) {
    console.error(error)
    return res.status(500).json({
      message: 'Unable to verify project access'
    })
  }
}

export default requireProjectInWorkspace
