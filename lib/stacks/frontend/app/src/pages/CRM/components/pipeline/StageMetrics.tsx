/**
 * Pipeline Stage Metrics Component
 * 
 * Displays horizontal cards showing key pipeline stage metrics including:
 * - Open Pipeline
 * - New opportunities
 * - Won opportunities
 * - Increased value
 * - Moved In
 * - Moved Out
 * - Decreased value
 * - Lost opportunities
 * - Overdue opportunities
 * 
 * Uses Cloudscape Cards and ColumnLayout for responsive design.
 */

import React from 'react';
import { ColumnLayout, Box, SpaceBetween } from '@cloudscape-design/components';
import { PipelineMetrics } from '../../types';
import { formatCompactCurrency } from '../../utils/formatters';

interface StageMetricsProps {
  /** Pipeline metrics to display */
  metrics: PipelineMetrics;
}

interface MetricCardData {
  label: string;
  value: number;
  color: 'blue' | 'green' | 'red' | 'orange' | 'grey';
  icon?: string;
}

/**
 * StageMetrics Component
 * 
 * Displays pipeline stage metrics in a responsive card layout.
 * Cards are color-coded based on metric type (green for positive, red for negative).
 * 
 * Optimized with React.memo to prevent unnecessary re-renders.
 */
export const StageMetrics: React.FC<StageMetricsProps> = React.memo(({ metrics }) => {
  // Define metric cards with labels, values, and color coding
  const metricCards: MetricCardData[] = [
    {
      label: 'Open Pipeline',
      value: metrics.openPipeline,
      color: 'blue',
    },
    {
      label: 'New',
      value: metrics.newOpportunities,
      color: 'blue',
    },
    {
      label: 'Won',
      value: metrics.wonOpportunities,
      color: 'green',
    },
    {
      label: 'Increased',
      value: metrics.increasedValue,
      color: 'green',
    },
    {
      label: 'Moved In',
      value: metrics.movedIn,
      color: 'blue',
    },
    {
      label: 'Moved Out',
      value: metrics.movedOut,
      color: 'orange',
    },
    {
      label: 'Decreased',
      value: metrics.decreasedValue,
      color: 'orange',
    },
    {
      label: 'Lost',
      value: metrics.lostOpportunities,
      color: 'red',
    },
    {
      label: 'Overdue',
      value: metrics.overdueOpportunities,
      color: 'red',
    },
  ];

  // Get color styles for metric values
  const getColorStyle = (color: MetricCardData['color']): React.CSSProperties => {
    const colorMap = {
      blue: '#0972D3',
      green: '#037F0C',
      red: '#D91515',
      orange: '#F89406',
      grey: '#5F6B7A',
    };
    return { color: colorMap[color] };
  };

  return (
    <ColumnLayout 
      columns={5} 
      variant="text-grid" 
      minColumnWidth={150}
    >
      {metricCards.map((card, index) => (
        <div
          key={index}
          style={{
            padding: '16px',
            border: '1px solid #E9EBED',
            borderRadius: '8px',
            backgroundColor: 'white',
            minHeight: '100px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <SpaceBetween size="xs">
            <Box
              variant="small"
              color="text-label"
              fontSize="body-s"
            >
              {card.label}
            </Box>
            <div style={{ ...getColorStyle(card.color), fontSize: '24px', fontWeight: 'bold' }}>
              {formatCompactCurrency(card.value)}
            </div>
          </SpaceBetween>
        </div>
      ))}
    </ColumnLayout>
  );
});

StageMetrics.displayName = 'StageMetrics';

export default StageMetrics;
