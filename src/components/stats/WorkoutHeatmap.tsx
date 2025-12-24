import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface WorkoutHeatmapProps {
    data: { date: string; count: number }[];
}

export const WorkoutHeatmap = ({ data = [] }: WorkoutHeatmapProps) => {
    // 1. Interactive State: Current Month View
    const [currentDate, setCurrentDate] = useState(new Date());

    // 2. Navigation Handlers
    const prevMonth = () => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() - 1);
        setCurrentDate(newDate);
    };

    const nextMonth = () => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() + 1);
        setCurrentDate(newDate);
    };

    // 3. Helpers for Calendar Generation
    const getDaysInMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date: Date) => {
        // 0 = Sunday, 1 = Monday, etc.
        // We want Monday start? Standard usually Sunday. Let's do Monday start for "Business" feel or Sunday?
        // Let's stick to standard Sunday start (0) for easier logic.
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    // 4. Generate Calendar Grid Data
    const calendarData = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const numDays = getDaysInMonth(currentDate);
        const startDay = getFirstDayOfMonth(currentDate); // 0 (Sun) to 6 (Sat)

        // Adjust for Monday start if desired (Let's stick to Sun-Sat for standard calendar UI consistency)
        // If Monday start: (startDay + 6) % 7

        const days = [];
        const dataMap = new Map(data.map(d => [d.date, d.count]));

        // Padding for empty start slots
        for (let i = 0; i < startDay; i++) {
            days.push({ day: null, fullDate: null, count: -1, color: 'invisible' });
        }

        // Actual days
        for (let i = 1; i <= numDays; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const count = dataMap.get(dateStr) || 0;

            let colorClass = 'bg-neutral-800/40 hover:bg-neutral-700/50';
            if (count > 0) colorClass = 'bg-emerald-500 shadow-[0_0_8px_-2px_rgba(16,185,129,0.5)] hover:scale-110';

            days.push({
                day: i,
                fullDate: dateStr,
                count: count,
                color: colorClass
            });
        }

        return days;
    }, [currentDate, data]);

    const monthLabel = currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    const capitalizedMonth = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

    const weekDays = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

    return (
        <div className="w-full flex flex-col items-center">
            {/* Header: Navigation */}
            <div className="flex items-center justify-between w-full mb-4 px-2">
                <button
                    onClick={prevMonth}
                    className="p-1 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                >
                    <ChevronLeft size={20} />
                </button>

                <h3 className="text-white font-bold text-sm bg-neutral-800/50 px-4 py-1 rounded-full border border-neutral-800">
                    {capitalizedMonth}
                </h3>

                <button
                    onClick={nextMonth}
                    className="p-1 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                >
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 w-full max-w-sm">

                {/* Weekday Headers */}
                {weekDays.map(d => (
                    <div key={d} className="text-center text-[10px] text-neutral-500 font-bold uppercase py-1">
                        {d}
                    </div>
                ))}

                {/* Days */}
                {calendarData.map((d, i) => (
                    <div
                        key={i}
                        className={`aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-all relative group
                            ${d.color} 
                            ${d.day ? 'cursor-default text-white' : ''}
                        `}
                        title={d.fullDate ? `${d.fullDate}: ${d.count > 0 ? 'Entrenamiento' : 'Descanso'}` : ''}
                    >
                        {d.day}

                        {/* Interactive Dot for Active Days */}
                        {d.count > 0 && (
                            <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-emerald-300 shadow-[0_0_5px_currentColor] opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="w-full flex justify-center items-center gap-6 mt-6 text-[10px] text-neutral-500">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-neutral-800/40 border border-neutral-700/30" />
                    <span>Descanso</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-emerald-500 shadow-[0_0_8px_-2px_rgba(16,185,129,0.5)]" />
                    <span>Entrenamiento</span>
                </div>
            </div>
        </div>
    );
};
