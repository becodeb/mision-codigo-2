// Entry screen of Misión Código 2: the child taps the number of their level (which says the grade)
// and writes their name. No list of names: the child is created, or found again, by level and name.
import { useEffect, useId, useRef, useState } from 'react';
import { LEVELS, type LevelId } from '../shared/levels.ts';
import { Robi } from './Robi.tsx';

interface Props {
  busy: boolean;
  /** A problem while entering, shown under the name box. */
  problem: string | null;
  onEnter: (level: LevelId, name: string) => void;
}

export function LevelScreen({ busy, problem, onEnter }: Props) {
  const [level, setLevel] = useState<LevelId | null>(null);
  const [name, setName] = useState('');
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const info = level ? LEVELS[level - 1] : null;
  const clean = name.trim().replace(/\s+/g, ' ');

  useEffect(() => {
    if (level) input.current?.focus();
  }, [level]);

  if (!info) {
    return (
      <main className="w-screen gutter">
        <div className="w-wrap">
          <header className="n-hero">
            <Robi className="n-robi" />
            <div>
              <h1>¿En qué nivel estás?</h1>
              <p className="n-lead">Tocá tu número.</p>
            </div>
          </header>
          <ul className="l-levels">
            {LEVELS.map((l) => (
              <li key={l.id}>
                <button className={`l-level l-level-${l.id}`} onClick={() => setLevel(l.id)}>
                  <span className="l-num">{l.id}</span>
                  <span className="l-grade">{l.grade}</span>
                </button>
              </li>
            ))}
          </ul>
          <footer className="w-foot">
            <a href="/docente">Soy docente</a>
          </footer>
        </div>
      </main>
    );
  }

  return (
    <main className="w-screen gutter">
      <div className="w-wrap">
        <header className="n-hero">
          <span className={`l-badge l-level-${info.id}`} aria-hidden="true">{info.id}</span>
          <div>
            <h1>¿Cómo te llamás?</h1>
            <p className="n-lead">Nivel {info.id} · {info.grade}</p>
          </div>
        </header>
        <form
          className="n-search"
          onSubmit={(event) => {
            event.preventDefault();
            if (clean && !busy) onEnter(info.id, clean);
          }}
        >
          <label htmlFor={inputId} className="sr-only">Tu nombre</label>
          <input
            ref={input}
            id={inputId}
            className="n-input"
            type="text"
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            placeholder="Escribí tu nombre"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
          />
          <button type="submit" className="btn btn-primary n-clear" disabled={!clean || busy} aria-busy={busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <p className="n-lead l-hint">Si otro chico de tu nivel se llama igual, agregá la inicial de tu apellido.</p>
        {problem && <p className="w-problem" role="alert">{problem}</p>}
        <div>
          <button className="btn" onClick={() => setLevel(null)} disabled={busy}>Cambiar de nivel</button>
        </div>
      </div>
    </main>
  );
}
