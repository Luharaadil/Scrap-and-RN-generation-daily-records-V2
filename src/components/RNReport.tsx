import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { format, eachDayOfInterval, isAfter, startOfDay } from 'date-fns';
import { Calendar as CalendarIcon, RefreshCw, Copy, Image as ImageIcon, Check, Type, Plus, Minus, X, Eye, EyeOff, TrendingUp } from 'lucide-react';
import { toBlob } from 'html-to-image';
import { Calendar } from '@/src/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { cn } from '@/src/lib/utils';
import { DateRange } from 'react-day-picker';
import { useSidebar } from '@/src/lib/SidebarContext';
import { useData } from '@/src/lib/DataContext';
import { startOfWeek, endOfWeek } from 'date-fns';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';

const rowDefinitions = [
  ...['A', 'B', 'C', 'A1', 'C1'].flatMap(shift => [
    { id: `rn_${shift}_usage`, title: `Shift ${shift} Usage (kg)` },
    { id: `rn_${shift}_scrap`, title: `Shift ${shift} RN (kg)` },
    { id: `rn_${shift}_rate`, title: `Shift ${shift} Rate (%)` },
  ]),
  { id: 'rn_total_usage', title: 'TOTAL Usage (kg)' },
  { id: 'rn_total_scrap', title: 'TOTAL RN (kg)' },
  { id: 'rn_total_rate', title: 'TOTAL Rate (%)' },
];

