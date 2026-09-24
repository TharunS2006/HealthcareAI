'use client';

import { motion, MotionConfig } from 'framer-motion';

// Opacity-only transition: a transform here would become the containing block
// for the fixed sidebar / tab bar and make them slide with every navigation.
export default function Template({ children }: { children: React.ReactNode }) {
    return (
        <MotionConfig reducedMotion="user">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="w-full h-full"
            >
                {children}
            </motion.div>
        </MotionConfig>
    );
}
