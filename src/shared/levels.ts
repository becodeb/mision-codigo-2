// Difficulty levels and class numbers. Shared by the server and the browser:
// keep this file free of Node APIs.

export const LEVEL_IDS = [1, 2, 3, 4, 5] as const;
export type LevelId = (typeof LEVEL_IDS)[number];

export const CLASS_IDS = [1, 2] as const;
export type ClassId = (typeof CLASS_IDS)[number];

export interface LevelInfo {
  id: LevelId;
  /** Child-facing team name. Children never see the level number. */
  teamName: string;
  /** What the level covers, for teachers. */
  teacherDescription: string;
  /** School grade a child picks this level by, on the entry screen. */
  grade: string;
}

export const LEVELS: readonly LevelInfo[] = [
  {
    id: 1,
    teamName: 'Equipo Sol',
    grade: '1.er grado',
    teacherDescription: 'Secuencia: ordenar bloques con imágenes para contar una historia paso a paso.',
  },
  {
    id: 2,
    teamName: 'Equipo Mar',
    grade: '2.º grado',
    teacherDescription:
      'Eventos, tiempos y repetir: varios personajes que se activan con toques y mensajes de colores.',
  },
  {
    id: 3,
    teamName: 'Equipo Bosque',
    grade: '3.er grado',
    teacherDescription:
      'Teclado, coordenadas, mensajes y contacto entre personajes con bloques de texto, sin condicionales. Por ejemplo, puntos y fases por mensajes.',
  },
  {
    id: 4,
    teamName: 'Equipo Volcán',
    grade: '4.º grado',
    teacherDescription:
      'Bucle y reglas: por siempre, si toca, puntos, ganar y perder. Juegos de esquivar y atrapar.',
  },
  {
    id: 5,
    teamName: 'Equipo Galaxia',
    grade: '5.º y 6.º grado',
    teacherDescription:
      'Estado: variables, comparaciones, si/si no, azar, clones y listas. Vidas, tiempo y niveles de dificultad.',
  },
];

export function isLevelId(value: unknown): value is LevelId {
  return typeof value === 'number' && (LEVEL_IDS as readonly number[]).includes(value);
}

export function isClassId(value: unknown): value is ClassId {
  return typeof value === 'number' && (CLASS_IDS as readonly number[]).includes(value);
}

export function getLevel(id: LevelId): LevelInfo {
  return LEVELS[id - 1];
}

/** Group a child who enters by level is filed under, so the teacher sees the grade. */
export const levelGroup = (id: LevelId): string => `Nivel ${id}`;

export function teamName(id: LevelId): string {
  return getLevel(id).teamName;
}
