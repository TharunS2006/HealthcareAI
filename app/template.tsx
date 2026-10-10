'use client';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * Each page fades in. Not for someone whose system asks for reduced motion
 * (prefers-reduced-motion): movement can make them unwell, so for them the
 * page simply appears.
 */
export default function Template({ children }: { children: React.ReactNode }) {
    const reduceMotion = useReducedMotion();
    return (
        <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -10 }}
            transition={{ duration: reduceMotion ? 0 : 0.35, ease: 'easeOut' }}
            className="w-full h-full"
        >
            {children}
        </motion.div>
    );
}
