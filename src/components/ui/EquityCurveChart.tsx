'use client';

import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, AreaSeries } from 'lightweight-charts';
import { useCurrency } from '@/utils/useCurrency';

interface EquityCurveChartProps {
  data: { time: string; value: number }[];
  height?: number;
}

export function EquityCurveChart({ data, height = 280 }: EquityCurveChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const { currencySymbol } = useCurrency();

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    // Get primary color from CSS variable or default to a blue
    let primaryColor = '#2563eb';
    if (typeof window !== 'undefined') {
      const computed = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
      if (computed) {
        // Simple heuristic if it's HSL
        if (computed.includes('%')) {
          primaryColor = `hsl(${computed})`;
        } else {
          primaryColor = computed;
        }
      }
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#888888',
      },
      width: chartContainerRef.current.clientWidth,
      height: height,
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      grid: {
        vertLines: { color: 'rgba(197, 203, 206, 0.2)' },
        horzLines: { color: 'rgba(197, 203, 206, 0.2)' },
      },
      crosshair: {
        mode: 0, // CrosshairMode.Magnet
      },
      localization: {
        priceFormatter: (price: number) => {
          if (price >= 100000) return `${currencySymbol}${(price / 1000).toFixed(1)}k`;
          return `${currencySymbol}${price.toFixed(2)}`;
        },
      },
    });

    chartRef.current = chart;

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: primaryColor,
      topColor: 'rgba(37, 99, 235, 0.3)',
      bottomColor: 'rgba(37, 99, 235, 0.0)',
      lineWidth: 2,
    });

    // Make sure data is sorted and formatted correctly
    const formattedData = [...data].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    areaSeries.setData(formattedData);

    chart.timeScale().fitContent();

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [data, height, currencySymbol]);

  return <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />;
}
