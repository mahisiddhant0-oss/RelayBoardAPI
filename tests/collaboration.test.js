import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import app from '../src/server.js'
import prisma from '../src/prismaClient.js'

let server
let baseUrl
const ids = {
  users: [], workspace: null, project: null, task: null,
  otherWorkspace: null, otherProject: null
}

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve)
  })
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  try {
    if (ids.task) await prisma.task.deleteMany({ where: { id: ids.task } })
    if (ids.project) await prisma.project.deleteMany({ where: { id: ids.project } })
    if (ids.workspace) {
      await prisma.workspaceMember.deleteMany({ where: { workspaceId: ids.workspace } })
      await prisma.workspace.deleteMany({ where: { id: ids.workspace } })
    }
    if (ids.otherProject) await prisma.project.deleteMany({ where: { id: ids.otherProject } })
    if (ids.otherWorkspace) {
      await prisma.workspaceMember.deleteMany({ where: { workspaceId: ids.otherWorkspace } })
      await prisma.workspace.deleteMany({ where: { id: ids.otherWorkspace } })
    }
    if (ids.users.length) await prisma.user.deleteMany({ where: { id: { in: ids.users } } })
  } finally {
    await prisma.$disconnect()
    if (server) await new Promise((resolve) => server.close(resolve))
  }
})

async function request(path, method = 'GET', token, body) {
  const response = await fetch(baseUrl + path, {
    method,
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(body !== undefined && { 'Content-Type': 'application/json' })
    },
    ...(body !== undefined && { body: JSON.stringify(body) })
  })
  return { status: response.status, body: response.status === 204 ? null : await response.json() }
}

