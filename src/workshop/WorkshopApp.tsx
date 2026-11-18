// Container: the child's whole flow. Name screen, chooser and studio.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildChooser } from './chooser.ts';
import type { Chooser as ChooserModel } from './chooser.ts';
import { ApiError } from '../net/http.ts';
import type { SessionResponse } from '../shared/api.ts';
import type { LevelId } from '../shared/levels.ts';
import { endSession, getSession, joinSession, listProjects, saveProject, saveProjectKeepalive } from './api.ts';
import { createAutosave, createAutosaveRegistry, localKey } from './autosave.ts';
import { Boundary } from './Boundary.tsx';
import { Chooser } from './Chooser.tsx';
import { sameSession } from './live.ts';
import { LevelScreen } from './LevelScreen.tsx';
import { StudioHost } from './StudioHost.tsx';
import { usePolling } from './usePolling.ts';

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const NETWORK_HINT = 'No hay conexión con el servidor.';

function JoinContainer({ onSession }: { onSession: (session: SessionResponse) => void }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const enter = useCallback(
    (level: LevelId, name: string) => {
      setBusy(true);
      setProblem(null);
      joinSession(level, name)
        .then(onSession)
        .catch((error: unknown) => {
          setBusy(false);
          setProblem(
            error instanceof ApiError && !error.isNetwork
              ? error.message
              : 'No pudimos entrar. Probá de nuevo en un momento.',
          );
        });
    },
    [onSession],
  );

  return <LevelScreen busy={busy} problem={problem} onEnter={enter} />;
}

interface SignedInProps {
  session: SessionResponse;
  onSignedOut: () => void;
}

