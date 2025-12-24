
import { useState, useEffect } from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

interface MuscleRadarChartProps {
    data: { subject: string; A: number; fullMark: number }[];
    color?: string;
    fillOpacity?: number;
    strokeWidth?: number;
    // Customization
    textColor?: string;
    gridColor?: string;
    gridWidth?: number;
    textWeight?: string;
    gridDash?: string;
    gridType?: "polygon" | "circle";
}

export const MuscleRadarChart = ({
    data,
    color = "#eab308",
    fillOpacity = 0.4,
    strokeWidth = 2,
    textColor = 'rgba(255,255,255,0.8)',
    gridColor = 'rgba(255,255,255,0.2)',
    gridWidth = 1,
    textWeight = 'bold',
    gridDash = '',
    gridType = 'polygon'
}: MuscleRadarChartProps) => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // Wait for next frame to ensure DOM is ready
        requestAnimationFrame(() => setMounted(true));
    }, []);

    if (!data || data.length === 0) return null;
    if (!mounted) return <div className="w-full h-[300px]" />; // Placeholder with correct height

    return (
        <div className="w-full h-[300px] relative min-w-0">
            {/* 99% width hack fixes the 'width(-1)' ResizeObserver error in Recharts */}
            <ResponsiveContainer width="99%" height="100%">
                <RadarChart
                    cx="50%"
                    cy="50%"
                    outerRadius="65%"
                    data={data}
                    margin={{ top: 10, right: 30, bottom: 10, left: 30 }}
                >
                    <PolarGrid
                        stroke={gridColor}
                        strokeWidth={gridWidth}
                        strokeDasharray={gridDash}
                        gridType={gridType}
                    />
                    <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: textColor, fontSize: 10, fontWeight: textWeight }}
                    />
                    <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                    <Radar
                        name="Volumen (Sets)"
                        dataKey="A"
                        stroke={color}
                        strokeWidth={strokeWidth}
                        fill={color}
                        fillOpacity={fillOpacity}
                        isAnimationActive={false}
                    />
                </RadarChart>
            </ResponsiveContainer>

            {/* Overlay for 'Zero Data' aesthetics if needed */}
            {data.every(d => d.A === 0) && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-neutral-500 text-[10px] uppercase tracking-widest font-bold">Sin Datos Suficientes</p>
                </div>
            )}
        </div>
    );
};