test('workspace roles restrict member management and task assignment to workspace members', async () => {
  const invalidJson = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{invalid'
  })
  assert.equal(invalidJson.status, 400)
  assert.deepEqual(await invalidJson.json(), { message: 'Invalid JSON request body' })
  assert.equal((await request('/auth/register', 'POST', undefined, null)).status, 400)
  assert.equal((await request('/auth/register', 'POST')).status, 400)

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  async function register(kind) {
    const username = `${kind}-${suffix}@example.com`
    const registration = await request('/auth/register', 'POST', undefined, {
      username,
      password: 'test-password-123'
    })
    assert.equal(registration.status, 201)
    const user = await prisma.user.findUnique({ where: { username }, select: { id: true } })
    ids.users.push(user.id)
    return { username, token: registration.body.token }
  }

  const owner = await register('owner')
  const member = await register('member')
  const outsider = await register('outsider')
  const admin = await register('admin')

  assert.equal((await request('/auth/login', 'POST', undefined, {
    username: owner.username, password: 'incorrect-password'
  })).status, 401)
  const login = await request('/auth/login', 'POST', undefined, {
    username: owner.username, password: 'test-password-123'
  })
  assert.equal(login.status, 200)
  assert.equal(typeof login.body.token, 'string')
  assert.equal((await request('/workspaces')).status, 401)
  const malformedAuthorization = await fetch(`${baseUrl}/workspaces`, {
    headers: { Authorization: `Bearer${login.body.token}` }
  })
  assert.equal(malformedAuthorization.status, 401)
  assert.equal((await request('/workspaces', 'GET', 'not-a-jwt')).status, 401)

  const workspace = await request('/workspaces', 'POST', owner.token, { name: 'Permission test' })
  assert.equal(workspace.status, 201)
  ids.workspace = workspace.body.id
  const root = `/workspaces/${ids.workspace}`
  const renamedWorkspace = await request(root, 'PATCH', owner.token, { name: 'Updated workspace' })
  assert.equal(renamedWorkspace.status, 200)
  assert.equal(renamedWorkspace.body.name, 'Updated workspace')

  assert.equal((await request(`${root}/members`, 'POST', owner.token, {
    username: member.username, role: 'MEMBER'
  })).status, 201)
  assert.equal((await request(`${root}/members`, 'POST', owner.token, {
    username: admin.username, role: 'ADMIN'
  })).status, 201)
  assert.equal((await request(`${root}/members`, 'POST', owner.token, {
    username: member.username
  })).status, 409)
  assert.equal((await request(`${root}/members`, 'POST', member.token, {
    username: outsider.username
  })).status, 403)
  assert.equal((await request(`${root}/members`, 'POST', admin.token, {
    username: outsider.username, role: 'ADMIN'
  })).status, 403)
  assert.equal((await request(`${root}/members`, 'GET', outsider.token)).status, 403)
  assert.equal((await request(root, 'PATCH', admin.token, { name: 'Denied' })).status, 403)
  assert.equal((await request(root, 'DELETE', admin.token)).status, 403)

  const project = await request(`${root}/projects`, 'POST', owner.token, { name: 'Private project' })
  assert.equal(project.status, 201)
  ids.project = project.body.id
  const projectPath = `${root}/projects/${ids.project}`
  assert.equal((await request(projectPath, 'PATCH', member.token, { name: 'No access' })).status, 403)
  assert.equal((await request(projectPath, 'DELETE', member.token)).status, 403)
  const renamed = await request(projectPath, 'PATCH', admin.token, { name: 'Renamed project' })
  assert.equal(renamed.status, 200)
  assert.equal(renamed.body.name, 'Renamed project')
  const tasks = `${root}/projects/${ids.project}/tasks`
  const task = await request(tasks, 'POST', member.token, { title: 'Team task' })
  assert.equal(task.status, 201)
  ids.task = task.body.id
  const assignee = `${tasks}/${ids.task}/assignee`

  const otherWorkspace = await request('/workspaces', 'POST', owner.token, { name: 'Separate team' })
  assert.equal(otherWorkspace.status, 201)
  ids.otherWorkspace = otherWorkspace.body.id
  const otherRoot = `/workspaces/${ids.otherWorkspace}`
  const otherProject = await request(`${otherRoot}/projects`, 'POST', owner.token, { name: 'Other project' })
  assert.equal(otherProject.status, 201)
  ids.otherProject = otherProject.body.id

  assert.equal((await request(`${root}/projects/${ids.otherProject}/tasks`, 'GET', owner.token)).status, 404)
  assert.equal((await request(`${root}/projects/${ids.otherProject}`, 'PATCH', owner.token, { name: 'Wrong team' })).status, 404)
  assert.equal((await request(`${otherRoot}/projects/${ids.project}/tasks`, 'GET', owner.token)).status, 404)
  assert.equal((await request(`${otherRoot}/projects`, 'GET', outsider.token)).status, 403)

  assert.equal((await request(`${tasks}?status=INVALID`, 'GET', owner.token)).status, 400)
  assert.equal((await request(`${tasks}?status=DONE`, 'GET', owner.token)).body.length, 0)
  assert.equal((await request(`${tasks}?status=TODO`, 'GET', owner.token)).body.length, 1)

  const statusChanged = await request(`${tasks}/${ids.task}/status`, 'PATCH', member.token, {
    status: 'IN_PROGRESS'
  })
  assert.equal(statusChanged.status, 200)
  assert.equal(statusChanged.body.status, 'IN_PROGRESS')
  assert.equal((await request(`${tasks}?status=TODO`, 'GET', owner.token)).body.length, 0)
  assert.equal((await request(`${tasks}?status=IN_PROGRESS`, 'GET', owner.token)).body.length, 1)
  assert.equal((await request(`${tasks}/${ids.task}/status`, 'PATCH', member.token, {
    status: 'INVALID'
  })).status, 400)

  assert.equal((await request(assignee, 'PATCH', owner.token, {
    username: outsider.username
  })).status, 400)
  const assigned = await request(assignee, 'PATCH', owner.token, { username: member.username })
  assert.equal(assigned.status, 200)
  assert.equal(assigned.body.assignee.username, member.username)
  assert.equal((await request(assignee, 'PATCH', member.token, { username: null })).status, 403)

  const edited = await request(`${tasks}/${ids.task}`, 'PATCH', member.token, { title: 'Updated task' })
  assert.equal(edited.status, 200)
  assert.equal(edited.body.title, 'Updated task')
  assert.equal((await request(`${tasks}/${ids.task}`, 'DELETE', member.token)).status, 403)
  assert.equal((await request(`${root}/projects/999999/tasks/${ids.task}`, 'DELETE', owner.token)).status, 404)
  assert.equal((await request(`${root}/members/${ids.users[0]}`, 'DELETE', owner.token)).status, 403)
  assert.equal((await request(`${root}/members/${ids.users[3]}`, 'DELETE', admin.token)).status, 403)
  assert.equal((await request(`${root}/members/${ids.users[1]}`, 'DELETE', admin.token)).status, 204)
  assert.equal((await request(tasks, 'GET', member.token)).status, 403)
  const afterRemoval = await request(tasks, 'GET', owner.token)
  assert.equal(afterRemoval.body[0].assignee, null)
  assert.equal((await request(`${tasks}/${ids.task}`, 'DELETE', owner.token)).status, 204)
  ids.task = null
  const remaining = await request(tasks, 'POST', owner.token, { title: 'Deleted with project' })
  assert.equal(remaining.status, 201)
  assert.equal((await request(projectPath, 'DELETE', admin.token)).status, 204)
  ids.project = null
  assert.equal((await request(tasks, 'GET', owner.token)).status, 404)
  assert.equal((await request(root, 'DELETE', owner.token)).status, 204)
  ids.workspace = null
  assert.equal((await request(otherRoot, 'DELETE', owner.token)).status, 204)
  ids.otherProject = null
  ids.otherWorkspace = null
})
