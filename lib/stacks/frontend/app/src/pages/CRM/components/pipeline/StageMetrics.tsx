/**
 * Pipeline Stage Metrics — Animated, modern metric cards
 */
import React, { useEffect, useState, useRef } from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';
import { motion, useInView } from 'motion/react';
import { PipelineMetrics } from '../../types';
import { formatCompactCurrency } from '../../utils/formatters';

interface StageMetricsProps {
    metrics: PipelineMetrics;
}

interface MetricCardData {
    label: string;
    value: number;
    color: string;
    bgColor: string;
    icon: string;
}

/* Animated number that counts up */
const AnimatedValue = ({ value, color }: { value: number; color: string }) => {
    const [display, setDisplay] = useState(0);
    const ref = useRef<HTMLDivElement>(null);
    const inView = useInView(ref, { once: true });

    useEffect(() => {
        if (!inView) return;
        let start = 0;
        const step = value / 40;
        const id = setInterval(() => {
            start += step;
            if (start >= value) { setDisplay(value); clearInterval(id); }
            else setDisplay(Math.floor(start));
        }, 20);
        return () => clearInterval(id);
    }, [inView, value]);

    return (
        <div ref={ref} style={{ color, fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em' }}>
            {formatCompactCurrency(display)}
        </div>
    );
};

export const StageMetrics: React.FC<StageMetricsProps> = React.memo(({ metrics }) => {
    const metricCards: MetricCardData[] = [
        { label: 'Open Pipeline', value: metrics.openPipeline, color: '#6366f1', bgColor: 'rgba(99,102,241,0.08)', icon: '📊' },
        { label: 'New', value: metrics.newOpportunities, color: '#3b82f6', bgColor: 'rgba(59,130,246,0.08)', icon: '✨' },
        { label: 'Won', value: metrics.wonOpportunities, color: '#22c55e', bgColor: 'rgba(34,197,94,0.08)', icon: '🏆' },
        { label: 'Increased', value: metrics.increasedValue, color: '#10b981', bgColor: 'rgba(16,185,129,0.08)', icon: '📈' },
        { label: 'Moved In', value: metrics.movedIn, color: '#06b6d4', bgColor: 'rgba(6,182,212,0.08)', icon: '➡️' },
        { label: 'Moved Out', value: metrics.movedOut, color: '#f59e0b', bgColor: 'rgba(245,158,11,0.08)', icon: '⬅️' },
        { label: 'Decreased', value: metrics.decreasedValue, color: '#f97316', bgColor: 'rgba(249,115,22,0.08)', icon: '📉' },
        { label: 'Lost', value: metrics.lostOpportunities, color: '#ef4444', bgColor: 'rgba(239,68,68,0.08)', icon: '❌' },
        { label: 'Overdue', value: metrics.overdueOpportunities, color: '#dc2626', bgColor: 'rgba(220,38,38,0.08)', icon: '⏰' },
    ];

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '12px',
        }}>
            {metricCards.map((card, index) => (
                <motion.div
                    key={card.label}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.04 }}
                    whileHover={{ y: -3, transition: { duration: 0.15 } }}
                    style={{
                        padding: '18px',
                        borderRadius: '14px',
                        background: card.bgColor,
                        border: `1px solid ${card.color}18`,
                        position: 'relative',
                        overflow: 'hidden',
                        cursor: 'default',
                    }}
                >
                    {/* Top accent line */}
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                        background: `linear-gradient(90deg, transparent, ${card.color}, transparent)`,
                        opacity: 0.6,
                    }} />

                    <SpaceBetween size="xs">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box variant="small" color="text-label" fontSize="body-s">
                                {card.label}
                            </Box>
                            <span style={{ fontSize: '16px' }}>{card.icon}</span>
                        </div>
                        <AnimatedValue value={card.value} color={card.color} />
                    </SpaceBetween>
                </motion.div>
            ))}
        </div>
    );
});

StageMetrics.displayName = 'StageMetrics';
export default StageMetrics;
