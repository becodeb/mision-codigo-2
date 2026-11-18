import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loginAdmin, startTestServer } from './test-helpers.ts';
import type { TestServer } from './test-helpers.ts';

let server: TestServer;

beforeEach(async () => {
  server = await startTestServer();
});
afterEach(() => server.close());

describe('enter by level and name', () => {
  it('creates the child in that level and signs them in', async () => {
    const child = server.client();
    const join = await child.post('/api/join', { level: 3, name: '  Luna   Pérez ' });
    expect(join.status).toBe(200);
    expect(join.body.student).toEqual({ id: expect.any(Number), name: 'Luna Pérez', group: 'Nivel 3', level: 3 });
    expect((await child.get('/api/session')).body.student.name).toBe('Luna Pérez');
  });

  it('finds the same child again by level and name, ignoring case', async () => {
    const first = await server.client().post('/api/join', { level: 2, name: 'Mateo' });
    const again = await server.client().post('/api/join', { level: 2, name: 'mateo' });
    expect(again.body.student.id).toBe(first.body.student.id);
    const otherLevel = await server.client().post('/api/join', { level: 4, name: 'Mateo' });
    expect(otherLevel.body.student.id).not.toBe(first.body.student.id);
    expect(otherLevel.body.student.level).toBe(4);
  });

  it('shows the children to the teacher under their level', async () => {
    await server.client().post('/api/join', { level: 1, name: 'Sol' });
    const admin = server.client();
    await loginAdmin(admin);
    const list = await admin.get('/api/admin/students');
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).toContain('Nivel 1');
  });

  it('rejects an empty name or a level outside 1 to 5', async () => {
    expect((await server.client().post('/api/join', { level: 3, name: '   ' })).status).toBe(400);
    expect((await server.client().post('/api/join', { level: 6, name: 'Ana' })).status).toBe(400);
    expect((await server.client().post('/api/join', { level: 3, name: 'A\u0007na' })).status).toBe(400);
  });
});