function SignedIn({ session: initial, onSignedOut }: SignedInProps) {
  // The teacher can change the level or the active class while the child is here: the chooser
  // keeps this copy fresh, and a game that is open keeps the one it started with.
  const [session, setSession] = useState(initial);
  const { student, activeClass } = session;
  const storage = useMemo(browserStorage, []);
  const registry = useMemo(
    () =>
      createAutosaveRegistry((gameId) =>
        createAutosave({
          gameId,
          key: localKey(student.id, gameId),
          save: saveProject,
          storage,
          keepalive: saveProjectKeepalive,
        }),
      ),
    [student.id, storage],
  );
  const [gameId, setGameId] = useState<string | null>(null);

  useEffect(() => {
    const hide = () => registry.flushAllOnHide();
    const onVisibility = () => document.visibilityState === 'hidden' && hide();
    window.addEventListener('pagehide', hide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', hide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [registry]);

  const signOut = useCallback(async () => {
    await registry.flushAll();
    registry.disposeAll();
    await endSession().catch(() => undefined);
    onSignedOut();
  }, [registry, onSignedOut]);

  // A server that forgot this session (restart, expiry) sends the child back to the names.
  const forget = useCallback(() => {
    registry.disposeAll();
    onSignedOut();
  }, [registry, onSignedOut]);

  const backToChooser = useCallback(() => setGameId(null), []);

  if (gameId !== null) {
    return (
      <Boundary onBack={backToChooser}>
        <StudioHost
          studentId={student.id}
          level={student.level}
          gameId={gameId}
          registry={registry}
          storage={storage}
          onExit={backToChooser}
          onOpenGame={setGameId}
          onSignedOut={forget}
        />
      </Boundary>
    );
  }
  return (
    <ChooserContainer
      student={student}
      activeClass={activeClass}
      onOpen={setGameId}
      onNotMe={signOut}
      onSignedOut={forget}
      onSessionChange={setSession}
    />
  );
}

interface ChooserContainerProps {
  student: SessionResponse['student'];
  activeClass: SessionResponse['activeClass'];
  onOpen: (gameId: string) => void;
  onNotMe: () => void;
  onSignedOut: () => void;
  /** The server has a newer copy of the session (level, name or active class). */
  onSessionChange: (session: SessionResponse) => void;
}

function ChooserContainer({ student, activeClass, onOpen, onNotMe, onSignedOut, onSessionChange }: ChooserContainerProps) {
  const [model, setModel] = useState<ChooserModel>(() => buildChooser(student.level, activeClass, []));
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const leaving = useRef(false);
  const alive = useRef(true);
  const loadingRef = useRef(true);
  loadingRef.current = loading;
  // What the screen shows right now, for the poll to compare against.
  const shown = useRef<SessionResponse>({ student, activeClass });
  shown.current = { student, activeClass };
  const callbacks = useRef({ onSignedOut, onSessionChange });
  callbacks.current = { onSignedOut, onSessionChange };

  const signedOut = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    callbacks.current.onSignedOut();
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // First load and manual retry. Also asks for the session, because the level may have changed
  // while the child was inside a game; the chooser then appears already up to date.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const current = shown.current;
    Promise.all([listProjects(), getSession().catch(() => null)])
      .then(([{ projects }, session]) => {
        if (cancelled) return;
        const next = session ?? current;
        setModel(buildChooser(next.student.level, next.activeClass, projects));
        setProblem(null);
        setLoading(false);
        if (session && !sameSession(session, current)) callbacks.current.onSessionChange(session);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) return signedOut();
        setModel(buildChooser(current.student.level, current.activeClass, []));
        setProblem('No pudimos traer cuánto avanzaste. Los juegos igual se pueden abrir.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, signedOut]);

  // A level change by the teacher reaches the child here, without a reload. Only while the
  // chooser is on screen (it unmounts when a game opens) and never with an error for the child:
  // a failed poll is simply tried again later.
  usePolling(async () => {
    if (loadingRef.current || leaving.current) return;
    let session: SessionResponse;
    try {
      session = await getSession();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return signedOut();
      throw error;
    }
    if (!alive.current || sameSession(session, shown.current)) return;
    const { projects } = await listProjects();
    if (!alive.current) return;
    setModel(buildChooser(session.student.level, session.activeClass, projects));
    setProblem(null);
    callbacks.current.onSessionChange(session);
  });

  return (
    <Chooser
      student={student}
      model={model}
      problem={problem}
      loading={loading}
      onOpen={onOpen}
      onReload={() => setAttempt((n) => n + 1)}
      onNotMe={onNotMe}
    />
  );
}

type Boot = { kind: 'boot' } | { kind: 'error'; message: string } | { kind: 'names' } | { kind: 'in'; session: SessionResponse };

export function WorkshopApp() {
  const [boot, setBoot] = useState<Boot>({ kind: 'boot' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setBoot({ kind: 'boot' });
    getSession()
      .then((session) => !cancelled && setBoot({ kind: 'in', session }))
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && !error.isNetwork) setBoot({ kind: 'names' });
        else setBoot({ kind: 'error', message: NETWORK_HINT });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const toNames = useCallback(() => setBoot({ kind: 'names' }), []);
  const toSession = useCallback((session: SessionResponse) => setBoot({ kind: 'in', session }), []);

  if (boot.kind === 'boot') {
    return (
      <main className="w-screen gutter">
        <p className="w-status" role="status">Cargando…</p>
      </main>
    );
  }
  if (boot.kind === 'error') {
    return (
      <main className="w-screen gutter">
        <div className="w-wrap">
          <div className="w-message" role="alert">
            <h2>No pudimos conectar</h2>
            <p>{boot.message} Avisale a tu profe si sigue pasando.</p>
            <button className="btn btn-primary" onClick={() => setAttempt((n) => n + 1)}>Probar de nuevo</button>
          </div>
        </div>
      </main>
    );
  }
  if (boot.kind === 'names') return <JoinContainer onSession={toSession} />;
  return <SignedIn key={boot.session.student.id} session={boot.session} onSignedOut={toNames} />;
}