export function RNReport() {
  const { 
    data, targets, loading, error, loadData,
    globalDateRange: date, setGlobalDateRange: setDate,
    selectedWeek, setSelectedWeek,
    numWeeks, setNumWeeks
  } = useData();
  const [activeTab, setActiveTab] = useState<'shift' | 'material'>('shift');
  const [copiedText, setCopiedText] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [isEditingFont, setIsEditingFont] = useState(false);
  const [detailModal, setDetailModal] = useState<{date: Date, shift?: string, materialName?: string} | null>(null);
  const [highlightedCols, setHighlightedCols] = useState<number[]>([]);
  const [highlightedRows, setHighlightedRows] = useState<number[]>([]);
  const [modalCopied, setModalCopied] = useState(false);
  const [rowFontSizes, setRowFontSizes] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('mri_rn_row_font_sizes');
    return saved ? JSON.parse(saved) : {};
  });
  const [hiddenRows, setHiddenRows] = useState<string[]>(() => {
    const saved = localStorage.getItem('mri_rn_hidden_rows');
    return saved ? JSON.parse(saved) : [];
  });
  const tableRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const scrapModalRef = useRef<HTMLDivElement>(null);
  const { setControls } = useSidebar();

  useEffect(() => {
    localStorage.setItem('mri_rn_row_font_sizes', JSON.stringify(rowFontSizes));
  }, [rowFontSizes]);

  useEffect(() => {
    localStorage.setItem('mri_rn_hidden_rows', JSON.stringify(hiddenRows));
  }, [hiddenRows]);

  const days = useMemo(() => {
    if (!date?.from) return [];
    if (!date.to) return [date.from];
    try {
      const start = date.from;
      const end = date.to;
      if (start > end) return [start];
      return eachDayOfInterval({ start, end });
    } catch (e) {
      console.error("Error calculating days interval:", e);
      return [date.from];
    }
  }, [date]);

  const adjustFontSize = useCallback((rowId: string, delta: number) => {
    setRowFontSizes(prev => ({
      ...prev,
      [rowId]: Math.max(8, (prev[rowId] || 17) + delta)
    }));
  }, []);

  const toggleRowVisibility = useCallback((rowId: string) => {
    setHiddenRows(prev => 
      prev.includes(rowId) ? prev.filter(id => id !== rowId) : [...prev, rowId]
    );
  }, []);

  const showAllRows = useCallback(() => {
    setHiddenRows([]);
  }, []);

  const getShiftData = useCallback((d: Date, shift: string) => {
    const formattedDate = format(d, 'yyyy-MM-dd');
    const summary = data?.summaries?.find((s: any) => s.date === formattedDate && s.shift === shift);
    const scraps = data?.scraps?.filter((s: any) => s.date === formattedDate && s.shift === shift) || [];
    
    if (!summary && scraps.length === 0) {
      return { usage: null, rn: null, rate: null, extrusionUsage: 0, calenderingUsage: 0, tireBuildingUsage: 0, extrusionScrap: 0, calenderingScrap: 0, tireBuildingScrap: 0 };
    }

    const extrusionUsage = parseFloat(summary?.extrusionRubberUsage) || 0;
    const calenderingUsage = parseFloat(summary?.plyUsage) || 0;
    const tireBuildingUsage = parseFloat(summary?.tireBuildingUsage) || 0;
    const usage = extrusionUsage;

    const extrusionScrap = scraps.filter((s: any) => 
      (s.material === 'Extrusion Rubber' || s.material === 'RN') && 
      (s.section === 'Extrusion' || !s.section || s.section === 'Mixing')
    ).reduce((sum: number, s: any) => sum + (parseFloat(s.weight) || 0), 0);

    const calenderingScrap = scraps.filter((s: any) => 
      (s.material === 'Extrusion Rubber' || s.material === 'RN') && 
      (s.section === 'Calendering' || s.section === 'Cutting')
    ).reduce((sum: number, s: any) => sum + (parseFloat(s.weight) || 0), 0);

    const tireBuildingScrap = scraps.filter((s: any) => 
      (s.material === 'Rubber' || s.material === 'RN') && 
      s.section === 'Tire building'
    ).reduce((sum: number, s: any) => sum + (parseFloat(s.weight) || 0), 0);

    const rn = extrusionScrap + tireBuildingScrap + calenderingScrap;
    
    const rate = extrusionUsage > 0 ? ((rn / extrusionUsage) * 100).toFixed(3) + '%' : '0%';
    
    const calenderingRate = calenderingUsage > 0 ? ((calenderingScrap / calenderingUsage) * 100).toFixed(3) + '%' : '0%';
    
    return { usage, rn, rate, extrusionUsage, calenderingUsage, tireBuildingUsage, extrusionScrap, calenderingScrap, tireBuildingScrap, calenderingRate };
  }, [data]);

  const getTotalData = useCallback((d: Date) => {
    const formattedDate = format(d, 'yyyy-MM-dd');
    const daySummaries = data?.summaries?.filter((s: any) => s.date === formattedDate) || [];
    const dayScraps = data?.scraps?.filter((s: any) => s.date === formattedDate) || [];
    
    if (daySummaries.length === 0 && dayScraps.length === 0) {
      return { usage: null, rn: null, rate: null, extrusionUsage: 0, calenderingUsage: 0, tireBuildingUsage: 0, extrusionScrap: 0, calenderingScrap: 0, tireBuildingScrap: 0 };
    }

    const extrusionUsage = daySummaries.reduce((sum: number, s: any) => sum + (parseFloat(s.extrusionRubberUsage) || 0), 0);
    const calenderingUsage = daySummaries.reduce((sum: number, s: any) => sum + (parseFloat(s.plyUsage) || 0), 0);
    const tireBuildingUsage = daySummaries.reduce((sum: number, s: any) => sum + (parseFloat(s.tireBuildingUsage) || 0), 0);
    const usage = extrusionUsage;

    const extrusionScrap = dayScraps.filter((s: any) => 
      (s.material === 'Extrusion Rubber' || s.material === 'RN') && 
      (s.section === 'Extrusion' || !s.section || s.section === 'Mixing')
    ).reduce((sum: number, s: any) => sum + (parseFloat(s.weight) || 0), 0);

    const calenderingScrap = dayScraps.filter((s: any) => 
      (s.material === 'Extrusion Rubber' || s.material === 'RN') && 
      (s.section === 'Calendering' || s.section === 'Cutting')
    ).reduce((sum: number, s: any) => sum + (parseFloat(s.weight) || 0), 0);

    const tireBuildingScrap = dayScraps.filter((s: any) => 
      (s.material === 'Rubber' || s.material === 'RN') && 
      s.section === 'Tire building'
    ).reduce((sum: number, s: any) => sum + (parseFloat(s.weight) || 0), 0);

    const rn = extrusionScrap + tireBuildingScrap + calenderingScrap;
    
    const rate = extrusionUsage > 0 ? ((rn / extrusionUsage) * 100).toFixed(3) + '%' : '0%';
    
    return { usage, rn, rate, extrusionUsage, calenderingUsage, tireBuildingUsage, extrusionScrap, calenderingScrap, tireBuildingScrap };
  }, [data]);

  const getMaterialData = useCallback((d: Date, materialName: string) => {
    const formattedDate = format(d, 'yyyy-MM-dd');
    const dayScraps = data?.scraps?.filter((s: any) => s.date === formattedDate && s.materialName === materialName) || [];
    
    if (dayScraps.length === 0) return null;

    const extrusionScrap = dayScraps.filter((s: any) => 
      (s.material === 'Extrusion Rubber' || s.material === 'RN') && 
      (s.section === 'Extrusion' || !s.section || s.section === 'Mixing')
    ).reduce((sum: number, s: any) => sum + (parseFloat(s.weight) || 0), 0);

    const calenderingScrap = dayScraps.filter((s: any) => 
      (s.material === 'Extrusion Rubber' || s.material === 'RN') && 
      (s.section === 'Calendering' || s.section === 'Cutting')
    ).reduce((sum: number, s: any) => sum + (parseFloat(s.weight) || 0), 0);

    const tireBuildingScrap = dayScraps.filter((s: any) => 
      (s.material === 'Rubber' || s.material === 'RN') && 
      s.section === 'Tire building'
    ).reduce((sum: number, s: any) => sum + (parseFloat(s.weight) || 0), 0);

    return extrusionScrap + calenderingScrap + tireBuildingScrap;
  }, [data]);

  const uniqueMaterials = useMemo(() => {
    if (!data?.scraps) return [];
    const materials = new Set<string>();
    data.scraps.forEach((s: any) => {
      if (s.materialName && (s.material === 'Extrusion Rubber' || s.material === 'RN' || (s.material === 'Rubber' && (s.section === 'Tire building' || s.section === 'Calendering' || s.section === 'Cutting')))) {
        materials.add(s.materialName);
      }
    });
    return Array.from(materials).sort();
  }, [data]);

  const chartData = useMemo(() => {
    if (!days.length) return [];
    const today = startOfDay(new Date());
    return days.map(d => {
      const dData = getTotalData(d);
      const rateVal = parseFloat(dData.rate);
      const isFuture = isAfter(startOfDay(d), today);
      
      return {
        date: format(d, 'MM/dd'),
        usage: isFuture ? null : (dData.usage || 0),
        rn: isFuture ? null : (dData.rn || 0),
        rate: isFuture ? null : (isNaN(rateVal) ? 0 : rateVal),
        target: isFuture ? null : (targets?.rn_rate?.value || 95)
      };
    });
  }, [days, getTotalData, targets]);

  const copyValuesOnly = useCallback(() => {
    if (!days.length) return;
    let rows = [];
    
    if (activeTab === 'shift') {
      const shifts = ['A', 'B', 'C', 'A1', 'C1'];
      shifts.forEach(shift => {
        rows.push(days.map(d => getShiftData(d, shift).usage).join('\t'));
        rows.push(days.map(d => getShiftData(d, shift).rn).join('\t'));
        rows.push(days.map(d => getShiftData(d, shift).rate).join('\t'));
      });
    } else {
      uniqueMaterials.forEach(mat => {
        rows.push(days.map(d => getMaterialData(d, mat)).join('\t'));
      });
    }
    
    rows.push(days.map(d => getTotalData(d).usage).join('\t'));
    rows.push(days.map(d => getTotalData(d).rn).join('\t'));
    rows.push(days.map(d => getTotalData(d).rate).join('\t'));

    navigator.clipboard.writeText(rows.join('\n')).then(() => {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    });
  }, [days, getShiftData, getTotalData, getMaterialData, activeTab, uniqueMaterials]);

  const copyAsPicture = useCallback(async () => {
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
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopiedImage(true);
      setTimeout(() => setCopiedImage(false), 2000);
    } catch (err) {
      console.error('Failed to copy table picture', err);
    }
  }, []);

  const [copiedChartImage, setCopiedChartImage] = useState(false);

  const copyChartsAsPicture = useCallback(async () => {
    if (!chartRef.current) return;
    try {
      // To capture full charts, we temporarily remove constraints
      const originalStyle = chartRef.current.getAttribute('style') || '';
      
      // Force height to auto and minimum width to ensure charts have space
      chartRef.current.style.width = '1200px'; 
      chartRef.current.style.height = 'auto';
      chartRef.current.style.overflow = 'visible';

      const blob = await toBlob(chartRef.current, { 
        backgroundColor: '#ffffff',
        pixelRatio: 2
      });

      // Restore styles
      chartRef.current.setAttribute('style', originalStyle);

      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopiedChartImage(true);
      setTimeout(() => setCopiedChartImage(false), 2000);
    } catch (err) {
      console.error('Failed to copy charts picture', err);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setControls(
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 font-bold">
                  <Eye className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">View</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="end">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm leading-none mb-3">Toggle Rows</h4>
                  <div className="max-h-[300px] overflow-y-auto space-y-1 pr-2">
                    {rowDefinitions.map(row => (
                      <label key={row.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                        <input 
                          type="checkbox" 
                          checked={!hiddenRows.includes(row.id)} 
                          onChange={() => toggleRowVisibility(row.id)}
                          className="rounded border-gray-300"
                        />
                        <span className="truncate">{row.title}</span>
                      </label>
                    ))}
                  </div>
                  {hiddenRows.length > 0 && (
                    <div className="pt-2 border-t mt-2">
                      <Button variant="ghost" size="sm" className="w-full text-xs" onClick={showAllRows}>
                        Show all rows
                      </Button>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm" onClick={copyValuesOnly} title="Copy values only" className="h-10 font-bold">
              {copiedText ? <Check className="h-4 w-4 mr-2 text-green-600" /> : <Copy className="h-4 w-4 mr-2" />}
              <span className="hidden sm:inline">Values</span>
            </Button>
            <Button variant="outline" size="sm" onClick={copyAsPicture} title="Copy table as picture" className="h-10 font-bold">
              {copiedImage ? <Check className="h-4 w-4 mr-2 text-green-600" /> : <ImageIcon className="h-4 w-4 mr-2" />}
              <span className="hidden sm:inline">Copy Table</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={loading} className="h-10 font-bold">
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              <span className="hidden sm:inline">Reload</span>
            </Button>
            <Button 
              variant={isEditingFont ? "default" : "outline"} 
              size="sm" 
              onClick={() => setIsEditingFont(!isEditingFont)} 
              className="h-10 font-bold"
            >
              <Type className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Font</span>
            </Button>
          </div>
        </div>
      );
    }, 100);
    return () => {
      clearTimeout(timer);
      setControls(null);
    };
  }, [loading, copiedText, copiedImage, isEditingFont, hiddenRows, toggleRowVisibility, showAllRows, copyValuesOnly, copyAsPicture, loadData, setControls]);

  const getFilteredScrapsForModal = () => {
    if (!detailModal) return [];
    const formattedDate = format(detailModal.date, 'yyyy-MM-dd');
    let dayScraps = data?.scraps?.filter((s: any) => s.date === formattedDate) || [];
    
    if (detailModal.shift) {
      dayScraps = dayScraps.filter((s: any) => s.shift === detailModal.shift);
    }

    if (detailModal.materialName) {
      dayScraps = dayScraps.filter((s: any) => s.materialName === detailModal.materialName);
    }

    return dayScraps.filter((s: any) => 
      s.material === 'Extrusion Rubber' || 
      s.material === 'RN' || 
      (s.material === 'Rubber' && s.section === 'Tire building')
    );
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

  const copyModalAsPicture = async (ref: React.RefObject<HTMLDivElement>, filename: string) => {
    if (!ref.current) return;
    try {
      const originalStyle = ref.current.getAttribute('style') || '';
      ref.current.style.width = 'max-content';
      ref.current.style.height = 'auto';
      ref.current.style.overflow = 'visible';

      const blob = await toBlob(ref.current, { 
        backgroundColor: '#ffffff',
        pixelRatio: 2
      });

      ref.current.setAttribute('style', originalStyle);

      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setModalCopied(true);
      setTimeout(() => setModalCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy modal picture', err);
    }
  };

  const RowHeader = ({ title, subtitle, rowId }: { title: string, subtitle: string, rowId: string }) => (
    <TableCell 
      className="border border-gray-300 font-medium leading-tight py-2 min-w-[150px] max-w-[250px] whitespace-normal relative group"
      style={{ fontSize: `${rowFontSizes[rowId] || 17}px` }}
    >
      <div className="text-sm pr-6" style={{ fontSize: 'inherit' }}>{title}</div>
      <div className="text-xs text-gray-500 mt-0.5 pr-6" style={{ fontSize: `${(rowFontSizes[rowId] || 17) * 0.8}px` }}>{subtitle}</div>
      
      <button 
        onClick={() => toggleRowVisibility(rowId)}
        className="absolute right-1 top-1 text-gray-400 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Hide row"
      >
        <EyeOff className="h-4 w-4" />
      </button>

      {isEditingFont && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col gap-1 bg-white/90 backdrop-blur-sm p-1 rounded border shadow-sm z-10">
          <button onClick={() => adjustFontSize(rowId, 1)} className="p-0.5 hover:bg-gray-100 rounded text-primary"><Plus className="h-3 w-3" /></button>
          <span className="text-[10px] text-center font-bold">{rowFontSizes[rowId] || 17}</span>
          <button onClick={() => adjustFontSize(rowId, -1)} className="p-0.5 hover:bg-gray-100 rounded text-primary"><Minus className="h-3 w-3" /></button>
        </div>
      )}
    </TableCell>
  );

  const renderCell = (d: Date, value: any, rowId: string, shift?: string, materialName?: string) => {
    const formattedDate = format(d, 'yyyy-MM-dd');
    const hasData = data?.summaries?.some((s: any) => s.date === formattedDate) || data?.scraps?.some((s: any) => s.date === formattedDate);
    
    let displayValue = '';
    if (hasData) {
      if (typeof value === 'number') {
        if (Math.abs(value) < 0.01) {
          displayValue = '';
        } else {
          displayValue = rowId.includes('rate') ? value.toFixed(1) : value.toFixed(0);
          if (displayValue === '0' || displayValue === '0.0') displayValue = '';
        }
      } else {
        displayValue = value || '';
        if (displayValue === '0' || displayValue === '0%' || displayValue === '0.0%') {
          displayValue = '';
        }
        if (rowId.includes('rate') && displayValue.includes('%')) {
          const numeric = parseFloat(displayValue);
          if (isNaN(numeric) || numeric < 0.01) displayValue = '';
          else displayValue = numeric.toFixed(1) + '%';
        }
      }
    }

    const isOverTarget = rowId.includes('rate') && hasData && targets?.rn_rate?.value > 0 && parseFloat(displayValue) > targets.rn_rate.value;

    return (
      <TableCell 
        key={d.toISOString()} 
        className={cn(
          "border border-gray-300 text-center transition-colors",
          hasData && "cursor-pointer hover:bg-black/5",
          isOverTarget && "text-red-600 font-bold"
        )}
        style={{ fontSize: `${rowFontSizes[rowId] || 17}px` }}
        onDoubleClick={() => {
          if (hasData) {
            setDetailModal({ date: d, shift, materialName });
          }
        }}
      >
        {displayValue}
      </TableCell>
    );
  };

  const renderSummaryCells = (values: any[], rowId: string) => {
    const numericValues = values
      .map(v => (typeof v === 'number' ? v : parseFloat(v)))
      .filter(v => v !== null && v !== undefined && !isNaN(v));
    
    const sum = numericValues.reduce((acc, v) => acc + v, 0);
    const avg = numericValues.length > 0 ? sum / numericValues.length : 0;

    const isRate = rowId.includes('rate');
    const displaySum = sum.toFixed(0);
    const displayAvg = isRate ? avg.toFixed(1) + '%' : avg.toFixed(0);
    const isOverTarget = isRate && targets?.rn_rate?.value > 0 && avg > targets.rn_rate.value;

    if (isRate) {
      return (
        <TableCell colSpan={2} className={cn("border border-gray-300 text-center font-bold bg-gray-50", isOverTarget && "text-red-600")} style={{ fontSize: `${rowFontSizes[rowId] || 17}px` }}>
          {displayAvg}
        </TableCell>
      );
    }

    return (
      <>
        <TableCell className="border border-gray-300 text-center font-bold bg-gray-50" style={{ fontSize: `${rowFontSizes[rowId] || 17}px` }}>
          {displaySum}
        </TableCell>
        <TableCell className="border border-gray-300 text-center font-bold bg-gray-50" style={{ fontSize: `${rowFontSizes[rowId] || 17}px` }}>
          {displayAvg}
        </TableCell>
      </>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div ref={tableRef} className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
            <div className="flex-1 flex gap-2">
              <Button 
                variant={activeTab === 'shift' ? "default" : "outline"} 
                size="sm" 
                onClick={() => setActiveTab('shift')}
                className="font-bold"
              >
                Shift-wise
              </Button>
              <Button 
                variant={activeTab === 'material' ? "default" : "outline"} 
                size="sm" 
                onClick={() => setActiveTab('material')}
                className="font-bold"
              >
                Material-wise
              </Button>
            </div>
            <CardTitle className="text-2xl text-center flex-1 whitespace-nowrap">2026 RN Generation Details Report</CardTitle>
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
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <div className="p-4">
              <Table className="border-collapse border border-gray-300 w-full min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="border border-gray-300 bg-gray-50 font-semibold text-center min-w-[150px]">
                      Date 日期
                    </TableHead>
                    {days.map((d, i) => (
                      <TableHead key={i} className="border border-gray-300 bg-gray-50 font-semibold text-center min-w-[80px] text-lg">
                        {format(d, 'M-d')}
                      </TableHead>
                    ))}
                    <TableHead className="border border-gray-300 bg-blue-50 font-bold text-center min-w-[100px]">
                      TOTAL SUM
                    </TableHead>
                    <TableHead className="border border-gray-300 bg-blue-50 font-bold text-center min-w-[100px]">
                      AVERAGE
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeTab === 'shift' ? (
                    ['A', 'B', 'C', 'A1', 'C1'].map(shift => (
                      <React.Fragment key={shift}>
                        {!hiddenRows.includes(`rn_${shift}_usage`) && (
                          <TableRow>
                            <RowHeader title={`Shift ${shift} Usage (kg)`} subtitle={`班次 ${shift} 擠出使用重量`} rowId={`rn_${shift}_usage`} />
                            {days.map(d => renderCell(d, getShiftData(d, shift).usage, `rn_${shift}_usage`, shift))}
                            {renderSummaryCells(days.map(d => getShiftData(d, shift).usage), `rn_${shift}_usage`)}
                          </TableRow>
                        )}
                        {!hiddenRows.includes(`rn_${shift}_scrap`) && (
                          <TableRow>
                            <RowHeader title={`Shift ${shift} RN (kg)`} subtitle={`班次 ${shift} RN產生重量`} rowId={`rn_${shift}_scrap`} />
                            {days.map(d => renderCell(d, getShiftData(d, shift).rn, `rn_${shift}_scrap`, shift))}
                            {renderSummaryCells(days.map(d => getShiftData(d, shift).rn), `rn_${shift}_scrap`)}
                          </TableRow>
                        )}
                        {!hiddenRows.includes(`rn_${shift}_rate`) && (
                          <TableRow className="bg-[#e2f0d9]">
                            <RowHeader title={`Shift ${shift} Rate (%)`} subtitle={`班次 ${shift} 回收率`} rowId={`rn_${shift}_rate`} />
                            {days.map(d => renderCell(d, getShiftData(d, shift).rate, `rn_${shift}_rate`, shift))}
                            {renderSummaryCells(days.map(d => getShiftData(d, shift).rate), `rn_${shift}_rate`)}
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))
                  ) : (
                    uniqueMaterials.map(mat => (
                      <TableRow key={mat}>
                        <RowHeader title={mat} subtitle="膠料類型" rowId={`rn_mat_${mat}`} />
                        {days.map(d => renderCell(d, getMaterialData(d, mat), `rn_mat_${mat}`, undefined, mat))}
                        {renderSummaryCells(days.map(d => getMaterialData(d, mat)), `rn_mat_${mat}`)}
                      </TableRow>
                    ))
                  )}
                  {!hiddenRows.includes("rn_total_usage") && (
                    <TableRow className="bg-gray-100 font-bold">
                      <RowHeader title="TOTAL Usage (kg)" subtitle="總計擠出使用重量" rowId="rn_total_usage" />
                      {days.map(d => renderCell(d, getTotalData(d).usage, "rn_total_usage"))}
                      {renderSummaryCells(days.map(d => getTotalData(d).usage), "rn_total_usage")}
                    </TableRow>
                  )}
                  {!hiddenRows.includes("rn_total_scrap") && (
                    <TableRow className="bg-gray-100 font-bold">
                      <RowHeader title="TOTAL RN (kg)" subtitle="總RN產生重量" rowId="rn_total_scrap" />
                      {days.map(d => renderCell(d, getTotalData(d).rn, "rn_total_scrap"))}
                      {renderSummaryCells(days.map(d => getTotalData(d).rn), "rn_total_scrap")}
                    </TableRow>
                  )}
                  {!hiddenRows.includes("rn_total_rate") && (
                    <TableRow className="bg-[#ddebf7] font-bold">
                      <RowHeader title="TOTAL Rate (%)" subtitle="總回收率" rowId="rn_total_rate" />
                      {days.map(d => renderCell(d, getTotalData(d).rate, "rn_total_rate"))}
                      {renderSummaryCells(days.map(d => getTotalData(d).rate), "rn_total_rate")}
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </div>
      </Card>

      <div className="relative">
        <div className="absolute top-0 right-0 z-10 flex gap-2">
          <Button variant="outline" size="sm" onClick={copyChartsAsPicture} title="Copy charts as picture" className="font-bold">
            {copiedChartImage ? <Check className="h-4 w-4 mr-2 text-green-600" /> : <ImageIcon className="h-4 w-4 mr-2" />}
            <span className="hidden sm:inline">Copy Charts</span>
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-6 pt-10" ref={chartRef}>
          <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Total Usage & RN (kg)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 25 }} barCategoryGap="25%" barGap={8}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 14 }} />
                  <YAxis tick={{ fontSize: 14 }} />
                  <Tooltip formatter={(v: number) => [`${v.toFixed(0)} kg`, '']} />
                  <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '20px', fontSize: '14px' }} />
                  <Bar dataKey="usage" name="Usage (kg)" fill="#2563eb" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="usage" position="top" formatter={(v: number) => v.toFixed(0)} style={{ fontSize: '14px', fill: '#2563eb', fontWeight: 'bold' }} />
                  </Bar>
                  <Bar dataKey="rn" name="RN (kg)" fill="#dc2626" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="rn" position="top" formatter={(v: number) => v.toFixed(0)} style={{ fontSize: '14px', fill: '#dc2626', fontWeight: 'bold' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Total RN Rate (%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 14 }} />
                  <YAxis 
                    unit="%" 
                    domain={['dataMin - 1', 'dataMax + 1']} 
                    tick={{ fontSize: 14 }} 
                    tickFormatter={(v) => Math.round(v).toString()}
                  />
                  <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, 'Rate']} />
                  <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '20px', fontSize: '14px' }} />
                  <Line type="monotone" dataKey="rate" name="RN Rate" stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }}>
                    <LabelList dataKey="rate" position="top" formatter={(v: number) => v.toFixed(1) + '%'} style={{ fontSize: '14px', fill: '#16a34a', fontWeight: 'bold' }} />
                  </Line>
                  <Line type="stepAfter" dataKey="target" name="Target" stroke="#000000" strokeDasharray="5 5" strokeWidth={1} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>

      {detailModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-2 md:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-[95vw] max-w-[95vw] h-[95vh] max-h-[95vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-4 flex-1">
                <h2 className="text-lg font-semibold flex-1">
                  RN Generation Details - {format(detailModal.date, 'PPP')} 
                  {detailModal.shift && <span className="ml-2 text-primary">(Shift {detailModal.shift})</span>}
                </h2>
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 text-primary px-3 py-1 rounded-full font-bold text-sm">
                    Total RN: {getFilteredScrapsForModal().reduce((sum, s: any) => sum + Number(s.weight || 0), 0).toFixed(1)} kg
                  </div>
                  <Button variant="outline" size="sm" onClick={() => copyModalAsPicture(scrapModalRef, `RN_Details_${format(detailModal.date, 'yyyyMMdd')}`)}>
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
              <div className="mb-8">
                <h3 className="text-md font-bold mb-3 px-1">Usage & RN Summary</h3>
                <Table className="border mb-6">
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-bold border">Shift</TableHead>
                      <TableHead className="font-bold border text-center">Extrusion Usage (kg)</TableHead>
                      <TableHead className="font-bold border text-center">Extrusion RN (kg)</TableHead>
                      <TableHead className="font-bold border text-center">Calendering RN (kg)</TableHead>
                      <TableHead className="font-bold border text-center">Tire Building RN (kg)</TableHead>
                      <TableHead className="font-bold border text-center">RN Rate (%)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detailModal.shift ? [detailModal.shift] : ['A', 'B', 'C', 'A1', 'C1']).map((shift) => {
                      const s = getShiftData(detailModal.date, shift);
                      return (
                        <TableRow key={shift}>
                          <TableCell className="font-bold border">{shift}</TableCell>
                          <TableCell className="text-center border">{s.extrusionUsage.toFixed(0)}</TableCell>
                          <TableCell className="text-center border">{s.extrusionScrap.toFixed(1)}</TableCell>
                          <TableCell className="text-center border">{s.calenderingScrap.toFixed(1)}</TableCell>
                          <TableCell className="text-center border">{s.tireBuildingScrap.toFixed(1)}</TableCell>
                          <TableCell className="text-center border font-medium">{s.rate}</TableCell>
                        </TableRow>
                      );
                    })}
                    {!detailModal.shift && (
                      <TableRow className="bg-gray-100 font-bold">
                        <TableCell className="border">TOTAL</TableCell>
                        {(() => {
                          const s = getTotalData(detailModal.date);
                          return (
                            <>
                              <TableCell className="text-center border">{s.extrusionUsage.toFixed(0)}</TableCell>
                              <TableCell className="text-center border">{s.extrusionScrap.toFixed(1)}</TableCell>
                              <TableCell className="text-center border">{s.calenderingScrap.toFixed(1)}</TableCell>
                              <TableCell className="text-center border">{s.tireBuildingScrap.toFixed(1)}</TableCell>
                              <TableCell className="text-center border text-primary">{s.rate}</TableCell>
                            </>
                          );
                        })()}
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <h3 className="text-md font-bold mb-3 px-1">Detailed RN Records</h3>
              {getFilteredScrapsForModal().length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No RN records found for this selection.
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
                        <TableCell className={cn(highlightedCols.includes(6) && "bg-yellow-50")}>{scrap.mainReason || '-'}</TableCell>
                        <TableCell className={cn(highlightedCols.includes(7) && "bg-yellow-50")}>{scrap.reason}</TableCell>
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
    </div>
  );
}
