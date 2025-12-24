
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface VolumeTrendChartProps {
    data: { name: string; volume: number }[];
}

export const VolumeTrendChart = ({ data }: VolumeTrendChartProps) => {
    if (!data || data.length === 0) return (
        <div className="h-full flex items-center justify-center text-neutral-500 text-xs">
            Sin suficientes datos de volumen
        </div>
    );

    return (
        <div className="w-full h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis
                        dataKey="name"
                        tick={{ fill: '#9ca3af', fontSize: 10 }} // text-neutral-400
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                    />
                    <YAxis
                        tick={{ fill: '#9ca3af', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                        width={30}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#171717', // Neutral-900
                            border: '1px solid #262626', // Neutral-800
                            borderRadius: '12px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)'
                        }}
                        itemStyle={{ color: '#60a5fa' }} // Blue-400
                        formatter={(value?: number) => [`${((value || 0) / 1000).toFixed(1)}k kg`, "Carga Total"] as [string, string]}
                        labelStyle={{ color: '#9ca3af', marginBottom: '0.25rem', fontSize: '12px' }}
                    />
                    <Area
                        type="monotone"
                        dataKey="volume"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorVolume)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};
