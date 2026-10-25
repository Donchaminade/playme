import { CELLS, buildPlan, mulberry32, type Level, type WavePlan } from './logic'
import { graineDe } from '../../lib/defi'

/** Manche reproductible : même graine + même index ⇒ même ambulance de départ et mêmes mélanges. */
export function mancheSeedee(graine: number, k: number, level: Level): { amb: number; plan: WavePlan[] } {
  const rng = mulberry32(graineDe(graine, k * 16 + level.niveau))
  const amb = Math.floor(rng() * CELLS)
  return { amb, plan: buildPlan(level, rng, amb) }
}
