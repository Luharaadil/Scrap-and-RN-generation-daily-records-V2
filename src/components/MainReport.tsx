import React, { useState, useEffect, useRef, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, getDate, getDay, startOfMonth, startOfYear, isSameMonth, isSameWeek } from 'date-fns';
import { Calendar as CalendarIcon, Loader2, RefreshCw, Copy, Image as ImageIcon, Check, X, Type, Plus, Minus, Save, Edit2 } from 'lucide-react';
import { toBlob } from 'html-to-image';
import { Calendar } from '@/src/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { fetchRangeData, fetchTargets, getWebAppUrl } from '@/src/lib/api';
import { cn } from '@/src/lib/utils';
import { DateRange } from 'react-day-picker';
import { useSidebar } from '@/src/lib/SidebarContext';
import { useData } from '@/src/lib/DataContext';

export function MainReport() {
  const { 
    data, targets, configs, loading, error, loadData, loadTargets, updateTargets, saveTargetsToSheet, updateScrapReasonInSheet, isSyncingTargets,
    globalDateRange: date, setGlobalDateRange: setDate,
    selectedWeek, setSelectedWeek,
    numWeeks, setNumWeeks
  } = useData();
  const [copiedText, setCopiedText] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  
  const [editingScrap, setEditingScrap] = useState<string | null>(null);
  const [editReason, setEditReason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const [detailModal, setDetailModal] = useState<{date: Date, type: 'BIC' | 'PLY_CHAFER' | 'RUBBER_MIXING' | 'RN'} | null>(null);
  const [usageDetailModal, setUsageDetailModal] = useState<{date: Date, type: 'BIC' | 'PLY_CHAFER' | 'RUBBER_MIXING' | 'RN'} | null>(null);
  const [highlightedCols, setHighlightedCols] = useState<number[]>([]);
  const [highlightedRows, setHighlightedRows] = useState<number[]>([]);
  const [modalCopied, setModalCopied] = useState(false);
  const [isEditingFont, setIsEditingFont] = useState(false);
  const [rowFontSizes, setRowFontSizes] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('mri_row_font_sizes');
    return saved ? JSON.parse(saved) : {};
  });
  const [isEditingTargets, setIsEditingTargets] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ id: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const tableRef = useRef<HTMLDivElement>(null);
  const scrapModalRef = useRef<HTMLDivElement>(null);
  const usageModalRef = useRef<HTMLDivElement>(null);
  const { setControls, sidebarOpen } = useSidebar();

  useEffect(() => {
    localStorage.setItem('mri_row_font_sizes', JSON.stringify(rowFontSizes));
  }, [rowFontSizes]);

  const adjustFontSize = (rowId: string, delta: number) => {
    setRowFontSizes(prev => ({
      ...prev,
      [rowId]: Math.max(8, (prev[rowId] || 17) + delta)
    }));
  };

  useEffect(() => {
    setControls(
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={copyValuesOnly} title="Copy values only (for Excel)" className="h-10 font-bold">
            {copiedText ? <Check className="h-4 w-4 mr-2 text-green-600" /> : <Copy className="h-4 w-4 mr-2" />}
            <span className="hidden sm:inline">Values</span>
          </Button>
          <Button variant="outline" size="sm" onClick={copyAsPicture} title="Copy table as picture" className="h-10 font-bold">
            {copiedImage ? <Check className="h-4 w-4 mr-2 text-green-600" /> : <ImageIcon className="h-4 w-4 mr-2" />}
            <span className="hidden sm:inline">Picture</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={loading} className="h-10 font-bold">
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            <span className="hidden sm:inline">Reload</span>
          </Button>
          <Button 
            variant={isEditingFont ? "default" : "outline"} 
            size="sm" 
            onClick={() => setIsEditingFont(!isEditingFont)} 
            title="Edit row font sizes" 
            className="h-10 font-bold"
          >
            <Type className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Font</span>
          </Button>
        </div>
      </div>
    );
    return () => setControls(null);
  }, [loading, copiedText, copiedImage, isEditingFont]);

  const days = useMemo(() => {
    if (!date?.from) return [];
    if (!date.to) return [date.from];
    try {
      const start = date.from;
      const end = date.to;
      if (start > end) return [start];
      return eachDayOfInterval({ start, end });
    } catch (e) {
      console.error("Error calculating days interval in MainReport:", e);
      return [date.from];
    }
  }, [date]);

  const getSummaryForDate = (d: Date) => {
    const formattedDate = format(d, 'yyyy-MM-dd');
    const daySummaries = data?.summaries?.filter((s: any) => s.date === formattedDate) || [];
    if (daySummaries.length === 0) return null;
    
    return daySummaries.reduce((acc: any, curr: any) => ({
      ...curr,
      bicUsage: (acc.bicUsage || 0) + (parseFloat(curr.bicUsage) || 0),
      plyUsage: (acc.plyUsage || 0) + (parseFloat(curr.plyUsage) || 0),
      extrusionRubberUsage: (acc.extrusionRubberUsage || 0) + (parseFloat(curr.extrusionRubberUsage) || 0),
      tireBuildingUsage: (acc.tireBuildingUsage || 0) + (parseFloat(curr.tireBuildingUsage) || 0),
      curingUsage: (acc.curingUsage || 0) + (parseFloat(curr.curingUsage) || 0),
      mixingRubberUsage: (acc.mixingRubberUsage || 0) + (parseFloat(curr.mixingRubberUsage || curr.rubberUsage) || 0)
    }), { bicUsage: 0, plyUsage: 0, extrusionRubberUsage: 0, mixingRubberUsage: 0, tireBuildingUsage: 0, curingUsage: 0 });
  };

  const getCustomScrapForDate = (d: Date, type: 'BIC' | 'PLY_CHAFER' | 'RUBBER_MIXING' | 'RN') => {
    const formattedDate = format(d, 'yyyy-MM-dd');
    const dayScraps = data?.scraps?.filter((s: any) => s.date === formattedDate) || [];
    
    const hasSummary = data?.summaries?.some((s: any) => s.date === formattedDate);
    
    let filtered = [];
    if (type === 'BIC') {
      filtered = dayScraps.filter((s: any) => s.material === 'BIC');
    } else if (type === 'PLY_CHAFER') {
      filtered = dayScraps.filter((s: any) => 
        (s.material === 'PLY' || s.material === 'Chafer') && 
        (s.section === 'Calendering' || s.section === 'Cutting')
      );
    } else if (type === 'RUBBER_MIXING') {
      filtered = dayScraps.filter((s: any) => 
        s.material === 'Rubber' && s.section === 'Mixing'
      );
    } else if (type === 'RN') {
      filtered = dayScraps.filter((s: any) => 
        s.material === 'Extrusion Rubber' || 
        s.material === 'RN' || 
        (s.material === 'Rubber' && (s.section === 'Tire building' || s.section === 'Calendering' || s.section === 'Cutting'))
      );
    }
    
    if (filtered.length === 0) {
      return hasSummary ? 0 : null;
    }
    return filtered.reduce((sum: number, s: any) => sum + (parseFloat(s.weight) || 0), 0);
  };

  const calculateRate = (scrap: number | null, usage: number | null) => {
    if (usage === null || usage === undefined) return null;
    if (scrap === null || scrap === undefined) return null;
    const s = parseFloat(scrap as any);
    const u = parseFloat(usage as any);
    if (isNaN(s) || isNaN(u)) return null;
    if (s === 0) return 0;
    if (u === 0) return 0;
    return ((s / u) * 100).toFixed(3) + '%';
  };

  const copyValuesOnly = () => {
    if (!days.length) return;
    
    const rowsData = [
      // BIC
      days.map(d => getSummaryForDate(d)?.bicUsage || '0'),
      days.map(d => getCustomScrapForDate(d, 'BIC') || '0'),
      days.map(d => calculateRate(getCustomScrapForDate(d, 'BIC'), getSummaryForDate(d)?.bicUsage)),
      // PLY + Chafer
      days.map(d => getSummaryForDate(d)?.plyUsage || '0'),
      days.map(d => getCustomScrapForDate(d, 'PLY_CHAFER') || '0'),
      days.map(d => calculateRate(getCustomScrapForDate(d, 'PLY_CHAFER'), getSummaryForDate(d)?.plyUsage)),
      // Rubber Mixing
      days.map(d => {
        const s = getSummaryForDate(d);
        return s?.mixingRubberUsage || s?.rubberUsage || '0';
      }),
      days.map(d => getCustomScrapForDate(d, 'RUBBER_MIXING') || '0'),
      days.map(d => {
        const s = getSummaryForDate(d);
        return calculateRate(getCustomScrapForDate(d, 'RUBBER_MIXING'), s?.mixingRubberUsage || s?.rubberUsage);
      }),
      // RN
      days.map(d => {
        const s = getSummaryForDate(d);
        // Point 1: Usage includes only extrusion
        return (Number(s?.extrusionRubberUsage || 0)).toString();
      }),
      days.map(d => getCustomScrapForDate(d, 'RN') || '0'),
      days.map(d => {
        const s = getSummaryForDate(d);
        // Point 2: RN ratio = Total Scraps / Extrusion Usage
        return calculateRate(getCustomScrapForDate(d, 'RN'), Number(s?.extrusionRubberUsage || 0));
      }),
    ];

    const tsv = rowsData.map(row => row.join('\t')).join('\n');
    navigator.clipboard.writeText(tsv).then(() => {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    });
  };

  const copyAsPicture = async () => {
    if (!tableRef.current) return;
    try {
      // To capture the full table even if scrolled, we temporarily remove constraints
      const originalStyle = tableRef.current.getAttribute('style') || '';
      const originalParentStyle = tableRef.current.parentElement?.getAttribute('style') || '';
      
      // Force full width and height for capture
      tableRef.current.style.width = 'max-content';
      tableRef.current.style.height = 'auto';
      tableRef.current.style.overflow = 'visible';
      if (tableRef.current.parentElement) {
        tableRef.current.parentElement.style.overflow = 'visible';
      }

      const blob = await toBlob(tableRef.current, { 
        backgroundColor: '#ffffff',
        pixelRatio: 2
      });

      // Restore styles
      tableRef.current.setAttribute('style', originalStyle);
      if (tableRef.current.parentElement) {
        tableRef.current.parentElement.setAttribute('style', originalParentStyle);
      }
      
      if (!blob) return;

      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopiedImage(true);
        setTimeout(() => setCopiedImage(false), 2000);
      } catch (clipboardErr) {
        console.error('Clipboard write failed, falling back to download', clipboardErr);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Weekly_Report_${format(new Date(), 'yyyyMMdd')}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setCopiedImage(true);
        setTimeout(() => setCopiedImage(false), 2000);
      }
    } catch (err) {
      console.error('Failed to generate image', err);
    }
  };

  const getFilteredScrapsForModal = () => {
    if (!detailModal) return [];
    const formattedDate = format(detailModal.date, 'yyyy-MM-dd');
    const dayScraps = data?.scraps?.filter((s: any) => s.date === formattedDate) || [];
    
    if (detailModal.type === 'BIC') {
      return dayScraps.filter((s: any) => s.material === 'BIC');
    } else if (detailModal.type === 'PLY_CHAFER') {
      return dayScraps.filter((s: any) => 
        (s.material === 'PLY' || s.material === 'Chafer') && 
        (s.section === 'Calendering' || s.section === 'Cutting')
      );
    } else if (detailModal.type === 'RUBBER_MIXING') {
      return dayScraps.filter((s: any) => 
        s.material === 'Rubber' && s.section === 'Mixing'
      );
    } else if (detailModal.type === 'RN') {
      return dayScraps.filter((s: any) => 
        s.material === 'Extrusion Rubber' || 
        s.material === 'RN' || 
        (s.material === 'Rubber' && (s.section === 'Tire building' || s.section === 'Calendering' || s.section === 'Cutting'))
      );
    }
    return [];
  };

  const formatToIST = (timestamp: string) => {
    if (!timestamp || timestamp === '-') return '-';
    try {
      const dateObj = new Date(timestamp);
      if (!isNaN(dateObj.getTime())) {
        return dateObj.toLocaleString('en-IN', { 
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(/\//g, '-');
      }
      return timestamp;
    } catch (e) {
      return timestamp;
    }
  };

  const renderCell = (d: Date, type: 'BIC' | 'PLY_CHAFER' | 'RUBBER_MIXING' | 'RN', value: any, rowId: string) => {
    let displayValue: React.ReactNode = '';
    let isOverTarget = false;
    const isUsageRow = rowId.endsWith('_usage');
    
    // Check if there is ANY data for this date at all
    const formattedDate = format(d, 'yyyy-MM-dd');
    const daySummaries = data?.summaries?.filter((s: any) => s.date === formattedDate) || [];
    const dayScraps = data?.scraps?.filter((s: any) => s.date === formattedDate) || [];
    
    // A day has data if it has scraps OR if any summary field is non-zero
    const hasAnyScrap = dayScraps.length > 0;
    const hasAnySummaryValue = daySummaries.some((s: any) => 
      Number(s.bicUsage || 0) > 0 || 
      Number(s.plyUsage || 0) > 0 || 
      Number(s.mixingRubberUsage || 0) > 0 || 
      Number(s.rubberUsage || 0) > 0 || 
      Number(s.extrusionRubberUsage || 0) > 0 ||
      Number(s.chaferUsage || 0) > 0
    );
    
    const hasData = hasAnyScrap || hasAnySummaryValue;

    if (!hasData) {
      displayValue = '';
    } else if (value === null || value === undefined || value === '') {
      displayValue = '';
    } else if (typeof value === 'number') {
      // If value is 0 but we have data for the day, show 0. Otherwise blank.
      displayValue = value === 0 ? '0' : (isUsageRow ? value.toFixed(0) : value.toFixed(1));
      
      // Check target
      const target = targets[rowId];
      if (target && target.period !== 'not_use' && target.value > 0) {
        if (target.period === 'daily') {
          isOverTarget = value > target.value;
        } else if (target.period === 'weekly' || target.period === 'monthly') {
          // Cumulative logic
          const targetValue = target.value;
          let dayNum = 1;
          let totalDays = 1;
          let cumulativeScrap = 0;
          
          if (target.period === 'monthly') {
            dayNum = getDate(d);
            totalDays = 30; // Approximation as per user example
            
            // Sum all scraps in the same month up to this day
            const monthScraps = data?.scraps?.filter((s: any) => {
              const sDate = new Date(s.date);
              return isSameMonth(sDate, d) && getDate(sDate) <= dayNum;
            }) || [];
            
            // Filter by material/section
            let filtered = [];
            if (type === 'BIC') filtered = monthScraps.filter((s: any) => s.material === 'BIC');
            else if (type === 'PLY_CHAFER') filtered = monthScraps.filter((s: any) => (s.material === 'PLY' || s.material === 'Chafer') && (s.section === 'Calendering' || s.section === 'Cutting'));
            else if (type === 'RUBBER_MIXING') filtered = monthScraps.filter((s: any) => s.material === 'Rubber' && s.section === 'Mixing');
            else if (type === 'RN') filtered = monthScraps.filter((s: any) => s.material === 'Extrusion Rubber' || s.material === 'RN');
            
            cumulativeScrap = filtered.reduce((sum: number, s: any) => sum + Number(s.weight || 0), 0);
          } else {
            // Weekly
            dayNum = getDay(d); // 0-6 (Sun-Sat)
            if (dayNum === 0) dayNum = 7; // Adjust for week starting Mon
            totalDays = 7;
            
            const weekScraps = data?.scraps?.filter((s: any) => {
              const sDate = new Date(s.date);
              return isSameWeek(sDate, d, { weekStartsOn: 1 }) && sDate <= d;
            }) || [];
            
            let filtered = [];
            if (type === 'BIC') filtered = weekScraps.filter((s: any) => s.material === 'BIC');
            else if (type === 'PLY_CHAFER') filtered = weekScraps.filter((s: any) => (s.material === 'PLY' || s.material === 'Chafer') && (s.section === 'Calendering' || s.section === 'Cutting'));
            else if (type === 'RUBBER_MIXING') filtered = weekScraps.filter((s: any) => s.material === 'Rubber' && s.section === 'Mixing');
            else if (type === 'RN') filtered = weekScraps.filter((s: any) => s.material === 'Extrusion Rubber' || s.material === 'RN');
            
            cumulativeScrap = filtered.reduce((sum: number, s: any) => sum + Number(s.weight || 0), 0);
          }
          
          const cumulativeTarget = (targetValue / totalDays) * dayNum;
          isOverTarget = cumulativeScrap > cumulativeTarget;
        }
      }
    } else if (typeof value === 'string') {
      if (value === '0' || value === '0%' || value === '0.000%') {
        displayValue = '0';
      } else {
        displayValue = value;
        
        // Check rate targets
        if (rowId.endsWith('_rate')) {
          const numValue = parseFloat(value);
          const target = targets[rowId];
          if (target && target.period !== 'not_use' && target.value > 0 && !isNaN(numValue)) {
            // For rate, we usually compare the daily rate directly against the target
            // User requested: "In RN rate need to show when it is over than that highlight"
            isOverTarget = numValue > target.value;
          }
        }
      }
    }
    
    return (
      <TableCell 
        key={d.toISOString()} 
        className={cn(
          "border border-gray-300 text-center cursor-pointer hover:bg-black/5 transition-colors",
          isOverTarget && "text-red-600 font-bold"
        )}
        style={{ fontSize: `${rowFontSizes[rowId] || 17}px` }}
        onDoubleClick={() => {
          if (isUsageRow) {
            setUsageDetailModal({ date: d, type });
          } else {
            setDetailModal({ date: d, type });
          }
        }}
        title={isOverTarget ? "Exceeds target standard!" : `Double click to view ${isUsageRow ? 'usage' : 'scrap'} details`}
      >
        {displayValue}
      </TableCell>
    );
  };

  const RowHeader = ({ title, subtitle, rowId }: { title: string, subtitle: string, rowId: string }) => (
    <TableCell 
      className="border border-gray-300 font-medium leading-tight py-2 min-w-[150px] max-w-[250px] whitespace-normal relative group"
      style={{ fontSize: `${rowFontSizes[rowId] || 17}px` }}
    >
      <div className="text-sm" style={{ fontSize: 'inherit' }}>{title}</div>
      <div className="text-xs text-gray-500 mt-0.5" style={{ fontSize: `${(rowFontSizes[rowId] || 17) * 0.8}px` }}>{subtitle}</div>
      
      {isEditingFont && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col gap-1 bg-white/90 backdrop-blur-sm p-1 rounded border shadow-sm z-10">
          <button onClick={() => adjustFontSize(rowId, 1)} className="p-0.5 hover:bg-gray-100 rounded text-primary"><Plus className="h-3 w-3" /></button>
          <span className="text-[10px] text-center font-bold">{rowFontSizes[rowId] || 17}</span>
          <button onClick={() => adjustFontSize(rowId, -1)} className="p-0.5 hover:bg-gray-100 rounded text-primary"><Minus className="h-3 w-3" /></button>
        </div>
      )}
    </TableCell>
  );

  const copyModalAsPicture = async (ref: React.RefObject<HTMLDivElement>, filename: string) => {
    if (!ref.current) return;
    try {
      // To capture the full table even if scrolled, we temporarily remove constraints
      const originalStyle = ref.current.getAttribute('style') || '';
      const originalParentStyle = ref.current.parentElement?.getAttribute('style') || '';
      
      // Force full width and height for capture
      ref.current.style.width = 'max-content';
      ref.current.style.height = 'auto';
      ref.current.style.overflow = 'visible';
      if (ref.current.parentElement) {
        ref.current.parentElement.style.overflow = 'visible';
      }

      const blob = await toBlob(ref.current, { 
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });

      // Restore styles
      ref.current.setAttribute('style', originalStyle);
      if (ref.current.parentElement) {
        ref.current.parentElement.setAttribute('style', originalParentStyle);
      }

      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setModalCopied(true);
      setTimeout(() => setModalCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy modal picture', err);
    }
  };

  useEffect(() => {
    if (isEditingTargets && configs.length === 0 && !isSyncingTargets) {
      loadTargets();
    }
  }, [isEditingTargets, configs, isSyncingTargets, loadTargets]);

  const handleLogin = () => {
    if (configs.length === 0) {
      setLoginError('Configuration could not be loaded from Google Sheets. Please ensure the backend script is updated to return ID and Password.');
      return;
    }
    
    const matched = configs.find(c => c.id === loginForm.id && c.password === loginForm.password);
    
    if (matched) {
      setIsLoggedIn(true);
      setLoginError('');
    } else {
      setLoginError('Invalid ID or Password');
    }
  };

  const handleSaveTargets = async () => {
    try {
      await saveTargetsToSheet(targets);
      setIsEditingTargets(false);
      setIsLoggedIn(false);
      setLoginForm({ id: '', password: '' });
    } catch (err) {
      alert('Failed to save targets to Google Sheet');
    }
  };

  const handleSaveReason = async (timestamp: string) => {
    if (!timestamp) return;
    setIsUpdating(true);
    try {
      await updateScrapReasonInSheet(timestamp, editReason);
      setEditingScrap(null);
    } catch (err) {
      alert('Failed to update reason');
    } finally {
      setIsUpdating(false);
    }
  };

  const startEditing = (scrap: any) => {
    setEditingScrap(scrap.timestamp);
    setEditReason(scrap.reason || '');
  };

  const monthlyTotals = useMemo(() => {
    let bicUsage = 0, bicScrap = 0;
    let plyUsage = 0, plyScrap = 0;
    let rubberUsage = 0, rubberScrap = 0;
    let rnUsage = 0, rnScrap = 0;
    let hasData = false;

    if (!date?.from) {
      return {
        hasData,
        bicUsage, bicScrap,
        plyUsage, plyScrap,
        rubberUsage, rubberScrap,
        rnUsage, rnScrap
      };
    }

    const monthStart = startOfMonth(date.from);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    allDaysInMonth.forEach(d => {
      const summary = getSummaryForDate(d);
      const dayBicScrap = getCustomScrapForDate(d, 'BIC');
      const dayPlyScrap = getCustomScrapForDate(d, 'PLY_CHAFER');
      const dayRubberScrap = getCustomScrapForDate(d, 'RUBBER_MIXING');
      const dayRnScrap = getCustomScrapForDate(d, 'RN');

      if (summary || dayBicScrap !== null || dayPlyScrap !== null || dayRubberScrap !== null || dayRnScrap !== null) {
        hasData = true;
      }

      bicUsage += summary?.bicUsage || 0;
      plyUsage += summary?.plyUsage || 0;
      rubberUsage += summary?.mixingRubberUsage || summary?.rubberUsage || 0;
      rnUsage += summary?.extrusionRubberUsage || 0;

      bicScrap += dayBicScrap || 0;
      plyScrap += dayPlyScrap || 0;
      rubberScrap += dayRubberScrap || 0;
      rnScrap += dayRnScrap || 0;
    });

    return {
      hasData,
      bicUsage, bicScrap,
      plyUsage, plyScrap,
      rubberUsage, rubberScrap,
      rnUsage, rnScrap
    };
  }, [date, data]);

  const renderTotalCell = (type: 'BIC' | 'PLY_CHAFER' | 'RUBBER_MIXING' | 'RN', rowType: 'usage' | 'scrap' | 'rate', rowId: string) => {
    if (!monthlyTotals.hasData) return <TableCell className="border border-gray-300 bg-[#f8f9fa] text-center min-w-[100px]"></TableCell>;

    let value: number | string | null = null;
    let usage = 0;
    let scrap = 0;

    switch (type) {
      case 'BIC': usage = monthlyTotals.bicUsage; scrap = monthlyTotals.bicScrap; break;
      case 'PLY_CHAFER': usage = monthlyTotals.plyUsage; scrap = monthlyTotals.plyScrap; break;
      case 'RUBBER_MIXING': usage = monthlyTotals.rubberUsage; scrap = monthlyTotals.rubberScrap; break;
      case 'RN': usage = monthlyTotals.rnUsage; scrap = monthlyTotals.rnScrap; break;
    }

    if (rowType === 'usage') value = usage;
    else if (rowType === 'scrap') value = scrap;
    else if (rowType === 'rate') {
      value = calculateRate(scrap, usage);
    }

    let displayValue: React.ReactNode = '';
    let isOverTarget = false;
    
    if (value === null || value === undefined) {
      displayValue = '';
    } else if (typeof value === 'number') {
      displayValue = value === 0 ? '0' : (rowType === 'usage' ? value.toFixed(0) : value.toFixed(1));
    } else if (typeof value === 'string') {
      if (value === '0' || value === '0%' || value === '0.000%') {
        displayValue = '0';
      } else {
        displayValue = value;
        // Check rate targets
        if (rowId.endsWith('_rate')) {
          const numValue = parseFloat(value);
          const target = targets[rowId];
          if (target && target.period !== 'not_use' && target.value > 0 && !isNaN(numValue)) {
            // Rate is considered over target if greater, unless we explicitly configure RN rate differently.
            // Keeping it consistent with daily logic.
            isOverTarget = numValue > target.value;
          }
        }
      }
    }

    return (
      <TableCell className={cn(
        "border border-gray-300 text-center font-bold bg-[#f8f9fa] text-blue-900 min-w-[100px]",
        isOverTarget && "text-red-600 font-bold bg-red-50"
      )}
      style={{ fontSize: `${rowFontSizes[rowId] || 17}px` }}
      >
        {displayValue}
      </TableCell>
    );
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="text-red-500 text-sm font-medium">{error}</div>
      )}

      <Card className="overflow-hidden">
        <div ref={tableRef} className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
            <div className="flex-1" />
            <CardTitle className="text-2xl text-center flex-1 whitespace-nowrap">2026 MRI Production Weekly Report</CardTitle>
            <div className="flex items-center gap-2 flex-1 justify-end flex-wrap">
              <div className="flex items-center gap-2">
                <Select value={selectedWeek.toString()} onValueChange={(v) => setSelectedWeek(parseInt(v))}>
                  <SelectTrigger className="w-[120px] h-10 font-bold">
                    <SelectValue placeholder="Select Week" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 52 }, (_, i) => i + 1).map((w) => (
                      <SelectItem key={w} value={w.toString()}>
                        Week {w}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={numWeeks.toString()} onValueChange={(v) => setNumWeeks(parseInt(v))}>
                  <SelectTrigger className="w-[80px] h-10 font-bold">
                    <SelectValue placeholder="Weeks" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={n.toString()}>
                        {n} {n === 1 ? 'Week' : 'Weeks'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 font-bold">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date?.from ? (
                      date.to ? (
                        <>
                          {format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(date.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={setDate}
                    numberOfMonths={1}
                  />
                </PopoverContent>
              </Popover>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0" 
                onClick={() => setIsEditingTargets(true)}
                title="Target Settings"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <div className="p-4">
              <Table className="border-collapse border border-gray-300 w-full min-w-[800px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="border border-gray-300 bg-gray-50 font-semibold text-center min-w-[150px] max-w-[250px] whitespace-normal">
                    <div>Date</div>
                    <div className="text-sm font-normal text-gray-600">日期</div>
                  </TableHead>
                  <TableHead className="border border-gray-300 bg-[#f8f9fa] font-semibold text-center min-w-[100px] text-lg text-blue-800">
                    <div>Monthly Total</div>
                    <div className="text-sm font-normal text-slate-500">月度總計</div>
                  </TableHead>
                  {days.map((d, i) => (
                    <TableHead key={i} className="border border-gray-300 bg-gray-50 font-semibold text-center min-w-[80px] text-lg">
                      {format(d, 'M-d')}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <RowHeader title="BIC usage weight (kg)" subtitle="鋼絲使用重量(kg)" rowId="bic_usage" />
                  {renderTotalCell('BIC', 'usage', 'bic_usage')}
                  {days.map((d) => {
                    const summary = getSummaryForDate(d);
                    return renderCell(d, 'BIC', summary ? (summary.bicUsage ?? 0) : null, 'bic_usage');
                  })}
                </TableRow>
                <TableRow>
                  <RowHeader title="BIC scrapping weight (kg)" subtitle="鋼絲報廢公斤數(kg)" rowId="bic_scrap" />
                  {renderTotalCell('BIC', 'scrap', 'bic_scrap')}
                  {days.map((d) => renderCell(d, 'BIC', getCustomScrapForDate(d, 'BIC'), 'bic_scrap'))}
                </TableRow>
                <TableRow className="bg-[#e2f0d9]">
                  <RowHeader title="BIC scrap rate (%)" subtitle="鋼絲報廢率(%)" rowId="bic_rate" />
                  {renderTotalCell('BIC', 'rate', 'bic_rate')}
                  {days.map((d) => {
                    const summary = getSummaryForDate(d);
                    return renderCell(d, 'BIC', calculateRate(getCustomScrapForDate(d, 'BIC'), summary ? (summary.bicUsage ?? 0) : null), 'bic_rate');
                  })}
                </TableRow>

                {/* PLY + Chafer */}
                <TableRow>
                  <RowHeader title="PLY & Chafer usage weight (kg)" subtitle="簾紗及防擦布使用重量(kg)" rowId="ply_usage" />
                  {renderTotalCell('PLY_CHAFER', 'usage', 'ply_usage')}
                  {days.map((d) => {
                    const summary = getSummaryForDate(d);
                    return renderCell(d, 'PLY_CHAFER', summary ? (summary.plyUsage ?? 0) : null, 'ply_usage');
                  })}
                </TableRow>
                <TableRow>
                  <RowHeader title="PLY & Chafer scrap weight (kg)" subtitle="簾紗及防擦布報廢公斤數(kg)" rowId="ply_scrap" />
                  {renderTotalCell('PLY_CHAFER', 'scrap', 'ply_scrap')}
                  {days.map((d) => renderCell(d, 'PLY_CHAFER', getCustomScrapForDate(d, 'PLY_CHAFER'), 'ply_scrap'))}
                </TableRow>
                <TableRow className="bg-[#fce4d6]">
                  <RowHeader title="PLY & Chafer scrap rate (%)" subtitle="簾紗及防擦布報廢率(%)" rowId="ply_rate" />
                  {renderTotalCell('PLY_CHAFER', 'rate', 'ply_rate')}
                  {days.map((d) => {
                    const summary = getSummaryForDate(d);
                    return renderCell(d, 'PLY_CHAFER', calculateRate(getCustomScrapForDate(d, 'PLY_CHAFER'), summary ? (summary.plyUsage ?? 0) : null), 'ply_rate');
                  })}
                </TableRow>

                {/* Rubber (Mixing) */}
                <TableRow>
                  <RowHeader title="Rubber usage weight (Mixing) (kg)" subtitle="膠料使用重量(kg)" rowId="rubber_usage" />
                  {renderTotalCell('RUBBER_MIXING', 'usage', 'rubber_usage')}
                  {days.map((d) => {
                    const summary = getSummaryForDate(d);
                    return renderCell(d, 'RUBBER_MIXING', summary ? (summary.mixingRubberUsage ?? summary.rubberUsage ?? 0) : null, 'rubber_usage');
                  })}
                </TableRow>
                <TableRow>
                  <RowHeader title="Rubber scrap weight (Mixing) (kg)" subtitle="膠料報廢公斤數(kg)" rowId="rubber_scrap" />
                  {renderTotalCell('RUBBER_MIXING', 'scrap', 'rubber_scrap')}
                  {days.map((d) => renderCell(d, 'RUBBER_MIXING', getCustomScrapForDate(d, 'RUBBER_MIXING'), 'rubber_scrap'))}
                </TableRow>
                <TableRow className="bg-[#ddebf7]">
                  <RowHeader title="Rubber scrap rate (Mixing) (%)" subtitle="膠料報廢率(%)" rowId="rubber_rate" />
                  {renderTotalCell('RUBBER_MIXING', 'rate', 'rubber_rate')}
                  {days.map((d) => {
                    const summary = getSummaryForDate(d);
                    return renderCell(d, 'RUBBER_MIXING', calculateRate(getCustomScrapForDate(d, 'RUBBER_MIXING'), summary ? (summary.mixingRubberUsage ?? summary.rubberUsage ?? 0) : null), 'rubber_rate');
                  })}
                </TableRow>

                {/* RN (Rubber Recycling) */}
                <TableRow>
                  <RowHeader title="Extrusion rubber usage (kg)" subtitle="擠出膠料使用重量(kg)" rowId="rn_usage" />
                  {renderTotalCell('RN', 'usage', 'rn_usage')}
                  {days.map((d) => {
                    const summary = getSummaryForDate(d);
                    return renderCell(d, 'RN', summary ? (summary.extrusionRubberUsage ?? 0) : null, 'rn_usage');
                  })}
                </TableRow>
                <TableRow>
                  <RowHeader title="RN generation weight (kg)" subtitle="RN產生重量(kg)" rowId="rn_scrap" />
                  {renderTotalCell('RN', 'scrap', 'rn_scrap')}
                  {days.map((d) => renderCell(d, 'RN', getCustomScrapForDate(d, 'RN'), 'rn_scrap'))}
                </TableRow>
                <TableRow className="bg-[#ddebf7]">
                  <RowHeader title="Rubber recovery rate (%)" subtitle="膠料回收率(%)" rowId="rn_rate" />
                  {renderTotalCell('RN', 'rate', 'rn_rate')}
                  {days.map((d) => {
                    const summary = getSummaryForDate(d);
                    const usageTotal = summary ? (summary.extrusionRubberUsage ?? 0) : 0;
                    return renderCell(d, 'RN', calculateRate(getCustomScrapForDate(d, 'RN'), usageTotal || null), 'rn_rate');
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </div>
    </Card>

      {detailModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-2 md:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-[95vw] max-w-[95vw] h-[95vh] max-h-[95vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-4 flex-1">
                <h2 className="text-lg font-semibold flex-1">
                  Scrap Details - {format(detailModal.date, 'PPP')} 
                  <span className="text-muted-foreground ml-2 text-sm">
                    ({detailModal.type.replace('_', ' & ')})
                  </span>
                </h2>
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 text-primary px-3 py-1 rounded-full font-bold text-sm">
                    Total Weight: {getFilteredScrapsForModal().reduce((sum, s: any) => sum + Number(s.weight || 0), 0).toFixed(1)} kg
                  </div>
                  <Button variant="outline" size="sm" onClick={() => copyModalAsPicture(scrapModalRef, `Scrap_Details_${format(detailModal.date, 'yyyyMMdd')}`)}>
                    {modalCopied ? <Check className="h-4 w-4 mr-2 text-green-600" /> : <ImageIcon className="h-4 w-4 mr-2" />}
                    {modalCopied ? 'Copied!' : 'Copy Picture'}
                  </Button>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="ml-4" onClick={() => { setDetailModal(null); setHighlightedCols([]); setHighlightedRows([]); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 overflow-auto flex-1" ref={scrapModalRef}>
              {getFilteredScrapsForModal().length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No scrap records found for this date and material type.
                </div>
              ) : (
                <Table className="border">
                  <TableHeader>
                    <TableRow>
                      {['Date', 'Shift', 'Section', 'Material Type', 'Material Name', 'Weight (kg)', 'Main Reason', 'Reason', 'Picture', 'Recorded At'].map((head, idx) => (
                        <TableHead 
                          key={idx} 
                          className={cn("cursor-pointer hover:bg-gray-100 transition-colors", highlightedCols.includes(idx) && "bg-yellow-100 text-yellow-900 font-bold")}
                          onClick={() => setHighlightedCols(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])}
                        >
                          {head}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getFilteredScrapsForModal().map((scrap: any, i: number) => (
                      <TableRow 
                        key={i} 
                        className={cn("cursor-pointer hover:bg-gray-50 transition-colors", highlightedRows.includes(i) && "bg-yellow-100")}
                        onClick={() => setHighlightedRows(prev => prev.includes(i) ? prev.filter(idx => idx !== i) : [...prev, i])}
                      >
                        <TableCell className={cn("whitespace-nowrap", highlightedCols.includes(0) && "bg-yellow-50")}>{scrap.date}</TableCell>
                        <TableCell className={cn(highlightedCols.includes(1) && "bg-yellow-50")}>{scrap.shift}</TableCell>
                        <TableCell className={cn(highlightedCols.includes(2) && "bg-yellow-50")}>{scrap.section}</TableCell>
                        <TableCell className={cn("font-medium", highlightedCols.includes(3) && "bg-yellow-50")}>{scrap.material}</TableCell>
                        <TableCell className={cn(highlightedCols.includes(4) && "bg-yellow-50")}>{scrap.materialName || '-'}</TableCell>
                        <TableCell className={cn(highlightedCols.includes(5) && "bg-yellow-50")}>{typeof scrap.weight === 'number' ? (scrap.weight === 0 ? '0' : scrap.weight.toFixed(1)) : (scrap.weight || '0')}</TableCell>
                        <TableCell className={cn(highlightedCols.includes(6) && "bg-yellow-50")}>
                          {scrap.mainReason || '-'}
                        </TableCell>
                        <TableCell className={cn(highlightedCols.includes(7) && "bg-yellow-50")}>
                          {editingScrap === scrap.timestamp ? (
                            <div className="flex items-center gap-2">
                              <input 
                                type="text" 
                                className="border rounded px-2 py-1 text-sm flex-1"
                                value={editReason}
                                onChange={(e) => setEditReason(e.target.value)}
                                autoFocus
                              />
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-green-600"
                                onClick={() => handleSaveReason(scrap.timestamp)}
                                disabled={isUpdating}
                              >
                                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-red-600"
                                onClick={() => setEditingScrap(null)}
                                disabled={isUpdating}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between group">
                              <span>{scrap.reason}</span>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => startEditing(scrap)}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className={cn(highlightedCols.includes(8) && "bg-yellow-50")}>
                          {scrap.imageUrl ? (
                            <a href={scrap.imageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              View Image
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-sm">No image</span>
                          )}
                        </TableCell>
                        <TableCell className={cn("text-muted-foreground whitespace-nowrap", highlightedCols.includes(9) && "bg-yellow-50")}>{formatToIST(scrap.timestamp || scrap.time || '-')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>
      )}

      {usageDetailModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold">
                  {usageDetailModal.type === 'RN' ? 'Usage & RN Summary' : 'Usage & Scrap Summary'} - {format(usageDetailModal.date, 'PPP')}
                  <span className="text-muted-foreground ml-2 text-sm">
                    ({usageDetailModal.type === 'RN' ? 'RN Generation' : usageDetailModal.type.replace('_', ' & ')})
                  </span>
                </h2>
                <Button variant="outline" size="sm" onClick={() => copyModalAsPicture(usageModalRef, `Usage_Details_${format(usageDetailModal.date, 'yyyyMMdd')}`)}>
                  {modalCopied ? <Check className="h-4 w-4 mr-2 text-green-600" /> : <ImageIcon className="h-4 w-4 mr-2" />}
                  {modalCopied ? 'Copied!' : 'Copy Picture'}
                </Button>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setUsageDetailModal(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 overflow-auto flex-1" ref={usageModalRef}>
              <Table className="border">
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-bold border">Shift</TableHead>
                    {usageDetailModal.type === 'RN' ? (
                      <>
                        <TableHead className="font-bold border text-center">Extrusion Usage (kg)</TableHead>
                        <TableHead className="font-bold border text-center">Extrusion RN (kg)</TableHead>
                        <TableHead className="font-bold border text-center">Tire Building RN (kg)</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead className="font-bold border text-center">Usage Weight (kg)</TableHead>
                        <TableHead className="font-bold border text-center">Scrap Weight (kg)</TableHead>
                      </>
                    )}
                    <TableHead className="font-bold border text-center">
                      {usageDetailModal.type === 'RN' ? 'RN Rate (%)' : 'Scrap Rate (%)'}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {['A', 'B', 'C', 'A1', 'C1'].map((shift) => {
                    const formattedDate = format(usageDetailModal.date, 'yyyy-MM-dd');
                    const shiftSummary = data?.summaries?.find((s: any) => s.date === formattedDate && s.shift === shift);
                    const dayScraps = data?.scraps?.filter((s: any) => s.date === formattedDate && s.shift === shift) || [];
                    
                    let usage = 0;
                    let extrusionUsage = 0;
                    let tireBuildingUsage = 0;

                    if (usageDetailModal.type === 'BIC') usage = Number(shiftSummary?.bicUsage || 0);
                    else if (usageDetailModal.type === 'PLY_CHAFER') usage = Number(shiftSummary?.plyUsage || 0);
                    else if (usageDetailModal.type === 'RUBBER_MIXING') usage = Number(shiftSummary?.mixingRubberUsage || shiftSummary?.rubberUsage || 0);
                    else if (usageDetailModal.type === 'RN') {
                      extrusionUsage = Number(shiftSummary?.extrusionRubberUsage || 0);
                      tireBuildingUsage = Number(shiftSummary?.tireBuildingUsage || 0);
                      usage = extrusionUsage + tireBuildingUsage;
                    }

                    let scrap = 0;
                    let extrusionScrap = 0;
                    let tireBuildingScrap = 0;
                    let filteredScraps = [];

                    if (usageDetailModal.type === 'BIC') filteredScraps = dayScraps.filter((s: any) => s.material === 'BIC');
                    else if (usageDetailModal.type === 'PLY_CHAFER') filteredScraps = dayScraps.filter((s: any) => (s.material === 'PLY' || s.material === 'Chafer') && (s.section === 'Calendering' || s.section === 'Cutting'));
                    else if (usageDetailModal.type === 'RUBBER_MIXING') filteredScraps = dayScraps.filter((s: any) => s.material === 'Rubber' && s.section === 'Mixing');
                    else if (usageDetailModal.type === 'RN') {
                      extrusionScrap = dayScraps.filter((s: any) => 
                        (s.material === 'Extrusion Rubber' || s.material === 'RN') && 
                        (s.section === 'Extrusion' || !s.section || s.section === 'Mixing')
                      ).reduce((sum: number, s: any) => sum + Number(s.weight || 0), 0);
                      tireBuildingScrap = dayScraps.filter((s: any) => 
                        (s.material === 'Rubber' || s.material === 'RN') && 
                        s.section === 'Tire building'
                      ).reduce((sum: number, s: any) => sum + Number(s.weight || 0), 0);
                      scrap = extrusionScrap + tireBuildingScrap;
                    } else {
                      scrap = filteredScraps.reduce((sum: number, s: any) => sum + Number(s.weight || 0), 0);
                    }
                    
                    // Point 2: RN ratio = (Total RN) / Extrusion usage
                    const rate = usageDetailModal.type === 'RN' 
                      ? (extrusionUsage > 0 ? ((scrap / extrusionUsage) * 100).toFixed(3) + '%' : '0%')
                      : (usage > 0 ? ((scrap / usage) * 100).toFixed(3) + '%' : '0%');

                    return (
                      <TableRow key={shift}>
                        <TableCell className="font-bold border">{shift}</TableCell>
                        {usageDetailModal.type === 'RN' ? (
                          <>
                            <TableCell className="text-center border">{extrusionUsage.toFixed(0)}</TableCell>
                            <TableCell className="text-center border">{extrusionScrap.toFixed(1)}</TableCell>
                            <TableCell className="text-center border">{tireBuildingScrap.toFixed(1)}</TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="text-center border">{usage.toFixed(0)}</TableCell>
                            <TableCell className="text-center border">{scrap.toFixed(1)}</TableCell>
                          </>
                        )}
                        <TableCell className="text-center border font-medium">{rate}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-gray-100 font-bold">
                    <TableCell className="border">TOTAL</TableCell>
                    {(() => {
                      const formattedDate = format(usageDetailModal.date, 'yyyy-MM-dd');
                      const daySummaries = data?.summaries?.filter((s: any) => s.date === formattedDate) || [];
                      const dayScraps = data?.scraps?.filter((s: any) => s.date === formattedDate) || [];
                      
                      let totalUsage = 0;
                      let totalExtrusionUsage = 0;
                      let totalTireBuildingUsage = 0;

                      if (usageDetailModal.type === 'BIC') totalUsage = daySummaries.reduce((sum: number, s: any) => sum + Number(s.bicUsage || 0), 0);
                      else if (usageDetailModal.type === 'PLY_CHAFER') totalUsage = daySummaries.reduce((sum: number, s: any) => sum + Number(s.plyUsage || 0), 0);
                      else if (usageDetailModal.type === 'RUBBER_MIXING') totalUsage = daySummaries.reduce((sum: number, s: any) => sum + (Number(s.mixingRubberUsage || 0) || Number(s.rubberUsage || 0)), 0);
                      else if (usageDetailModal.type === 'RN') {
                        totalExtrusionUsage = daySummaries.reduce((sum: number, s: any) => sum + Number(s.extrusionRubberUsage || 0), 0);
                        totalTireBuildingUsage = daySummaries.reduce((sum: number, s: any) => sum + Number(s.tireBuildingUsage || 0), 0);
                        totalUsage = totalExtrusionUsage + totalTireBuildingUsage;
                      }

                      let totalScrap = 0;
                      let totalExtrusionScrap = 0;
                      let totalTireBuildingScrap = 0;

                      if (usageDetailModal.type === 'BIC') totalScrap = dayScraps.filter((s: any) => s.material === 'BIC').reduce((sum: number, s: any) => sum + Number(s.weight || 0), 0);
                      else if (usageDetailModal.type === 'PLY_CHAFER') totalScrap = dayScraps.filter((s: any) => (s.material === 'PLY' || s.material === 'Chafer') && (s.section === 'Calendering' || s.section === 'Cutting')).reduce((sum: number, s: any) => sum + Number(s.weight || 0), 0);
                      else if (usageDetailModal.type === 'RUBBER_MIXING') totalScrap = dayScraps.filter((s: any) => s.material === 'Rubber' && s.section === 'Mixing').reduce((sum: number, s: any) => sum + Number(s.weight || 0), 0);
                      else if (usageDetailModal.type === 'RN') {
                        totalExtrusionScrap = dayScraps.filter((s: any) => 
                          (s.material === 'Extrusion Rubber' || s.material === 'RN') && 
                          (s.section === 'Extrusion' || !s.section || s.section === 'Mixing')
                        ).reduce((sum: number, s: any) => sum + Number(s.weight || 0), 0);
                        
                        totalTireBuildingScrap = dayScraps.filter((s: any) => 
                          (s.material === 'Rubber' || s.material === 'RN') && 
                          s.section === 'Tire building'
                        ).reduce((sum: number, s: any) => sum + Number(s.weight || 0), 0);
                        
                        totalScrap = totalExtrusionScrap + totalTireBuildingScrap;
                      }
                      
                      const totalRate = usageDetailModal.type === 'RN'
                        ? (totalExtrusionUsage > 0 ? ((totalScrap / totalExtrusionUsage) * 100).toFixed(3) + '%' : '0%')
                        : (totalUsage > 0 ? ((totalScrap / totalUsage) * 100).toFixed(3) + '%' : '0%');

                      return (
                        <>
                          {usageDetailModal.type === 'RN' ? (
                            <>
                              <TableCell className="text-center border">{totalExtrusionUsage.toFixed(0)}</TableCell>
                              <TableCell className="text-center border">{totalExtrusionScrap.toFixed(1)}</TableCell>
                              <TableCell className="text-center border">{totalTireBuildingScrap.toFixed(1)}</TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell className="text-center border">{totalUsage.toFixed(0)}</TableCell>
                              <TableCell className="text-center border">{totalScrap.toFixed(1)}</TableCell>
                            </>
                          )}
                          <TableCell className="text-center border text-primary">{totalRate}</TableCell>
                        </>
                      );
                    })()}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {isEditingTargets && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Target Settings</h2>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={cn("h-8 w-8", isSyncingTargets && "animate-spin")}
                  onClick={loadTargets}
                  disabled={isSyncingTargets}
                  title="Sync from Google Sheet"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { setIsEditingTargets(false); setIsLoggedIn(false); setLoginForm({ id: '', password: '' }); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {!isLoggedIn ? (
              <div className="p-6 space-y-4">
                {isSyncingTargets && configs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 space-y-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Syncing configuration...</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Admin ID</label>
                      <input 
                        type="text" 
                        className="w-full border rounded px-3 py-2"
                        value={loginForm.id}
                        onChange={(e) => setLoginForm(prev => ({ ...prev, id: e.target.value }))}
                        placeholder="Enter ID"
                        disabled={isSyncingTargets}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Password</label>
                      <input 
                        type="password" 
                        className="w-full border rounded px-3 py-2"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Enter Password"
                        disabled={isSyncingTargets}
                        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                      />
                    </div>
                    {loginError && <p className="text-red-500 text-xs font-medium">{loginError}</p>}
                    <Button className="w-full" onClick={handleLogin} disabled={isSyncingTargets}>
                      {isSyncingTargets ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Login
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
                  {(Object.keys(targets) as Array<keyof typeof targets>).map((key) => {
                    const target = targets[key];
                    return (
                      <div key={key} className="space-y-2 border-b pb-3 last:border-0">
                        <label className="text-sm font-bold capitalize">{(key as string).replace('_', ' ')}</label>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-[10px] text-gray-500 uppercase">Target Value</label>
                            <input 
                              type="number" 
                              step="0.01"
                              className="w-full border rounded px-2 py-1 text-sm"
                              value={target.value}
                              onChange={(e) => updateTargets({
                                ...targets,
                                [key]: { ...targets[key], value: parseFloat(e.target.value) || 0 }
                              })}
                            />
                          </div>
                          <div className="w-32">
                            <label className="text-[10px] text-gray-500 uppercase">Period</label>
                            <select 
                              className="w-full border rounded px-2 py-1 text-sm"
                              value={target.period}
                              onChange={(e) => updateTargets({
                                ...targets,
                                [key]: { ...targets[key], period: e.target.value as any }
                              })}
                            >
                              <option value="daily">Daily</option>
                              <option value="weekly">Weekly</option>
                              <option value="monthly">Monthly</option>
                              <option value="not_use">Not use</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="p-4 border-t bg-gray-50 flex justify-between gap-2">
                  <Button variant="outline" onClick={() => setIsLoggedIn(false)}>Logout</Button>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setIsEditingTargets(false)}>Cancel</Button>
                    <Button onClick={handleSaveTargets} disabled={isSyncingTargets}>
                      {isSyncingTargets ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                      Save to Sheet
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
