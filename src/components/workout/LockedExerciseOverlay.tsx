import { Lock } from 'lucide-react';

interface Props {
    name: string;
    onUnlock: () => void;
}

/**
 * Overlay shown on top of a locked/hidden exercise card.
 * Clicking it triggers the unlock flow.
 */
export const LockedExerciseOverlay = ({ name, onUnlock }: Props) => (
    <div
        className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75 backdrop-blur-[2px] rounded-2xl cursor-pointer group"
        onClick={e => { e.stopPropagation(); onUnlock(); }}
    >
        <Lock
            size={28}
            className="text-gym-primary group-hover:scale-110 transition-transform"
            strokeWidth={2}
        />
        <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mt-1.5 text-center px-2 line-clamp-2">
            {name}
        </span>
        <span className="text-[8px] font-bold text-gym-primary/70 mt-0.5 uppercase tracking-widest">
            Toca para desbloquear
        </span>
    </div>
);
