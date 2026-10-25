import { motion, AnimatePresence } from 'motion/react'
import { forwardRef, type MutableRefObject, type ReactNode } from 'react'
import { Car } from './Car'
import { CELLS, COLS, ROWS, CELL_RATIO } from './logic'
import { cellXf } from './engine'

export interface BoardProps {
  pos: number[]; ambCar: number; showAmb: boolean; glow: boolean; numbers: boolean
  picked?: number | null; reveal?: boolean; big?: boolean; onPick?: (car: number) => void
  carEls: MutableRefObject<(HTMLDivElement | null)[]>; maxHeight?: string
  /** contenu superposé à une voiture (ex. pastilles des joueurs à la révélation) */
  overlay?: (car: number, cell: number) => ReactNode
}
/** Grille + voitures. Les voitures sont positionnées par transform ; le moteur les anime sans re-render. */
export const Board = forwardRef<HTMLDivElement, BoardProps>(function Board({ pos, ambCar, showAmb, glow, numbers, picked, reveal, big, onPick, carEls, maxHeight = '100dvh - 230px', overlay }, ref) {
  return (
    <div ref={ref} className="relative mx-auto w-full" style={{ aspectRatio: `${COLS} / ${ROWS * CELL_RATIO}`, maxWidth: `calc((${maxHeight}) * ${COLS / (ROWS * CELL_RATIO)})` }}>
      <div className="absolute inset-0 grid border border-trait/80 bg-grille shadow-[0_0_60px_rgba(80,90,180,.18)]" style={{ gridTemplateColumns: `repeat(${COLS},1fr)`, gridTemplateRows: `repeat(${ROWS},1fr)` }}>
        {Array.from({ length: CELLS }, (_, i) => <div key={i} className="border border-trait/40" />)}
      </div>
      {glow && (
        <motion.div className="absolute -left-4 z-40 h-0 w-0 border-y-[8px] border-l-[12px] border-y-transparent border-l-sirene"
          style={{ top: `calc(${(Math.floor(pos[ambCar] / COLS) + 0.5) * (100 / ROWS)}% - 8px)` }} animate={{ x: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 0.6 }} />
      )}
      {pos.map((cell, car) => {
        const isAmb = car === ambCar, amb = isAmb && showAmb
        return (
          <div key={car} ref={el => { carEls.current[car] = el }} className="absolute left-0 top-0 will-change-transform"
            style={{ width: `${100 / COLS}%`, height: `${100 / ROWS}%`, transform: cellXf(cell) }}>
            <motion.button type="button" aria-label={numbers ? `Voiture ${cell + 1}` : 'Voiture'} onClick={() => onPick?.(car)}
              disabled={!onPick} className="flex h-full w-full items-center justify-center outline-none"
              whileTap={onPick ? { scale: 0.9 } : undefined}>
              <div className="relative h-[66%]">
                {isAmb && glow && (
                  <motion.div className="absolute -inset-5 rounded-full blur-xl" animate={{ backgroundColor: ['rgba(240,67,90,.75)', 'rgba(47,107,255,.6)', 'rgba(240,67,90,.75)'], scale: [1, 1.25, 1] }} transition={{ repeat: Infinity, duration: 0.8 }} />
                )}
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div key={amb ? 'amb' : 'taxi'} className="relative h-full"
                    initial={{ opacity: 0, scale: 0.8, rotateY: 90 }} animate={{ opacity: 1, scale: reveal && amb ? [1, 1.25, 1.1] : 1, rotateY: 0 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.4 }}>
                    <Car ambulance={amb} />
                  </motion.div>
                </AnimatePresence>
                {numbers && (
                  <motion.span className={`pointer-events-none absolute inset-0 flex items-center justify-center font-titre text-white [text-shadow:0_0_4px_#000,0_2px_0_#000] ${big ? 'text-[min(6.5vw,7vh)]' : 'text-[min(6vw,1.6rem)]'}`}
                    initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: cell * 0.035, type: 'spring', stiffness: 400, damping: 18 }}>{cell + 1}</motion.span>
                )}
                {picked === car && (
                  <motion.div className={`absolute -inset-2 rounded-xl border-4 ${car === ambCar ? 'border-emerald-400' : 'border-sirene'}`} initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} />
                )}
                {reveal && isAmb && (
                  <motion.div className="absolute -inset-4 rounded-2xl border-4 border-emerald-400" initial={{ scale: 2, opacity: 0 }} animate={{ scale: [1.3, 1], opacity: 1 }} transition={{ duration: 0.5 }} />
                )}
              </div>
            </motion.button>
            {overlay?.(car, cell)}
          </div>
        )
      })}
    </div>
  )
})
