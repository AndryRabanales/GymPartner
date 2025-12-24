import { useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { Share2, Download, X, Image as ImageIcon, Zap, Plus, Scaling, Settings, Check } from 'lucide-react';
import { MuscleRadarChart } from './MuscleRadarChart';

interface ShareOverlayProps {
    stats: any;
    onClose: () => void;
    username: string;
    avatarUrl?: string;
}

// Granular Sticker Types
type StickerType = 'volume' | 'workouts' | 'time' | 'radar' | 'logo' | 'date' | 'avg' | 'pr' | 'consistency';

interface StickerState {
    id: StickerType;
    label: string;
    x: number;
    y: number;
    scale: number;
    visible: boolean;
}

export const ShareOverlay = ({ stats, onClose, username, avatarUrl }: ShareOverlayProps) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [downloading, setDownloading] = useState(false);

    // Background State & Dynamic Dimensions
    const [selectedBg, setSelectedBg] = useState<'gradient' | 'black' | 'image'>('gradient');
    const [customImage, setCustomImage] = useState<string | null>(null);
    const [cardHeight, setCardHeight] = useState(568);
    const [bgOpacity, setBgOpacity] = useState(0.2);

    // Selected Sticker for Editing
    const [selectedId, setSelectedId] = useState<StickerType | null>(null);

    // Radar Customization
    const [radarColor, setRadarColor] = useState('#eab308');
    const [radarTextColor, setRadarTextColor] = useState('rgba(255,255,255,0.8)');
    const [radarOpacity, setRadarOpacity] = useState(0.4);
    const [radarStroke, setRadarStroke] = useState(2);
    // Grid & Text Customization
    const [gridColor, setGridColor] = useState('rgba(255,255,255,0.2)');
    const [gridWidth, setGridWidth] = useState(1);
    const [textWeight, setTextWeight] = useState(700);
    const [gridDash, setGridDash] = useState('');
    const [gridType, setGridType] = useState<"polygon" | "circle">('polygon');
    const [showRadarSelector, setShowRadarSelector] = useState(false);

    // UI State
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [showPrSelector, setShowPrSelector] = useState(false);

    // Custom Data State
    const [selectedPrs, setSelectedPrs] = useState<string[]>([]);

    // Initial Positions
    const [stickers, setStickers] = useState<StickerState[]>([
        { id: 'logo', label: 'Marca Personal', x: 20, y: 20, scale: 1, visible: true },
        { id: 'volume', label: 'Volumen Total', x: 20, y: 80, scale: 1, visible: true },
        { id: 'workouts', label: 'Sesiones', x: 20, y: 200, scale: 1, visible: true },
        { id: 'time', label: 'Horas Totales', x: 160, y: 200, scale: 1, visible: true },
        { id: 'radar', label: 'Radar Muscular', x: 20, y: 300, scale: 0.8, visible: true },
        { id: 'date', label: 'Fecha / Temporada', x: 20, y: 520, scale: 1, visible: true },
        { id: 'avg', label: 'Promedio / Sesión', x: 20, y: 250, scale: 1, visible: false },
        { id: 'pr', label: 'Récords / PRs', x: 20, y: 150, scale: 1, visible: false },
        { id: 'consistency', label: 'Constancia (Heatmap)', x: 20, y: 400, scale: 0.8, visible: false },
    ]);

    useEffect(() => {
        if (stats.oneRepMaxes && stats.oneRepMaxes.length > 0) {
            setSelectedPrs(stats.oneRepMaxes.slice(0, 3).map((pr: any) => pr.name));
        }
    }, [stats.oneRepMaxes]);

    const interactionMode = useRef<'drag' | 'resize' | null>(null);
    const startPos = useRef({ x: 0, y: 0 });
    const startStickerState = useRef<{ x: number, y: number, scale: number } | null>(null);

    const handleTouchStart = (e: React.TouchEvent | React.MouseEvent, id: StickerType, mode: 'drag' | 'resize') => {
        e.preventDefault();
        e.stopPropagation();

        setSelectedId(id);
        setShowAddMenu(false);
        interactionMode.current = mode;

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        startPos.current = { x: clientX, y: clientY };

        const sticker = stickers.find(s => s.id === id);
        if (sticker) {
            startStickerState.current = { x: sticker.x, y: sticker.y, scale: sticker.scale };
        }
    };

    const handleMove = (e: React.TouchEvent | React.MouseEvent) => {
        if (!interactionMode.current || !selectedId || !startStickerState.current) return;

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        const dx = clientX - startPos.current.x;
        const dy = clientY - startPos.current.y;

        setStickers(prev => prev.map(s => {
            if (s.id !== selectedId) return s;

            if (interactionMode.current === 'drag') {
                return {
                    ...s,
                    x: startStickerState.current!.x + dx,
                    y: startStickerState.current!.y + dy
                };
            }

            if (interactionMode.current === 'resize') {
                const initialScale = startStickerState.current!.scale;
                const scaleDelta = (dx + dy) * 0.005;
                const newScale = Math.max(0.3, Math.min(4.0, initialScale + scaleDelta));
                return {
                    ...s,
                    scale: newScale
                };
            }
            return s;
        }));
    };

    const handleEnd = () => {
        interactionMode.current = null;
        startStickerState.current = null;
    };

    useEffect(() => {
        const handleGlobalMove = (e: any) => handleMove(e);
        const handleGlobalEnd = () => handleEnd();

        window.addEventListener('mousemove', handleGlobalMove);
        window.addEventListener('mouseup', handleGlobalEnd);
        window.addEventListener('touchmove', handleGlobalMove, { passive: false });
        window.addEventListener('touchend', handleGlobalEnd);

        return () => {
            window.removeEventListener('mousemove', handleGlobalMove);
            window.removeEventListener('mouseup', handleGlobalEnd);
            window.removeEventListener('touchmove', handleGlobalMove);
            window.removeEventListener('touchend', handleGlobalEnd);
        };
    }, [selectedId]);

    const toggleSticker = (id: StickerType) => {
        setStickers(prev => prev.map(s =>
            s.id === id ? { ...s, visible: !s.visible, x: 50, y: 200 } : s
        ));
    };

    const deleteSelected = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        if (!selectedId) return;
        setStickers(prev => prev.map(s =>
            s.id === selectedId ? { ...s, visible: false } : s
        ));
        setSelectedId(null);
    };

    const togglePrSelection = (name: string) => {
        setSelectedPrs(prev =>
            prev.includes(name)
                ? prev.filter(p => p !== name)
                : [...prev, name]
        );
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    const dataUrl = ev.target.result as string;
                    setCustomImage(dataUrl);
                    setSelectedBg('image');
                    setBgOpacity(0);

                    // Detect image aspect ratio to prevent cropping
                    const img = new Image();
                    img.onload = () => {
                        const aspect = img.height / img.width;
                        const newHeight = Math.round(320 * aspect);
                        setCardHeight(newHeight);
                    };
                    img.src = dataUrl;
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleShare = async () => {
        if (!cardRef.current) return;
        setDownloading(true);
        setSelectedId(null);

        const width = 320;
        const height = cardHeight;

        setTimeout(async () => {
            try {
                if (!cardRef.current) return;

                const canvas = await html2canvas(cardRef.current, {
                    backgroundColor: null,
                    scale: 6,
                    width: width,
                    height: height,
                    useCORS: true,
                    allowTaint: true,
                    logging: false,
                    scrollX: 0,
                    scrollY: 0,
                    windowWidth: width,
                    windowHeight: height,
                    onclone: (clonedDoc) => {
                        const el = clonedDoc.getElementById('export-card');
                        if (el) {
                            el.style.boxShadow = 'none';
                            el.style.borderRadius = '0';
                        }
                    }
                });

                const image = canvas.toDataURL("image/png", 1.0);
                const link = document.createElement('a');
                link.href = image;
                link.download = `GymPartner_Story_${new Date().toISOString().slice(0, 10)}.png`;
                link.click();
            } catch (err) {
                console.error("Error", err);
            } finally {
                setDownloading(false);
            }
        }, 500);
    };

    const StickerWrapper = ({ id, children, w }: { id: StickerType, children: React.ReactNode, w?: string }) => {
        const s = stickers.find(st => st.id === id);
        if (!s || !s.visible) return null;
        const isSelected = selectedId === id;

        return (
            <div
                className={`absolute top-0 left-0 origin-top-left select-none touch-none ${isSelected ? 'z-50' : 'z-10'} will-change-transform`}
                style={{
                    transform: `translate3d(${s.x}px, ${s.y}px, 0) scale(${s.scale})`,
                    cursor: interactionMode.current && selectedId === id ? 'grabbing' : 'grab',
                    width: w || 'auto'
                }}
                onMouseDown={(e) => handleTouchStart(e, id, 'drag')}
                onTouchStart={(e) => handleTouchStart(e, id, 'drag')}
            >
                <div className={`relative ${isSelected ? 'ring-2 ring-gym-primary/80 rounded-lg bg-black/5' : ''}`}>
                    {children}
                    {isSelected && (
                        <>
                            {(id === 'pr' || id === 'radar') && (
                                <div
                                    className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-md cursor-pointer z-50 hover:bg-blue-600"
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        if (id === 'pr') setShowPrSelector(true);
                                        if (id === 'radar') setShowRadarSelector(true);
                                    }}
                                    onTouchStart={(e) => {
                                        e.stopPropagation();
                                        if (id === 'pr') setShowPrSelector(true);
                                        if (id === 'radar') setShowRadarSelector(true);
                                    }}
                                >
                                    <Settings size={12} />
                                </div>
                            )}

                            <div
                                className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white shadow-md cursor-pointer z-50 hover:bg-red-600"
                                onMouseDown={deleteSelected}
                                onTouchStart={deleteSelected}
                            >
                                <X size={12} />
                            </div>

                            <div
                                className="absolute -bottom-3 -right-3 w-8 h-8 flex items-center justify-center cursor-nwse-resize z-50 touch-none"
                                onMouseDown={(e) => handleTouchStart(e, id, 'resize')}
                                onTouchStart={(e) => handleTouchStart(e, id, 'resize')}
                            >
                                <div className="w-5 h-5 bg-white rounded-full shadow-md border-2 border-gym-primary flex items-center justify-center">
                                    <Scaling size={10} className="text-black" />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    };

    const renderHeatmapInternal = () => {
        return (
            <div className="flex flex-wrap gap-1 w-[200px]">
                {stats.consistencyData.slice(-28).map((day: any, i: number) => (
                    <div
                        key={i}
                        className={`w-3 h-3 rounded-full shadow-sm ${day.count > 0 ? 'bg-green-500' : 'bg-white/20'}`}
                    />
                ))}
            </div>
        );
    };

    const displayedPrs = stats.oneRepMaxes.filter((pr: any) => selectedPrs.includes(pr.name));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-0 md:p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => { setSelectedId(null); setShowAddMenu(false); setShowPrSelector(false); }}>
            <div className="w-full h-full md:h-auto md:max-w-lg bg-neutral-900 border-neutral-800 md:rounded-3xl overflow-hidden flex flex-col md:max-h-[95vh]" onClick={e => e.stopPropagation()}>

                <div className="p-4 border-b border-neutral-800 flex items-center justify-between z-50 bg-neutral-900 shrink-0">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        <Share2 size={18} className="text-gym-primary" />
                        Editor Pro
                    </h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors">
                        Cerrar
                    </button>
                </div>

                <div className="flex-1 overflow-auto relative bg-neutral-950 flex justify-center items-center py-8 select-none" ref={containerRef}>
                    <div
                        ref={cardRef}
                        id="export-card"
                        className="relative w-[320px] shadow-2xl transition-all duration-300 flex-shrink-0 bg-black overflow-hidden"
                        style={{ height: `${cardHeight}px` }}
                    >
                        {/* 1. DYNAMIC BACKGROUND (100% SIZE = NO CROP) */}
                        <div className="absolute inset-0 z-0">
                            {selectedBg === 'image' && customImage ? (
                                <img
                                    src={customImage}
                                    alt="Background"
                                    className="w-full h-full block"
                                    crossOrigin="anonymous"
                                />
                            ) : selectedBg === 'gradient' ? (
                                <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 to-neutral-800" />
                            ) : (
                                <div className="absolute inset-0 bg-black" />
                            )}
                        </div>

                        <div className="absolute inset-0 z-0 pointer-events-none" style={{ backgroundColor: `rgba(0,0,0,${bgOpacity})` }} />

                        <StickerWrapper id="logo">
                            <div className="flex items-center gap-2 pointer-events-none p-2">
                                {avatarUrl ? (
                                    <div className="w-10 h-10 rounded-full border-2 border-gym-primary overflow-hidden bg-neutral-800 shadow-lg">
                                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" crossOrigin="anonymous" />
                                    </div>
                                ) : (
                                    <div className="w-8 h-8 rounded-lg bg-gym-primary flex items-center justify-center text-black font-black text-xs">GP</div>
                                )}
                                <div>
                                    <p className="text-white font-bold text-sm tracking-wide drop-shadow-md">GYMPARTNER</p>
                                    <p className="text-white text-[10px] uppercase tracking-widest drop-shadow-md">{username}</p>
                                </div>
                            </div>
                        </StickerWrapper>

                        <StickerWrapper id="volume">
                            <div className="pointer-events-none p-2">
                                <p className="text-white text-xs font-bold uppercase tracking-widest mb-1 drop-shadow-md">Volumen Total</p>
                                <h1 className="text-6xl font-black text-white tracking-tighter italic drop-shadow-lg leading-none">
                                    {(stats.totalVolume / 1000).toFixed(1)}<span className="text-3xl text-gym-primary not-italic">k</span>
                                </h1>
                            </div>
                        </StickerWrapper>

                        <StickerWrapper id="workouts">
                            <div className="pointer-events-none p-2">
                                <p className="text-white text-[10px] font-bold uppercase tracking-widest drop-shadow-md">Sesiones</p>
                                <p className="text-3xl font-bold text-white drop-shadow-md">{stats.totalWorkouts}</p>
                            </div>
                        </StickerWrapper>

                        <StickerWrapper id="time">
                            <div className="pointer-events-none p-2">
                                <p className="text-white text-[10px] font-bold uppercase tracking-widest drop-shadow-md">Horas</p>
                                <p className="text-3xl font-bold text-white drop-shadow-md">{Math.round(stats.totalTimeMinutes / 60)}</p>
                            </div>
                        </StickerWrapper>

                        <StickerWrapper id="avg">
                            <div className="pointer-events-none p-2">
                                <p className="text-white text-[10px] font-bold uppercase tracking-widest drop-shadow-md">Promedio/Sesion</p>
                                <p className="text-3xl font-bold text-white drop-shadow-md">{Math.round(stats.totalTimeMinutes / stats.totalWorkouts || 0)}m</p>
                            </div>
                        </StickerWrapper>

                        <StickerWrapper id="pr" w="200px">
                            <div className="pointer-events-none p-2">
                                <p className="text-gym-primary text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1 drop-shadow-md">
                                    <Zap size={10} /> Mis Récords
                                </p>
                                <div className="space-y-2">
                                    {displayedPrs.length > 0 ? displayedPrs.map((lift: any) => (
                                        <div key={lift.name}>
                                            <div className="flex justify-between items-baseline">
                                                <span className="text-white text-xs font-bold truncate max-w-[100px]">{lift.name}</span>
                                                <span className="text-white text-sm font-black italic">{lift.max}kg</span>
                                            </div>
                                            <div className="w-full h-[2px] bg-white/20 mt-1" />
                                        </div>
                                    )) : (
                                        <p className="text-white/50 text-[10px]">Selecciona tus PRs</p>
                                    )}
                                </div>
                            </div>
                        </StickerWrapper>

                        <StickerWrapper id="consistency">
                            <div className="pointer-events-none p-2">
                                <p className="text-green-500 text-[10px] font-bold uppercase tracking-widest mb-1 drop-shadow-md">Constancia (30 Días)</p>
                                {renderHeatmapInternal()}
                            </div>
                        </StickerWrapper>

                        <StickerWrapper id="radar" w="280px">
                            <div className="w-full aspect-square pointer-events-none opacity-90 p-2">
                                <MuscleRadarChart
                                    data={stats.muscleBalanceData}
                                    color={radarColor}
                                    fillOpacity={radarOpacity}
                                    strokeWidth={radarStroke}
                                    textColor={radarTextColor}
                                    gridColor={gridColor}
                                    gridWidth={gridWidth}
                                    textWeight={textWeight.toString()}
                                    gridDash={gridDash}
                                    gridType={gridType}
                                />
                            </div>
                        </StickerWrapper>

                        <StickerWrapper id="date" w="120px">
                            <div className="flex items-center gap-2 pointer-events-none p-2">
                                <div>
                                    <p className="text-white/80 text-xs font-medium drop-shadow-md">Temporada 1</p>
                                    <p className="text-white/60 text-[10px] drop-shadow-md">{new Date().toLocaleDateString()}</p>
                                </div>
                                <Zap className="text-gym-primary w-6 h-6 animate-pulse drop-shadow-md" />
                            </div>
                        </StickerWrapper>

                    </div>
                </div>

                <div className="p-4 bg-neutral-900 border-t border-neutral-800 z-50 shrink-0 pb-8 md:pb-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowAddMenu(!showAddMenu)}
                            className={`flex flex-col items-center justify-center w-16 h-14 rounded-xl border border-neutral-700 transition-colors ${showAddMenu ? 'bg-gym-primary text-black border-gym-primary' : 'bg-neutral-800 text-white hover:bg-neutral-700'}`}
                        >
                            <Plus size={20} className="mb-1" />
                            <span className="text-[9px] font-bold uppercase">Stickers</span>
                        </button>

                        <div className="flex-1 flex gap-2 bg-neutral-800 p-1.5 rounded-xl border border-neutral-700">
                            <button onClick={() => { setSelectedBg('gradient'); setCardHeight(568); }} className={`flex-1 rounded-lg text-[10px] font-bold transition-colors ${selectedBg === 'gradient' ? 'bg-neutral-600 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>
                                Gradiente
                            </button>
                            <button onClick={() => { setSelectedBg('black'); setCardHeight(568); }} className={`flex-1 rounded-lg text-[10px] font-bold transition-colors ${selectedBg === 'black' ? 'bg-black text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>
                                Negro
                            </button>
                            <label className={`flex-1 rounded-lg text-[10px] font-bold flex items-center justify-center cursor-pointer gap-1 transition-colors ${selectedBg === 'image' ? 'bg-neutral-600 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>
                                <ImageIcon size={12} />
                                Foto
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                            </label>
                        </div>

                        <button
                            onClick={handleShare}
                            disabled={downloading}
                            className="w-14 h-14 bg-gym-primary text-black rounded-xl hover:bg-yellow-400 transition-colors flex items-center justify-center border border-yellow-500"
                        >
                            {downloading ? <Zap size={24} className="animate-spin" /> : <Download size={24} />}
                        </button>
                    </div>

                    <div className="mt-3 flex items-center gap-3 px-1">
                        <span className="text-[10px] text-neutral-500 font-bold uppercase w-16">Oscuridad</span>
                        <input
                            type="range"
                            min="0"
                            max="0.8"
                            step="0.05"
                            value={bgOpacity}
                            onChange={(e) => setBgOpacity(parseFloat(e.target.value))}
                            className="flex-1 accent-gym-primary h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                </div>

                {showAddMenu && (
                    <div className="absolute bottom-32 left-4 right-4 bg-neutral-800/95 backdrop-blur-xl border border-neutral-700 rounded-2xl p-4 shadow-2xl z-[60] grid grid-cols-2 gap-2 animate-in zoom-in-95 slide-in-from-bottom-5 duration-200">
                        <div className="col-span-2 flex justify-between items-center mb-2 pb-2 border-b border-white/5">
                            <span className="text-xs font-bold text-white uppercase tracking-wider">Agregar Elemento</span>
                            <button onClick={() => setShowAddMenu(false)} className="text-neutral-400 hover:text-white"><X size={14} /></button>
                        </div>
                        {stickers.map(s => (
                            <button
                                key={s.id}
                                onClick={() => toggleSticker(s.id)}
                                className={`flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all border ${s.visible ? 'bg-gym-primary/20 text-gym-primary border-gym-primary/50' : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:bg-neutral-700 hover:border-neutral-600'}`}
                            >
                                <span className="flex items-center gap-2">{s.label}</span>
                                {s.visible && <div className="w-2 h-2 bg-gym-primary rounded-full shadow-[0_0_8px_rgba(234,179,8,0.5)]" />}
                            </button>
                        ))}
                    </div>
                )}

                {showPrSelector && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 max-w-sm bg-neutral-800/95 backdrop-blur-xl border border-neutral-700 rounded-2xl p-4 shadow-2xl z-[70] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/5">
                            <h4 className="text-sm font-bold text-white uppercase">Elige tus PRs</h4>
                            <button onClick={() => setShowPrSelector(false)} className="text-neutral-400 hover:text-white"><X size={16} /></button>
                        </div>
                        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
                            {stats.oneRepMaxes.map((pr: any) => (
                                <button
                                    key={pr.name}
                                    onClick={() => togglePrSelection(pr.name)}
                                    className={`flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all border ${selectedPrs.includes(pr.name) ? 'bg-gym-primary/20 text-gym-primary border-gym-primary/50' : 'bg-neutral-900 text-neutral-400 border-neutral-800'}`}
                                >
                                    <span>{pr.name} ({pr.max}kg)</span>
                                    {selectedPrs.includes(pr.name) && <Check size={14} />}
                                </button>
                            ))}
                            {stats.oneRepMaxes.length === 0 && <p className="text-white/50 text-center text-xs">No hay récords disponibles.</p>}
                        </div>
                    </div>
                )}

                {/* 3. RADAR SELECTOR */}
                {showRadarSelector && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 max-w-sm bg-neutral-800/95 backdrop-blur-xl border border-neutral-700 rounded-2xl p-4 shadow-2xl z-[70] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/5">
                            <h4 className="text-sm font-bold text-white uppercase flex items-center gap-2">
                                <Settings size={14} className="text-blue-400" />
                                Ajustes de Radar
                            </h4>
                            <button onClick={() => setShowRadarSelector(false)} className="text-neutral-400 hover:text-white"><X size={16} /></button>
                        </div>

                        <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 pb-4">

                            {/* SECTION: RADAR POLYGON */}
                            <div className="space-y-3">
                                <h5 className="text-[10px] font-black text-white/50 uppercase border-b border-white/10 pb-1">Polígono</h5>
                                <div>
                                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2 block">Color Relleno</label>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {['#eab308', '#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#f472b6', '#22d3ee', '#ffffff', '#000000'].map(c => (
                                            <button
                                                key={c}
                                                onClick={() => setRadarColor(c)}
                                                className={`w-6 h-6 rounded-full border-2 transition-transform ${radarColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent'}`}
                                                style={{ backgroundColor: c }}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[9px] font-bold text-neutral-500 uppercase mb-1 block">Opacidad</label>
                                        <input type="range" min="0" max="0.8" step="0.1" value={radarOpacity} onChange={(e) => setRadarOpacity(parseFloat(e.target.value))} className="w-full accent-blue-500 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-bold text-neutral-500 uppercase mb-1 block">Grosor Línea</label>
                                        <input type="range" min="0" max="6" step="1" value={radarStroke} onChange={(e) => setRadarStroke(parseInt(e.target.value))} className="w-full accent-blue-500 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer" />
                                    </div>
                                </div>
                            </div>

                            {/* SECTION: GRID (TELARAÑA) */}
                            <div className="space-y-3">
                                <h5 className="text-[10px] font-black text-white/50 uppercase border-b border-white/10 pb-1">Telaraña (Grid)</h5>
                                {/* Style Toggles */}
                                <div className="flex gap-2">
                                    <button onClick={() => setGridDash('')} className={`flex-1 py-1 rounded text-[9px] font-bold border ${gridDash === '' ? 'bg-white text-black border-white' : 'text-neutral-500 border-neutral-700'}`}>SÓLIDO</button>
                                    <button onClick={() => setGridDash('4 4')} className={`flex-1 py-1 rounded text-[9px] font-bold border ${gridDash === '4 4' ? 'bg-white text-black border-white' : 'text-neutral-500 border-neutral-700'}`}>PUNTEADO</button>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setGridType('polygon')} className={`flex-1 py-1 rounded text-[9px] font-bold border ${gridType === 'polygon' ? 'bg-white text-black border-white' : 'text-neutral-500 border-neutral-700'}`}>POLÍGONO</button>
                                    <button onClick={() => setGridType('circle')} className={`flex-1 py-1 rounded text-[9px] font-bold border ${gridType === 'circle' ? 'bg-white text-black border-white' : 'text-neutral-500 border-neutral-700'}`}>CÍRCULO</button>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2 block">Color Grid</label>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {['rgba(255,255,255,0.2)', 'rgba(0,0,0,0.5)', '#3b82f6', '#22c55e', '#a855f7', '#f472b6', '#22d3ee', '#ffffff', '#000000'].map(c => (
                                            <button
                                                key={c}
                                                onClick={() => setGridColor(c)}
                                                className={`w-6 h-6 rounded-full border-2 transition-transform ${gridColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent'}`}
                                                style={{ backgroundColor: c }}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-neutral-500 uppercase mb-1 block">Grosor Grid</label>
                                    <input type="range" min="0" max="4" step="0.5" value={gridWidth} onChange={(e) => setGridWidth(parseFloat(e.target.value))} className="w-full accent-blue-500 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer" />
                                </div>
                            </div>

                            {/* SECTION: TEXT */}
                            <div className="space-y-3">
                                <h5 className="text-[10px] font-black text-white/50 uppercase border-b border-white/10 pb-1">Texto (Nombres)</h5>
                                <div>
                                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2 block">Color Texto</label>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {['rgba(255,255,255,0.9)', 'rgba(0,0,0,0.9)', '#eab308', '#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#f472b6', '#22d3ee', '#ffffff', '#000000'].map(c => (
                                            <button
                                                key={c}
                                                onClick={() => setRadarTextColor(c)}
                                                className={`w-6 h-6 rounded-full border-2 transition-transform ${radarTextColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent'}`}
                                                style={{ backgroundColor: c }}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-neutral-500 uppercase mb-1 block">Grosor (Peso) Fuente</label>
                                    <input type="range" min="100" max="900" step="100" value={textWeight} onChange={(e) => setTextWeight(parseInt(e.target.value))} className="w-full accent-blue-500 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer" />
                                </div>
                            </div>

                            <button
                                onClick={() => setShowRadarSelector(false)}
                                className="w-full py-3 bg-neutral-700 hover:bg-neutral-600 text-white rounded-xl text-xs font-bold transition-colors shadow-lg sticky bottom-0"
                            >
                                Listo
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};
