/**
 * The server-to-server API of modules/projects -- narrow reads meant for
 * another module's own server-side code (modules/cash-gate,
 * modules/scope-variation), never for app/ or for a 'use client' component.
 *
 * Separate from index.ts on purpose: index.ts is imported by client
 * components too (for server actions, which Next's compiler specially
 * handles), and a 'use client' file that statically imports anything from a
 * barrel also pulls in that barrel's *other* exports for bundling analysis.
 * getWorkPackage/getMyProjectRole carry `import 'server-only'` transitively
 * (via their repository files), which breaks that bundling the moment any
 * client component imports anything at all from the same barrel -- found
 * while building Fase 3's "open work package" button. Keeping these on a
 * second entry point index.ts never re-exports is what keeps index.ts
 * client-safe.
 */

export { getWorkPackage } from './data/work-packages-repository';
export { getMyProjectRole } from './data/project-members-repository';
