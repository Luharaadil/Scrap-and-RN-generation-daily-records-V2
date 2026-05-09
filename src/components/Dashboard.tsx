import React, { useState, useEffect, useRef } from 'react';
import { format, subDays } from 'date-fns';
import { Calendar as CalendarIcon, Loader2, RefreshCw, ImageIcon, Check, Edit2, Save, X } from 'lucide-react';
import { Calendar } from '@/src/components/ui/calendar';
import { toBlob } from 'html-to-image';
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { getWebAppUrl } from '@/src/lib/api';
import { cn } from '@/src/lib/utils';
import { useData } from '@/src/lib/DataContext';

export function Dashboard() {
  const { 
    data, loading, error, loadData, updateScrapReasonInSheet,
    globalShift: shiftFilter, setGlobalShift: setShiftFilter,
    globalSection: sectionFilter, setGlobalSection: setSectionFilter
  } = useData();
  
  const [date, setDate] = useState<Date>(subDays(new Date(), 1));

  const [materialFilter, setMaterialFilter] = useState('All');
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedScrap, setCopiedScrap] = useState(false);
  
  const [editingScrap, setEditingScrap] = useState<string | null>(null);
  const [editReason, setEditReason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  
  const summaryRef = useRef<HTMLDivElement>(null);
  const scrapTableRef = useRef<HTMLDivElement>(null);

  const copyAsPicture = async (ref: React.RefObject<HTMLDivElement>, setCopied: (v: boolean) => void) => {
    if (!ref.current) return;
    try {
      // Temporarily remove constraints for full capture
      const originalStyle = ref.current.getAttribute('style') || '';
      const originalParentStyle = ref.current.parentElement?.getAttribute('style') || '';
      
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
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy picture', err);
    }
  };

  const rawSummary = data?.summaries?.filter((s: any) => {
    if (s.date !== format(date, 'yyyy-MM-dd')) return false;
    if (shiftFilter !== 'All' && s.shift !== shiftFilter) return false;
    return true;
  }) || [];
  
  const scraps = data?.scraps?.filter((s: any) => {
    if (s.date !== format(date, 'yyyy-MM-dd')) return false;
    if (shiftFilter !== 'All' && s.shift !== shiftFilter) return false;
    return true;
  }) || [];
  
  // A day has data if it has scraps OR if any summary field is non-zero
  const hasAnySummaryValue = rawSummary.some((s: any) => 
    Number(s.bicUsage || 0) > 0 || 
    Number(s.plyUsage || 0) > 0 || 
    Number(s.mixingRubberUsage || 0) > 0 || 
    Number(s.rubberUsage || 0) > 0 || 
    Number(s.extrusionRubberUsage || 0) > 0 ||
    Number(s.chaferUsage || 0) > 0
  );
  const hasData = scraps.length > 0 || hasAnySummaryValue;

  const summary = rawSummary.reduce((acc: any, curr: any) => ({
    bicUsage: (acc.bicUsage || 0) + Number(curr.bicUsage || 0),
    bicScrap: (acc.bicScrap || 0) + Number(curr.bicScrap || 0),
    plyUsage: (acc.plyUsage || 0) + Number(curr.plyUsage || 0),
    plyScrap: (acc.plyScrap || 0) + Number(curr.plyScrap || 0),
    rubberUsage: (acc.rubberUsage || 0) + (Number(curr.mixingRubberUsage || 0) || Number(curr.rubberUsage || 0)),
    rubberScrap: (acc.rubberScrap || 0) + Number(curr.rubberScrap || 0),
    rnScrap: (acc.rnScrap || 0) + Number(curr.rnScrap || 0),
    chaferUsage: (acc.chaferUsage || 0) + Number(curr.chaferUsage || 0),
    chaferScrap: (acc.chaferScrap || 0) + Number(curr.chaferScrap || 0),
    extrusionRubberUsage: (acc.extrusionRubberUsage || 0) + Number(curr.extrusionRubberUsage || 0)
  }), {
    bicUsage: 0, bicScrap: 0, plyUsage: 0, plyScrap: 0, rubberUsage: 0, rubberScrap: 0, rnScrap: 0, chaferUsage: 0, chaferScrap: 0, extrusionRubberUsage: 0
  });
  
  const filteredScraps = scraps.filter((scrap: any) => {
    if (sectionFilter !== 'All' && scrap.section !== sectionFilter) return false;
    if (materialFilter !== 'All' && scrap.material !== materialFilter) return false;
    return true;
  });

  const getSectionScrapTotal = (material: string, section: string) => {
    return filteredScraps
      .filter((s: any) => s.material === material && s.section === section)
      .reduce((sum: number, s: any) => sum + Number(s.weight || 0), 0);
  };

  const getScrapTotal = (material: string) => {
    return filteredScraps
      .filter((s: any) => s.material === material)
      .reduce((sum: number, s: any) => sum + Number(s.weight || 0), 0);
  };

  const getMaterialSections = (material: string) => {
    const sections = new Set<string>();
    filteredScraps.forEach((s: any) => {
      if (s.material === material && Number(s.weight || 0) > 0 && s.section) {
        sections.add(s.section);
      }
    });
    return Array.from(sections).sort();
  };

  const getRnScraps = () => {
    return filteredScraps.filter((s: any) => 
      s.material === 'RN' || 
      s.material === 'Extrusion Rubber' || 
      (s.material === 'Rubber' && s.section === 'Tire building')
    );
  };

  const displayRnScrap = getRnScraps().reduce((sum: number, s: any) => sum + Number(s.weight || 0), 0);

  const getRnSections = () => {
    const sections = new Set<string>();
    getRnScraps().forEach((s: any) => {
      if (Number(s.weight || 0) > 0) {
        sections.add(s.section || 'Unspecified');
      }
    });
    return Array.from(sections).sort();
  };

  const getRnSectionTotal = (section: string) => {
    return getRnScraps()
      .filter((s: any) => (s.section || 'Unspecified') === section)
      .reduce((sum: number, s: any) => sum + Number(s.weight || 0), 0);
  };

  const displayBicScrap = getScrapTotal('BIC');

  const getPlyScraps = () => {
    return filteredScraps.filter((s: any) => 
      (s.material === 'PLY' || s.material === 'Chafer') &&
      (s.section === 'Calendering' || s.section === 'Cutting')
    );
  };

  const getPlyTotal = () => getPlyScraps().reduce((sum: number, s: any) => sum + Number(s.weight || 0), 0);

  const getPlySections = () => {
    const sections = new Set<string>();
    getPlyScraps().forEach((s: any) => {
      if (Number(s.weight || 0) > 0 && s.section) {
        sections.add(s.section);
      }
    });
    return Array.from(sections).sort();
  };

  const getPlySectionTotal = (section: string) => {
    return getPlyScraps()
      .filter((s: any) => s.section === section)
      .reduce((sum: number, s: any) => sum + Number(s.weight || 0), 0);
  };

  const displayPlyScrap = getPlyTotal();
  const displayRubberScrap = getScrapTotal('Rubber');

  const calculateRate = (scrap: number, usage: number) => {
    if (!usage || usage === 0) return null;
    if (!scrap || scrap === 0) return 0;
    return ((Number(scrap) / Number(usage)) * 100).toFixed(3) + '%';
  };

  const formatValue = (val: any, unit: string = '') => {
    if (!hasData) return '';
    if (val === null || val === undefined || val === '') return '';
    const num = Number(val);
    if (num === 0) return '0';
    return num.toFixed(1) + (unit ? ` ${unit}` : '');
  };

  const formatToIST = (timestamp: string) => {
    if (!timestamp || timestamp === '-') return '-';
    try {
      // Check if it's already an ISO string or a valid date string
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
      
      // Fallback for old format dd-MM-yyyy HH:mm:ss
      // We'll just return it as is if it doesn't look like an ISO string
      return timestamp;
    } catch (e) {
      return timestamp;
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-white p-4 rounded-lg border shadow-sm">
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={shiftFilter} onValueChange={setShiftFilter}>
            <SelectTrigger className="w-[140px] text-base">
              <SelectValue placeholder="Shift" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All" className="text-base">All Shifts</SelectItem>
              <SelectItem value="A" className="text-base">A</SelectItem>
              <SelectItem value="B" className="text-base">B</SelectItem>
              <SelectItem value="C" className="text-base">C</SelectItem>
              <SelectItem value="A1" className="text-base">A1</SelectItem>
              <SelectItem value="C1" className="text-base">C1</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sectionFilter} onValueChange={setSectionFilter}>
            <SelectTrigger className="w-[160px] text-base">
              <SelectValue placeholder="Section" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All" className="text-base">All Sections</SelectItem>
              <SelectItem value="Mixing" className="text-base">Mixing</SelectItem>
              <SelectItem value="Extrusion" className="text-base">Extrusion</SelectItem>
              <SelectItem value="Calendering" className="text-base">Calendering</SelectItem>
              <SelectItem value="Cutting" className="text-base">Cutting</SelectItem>
              <SelectItem value="Tire building" className="text-base">Tire building</SelectItem>
              <SelectItem value="Curing" className="text-base">Curing</SelectItem>
            </SelectContent>
          </Select>

          <Select value={materialFilter} onValueChange={setMaterialFilter}>
            <SelectTrigger className="w-[160px] text-base">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All" className="text-base">All Types</SelectItem>
              <SelectItem value="BIC" className="text-base">BIC (鋼絲)</SelectItem>
              <SelectItem value="PLY" className="text-base">PLY (簾紗)</SelectItem>
              <SelectItem value="Rubber" className="text-base">Rubber (膠料)</SelectItem>
              <SelectItem value="RN" className="text-base">RN Generation</SelectItem>
              <SelectItem value="Chafer" className="text-base">Chafer (防擦布)</SelectItem>
              <SelectItem value="Fabric" className="text-base">Fabric</SelectItem>
              <SelectItem value="Carbon" className="text-base">Carbon</SelectItem>
              <SelectItem value="Chemical" className="text-base">Chemical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => copyAsPicture(summaryRef, setCopiedSummary)} className="h-10 font-bold">
            {copiedSummary ? <Check className="h-4 w-4 sm:mr-2 text-green-600" /> : <ImageIcon className="h-4 w-4 sm:mr-2" />}
            <span className="hidden sm:inline">{copiedSummary ? 'Copied!' : 'Copy Summary Image'}</span>
            {!copiedSummary && <span className="sm:hidden">Summary</span>}
            {copiedSummary && <span className="sm:hidden">Copied</span>}
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-[240px] justify-start text-left font-normal h-10 font-bold",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" onClick={() => loadData(true)} disabled={loading} className="h-10 w-10">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-red-500 text-sm font-medium">{error}</div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" ref={summaryRef}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">BIC (鋼絲)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-base">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Usage:</span>
                <span className="font-medium text-lg">{formatValue(summary.bicUsage, 'kg')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Scrap:</span>
                <span className="font-medium text-red-600 text-lg">{formatValue(displayBicScrap, 'kg')}</span>
              </div>
              <div className="flex justify-between border-t pt-1 mt-1 items-center">
                <span className="text-muted-foreground text-sm">Scrap Rate:</span>
                <span className="font-bold text-lg">{hasData ? (calculateRate(displayBicScrap, summary.bicUsage) ?? '0') : ''}</span>
              </div>
              {hasData && (
                <div className="mt-2 pt-2 border-t border-dashed text-sm space-y-1">
                  {getMaterialSections('BIC').map(section => (
                    <div key={section} className="flex justify-between text-gray-500">
                      <span className="text-base">{section}:</span>
                      <span className="text-base">{getSectionScrapTotal('BIC', section).toFixed(1)} kg</span>
                    </div>
                  ))}
                  {getMaterialSections('BIC').length === 0 && (
                    <div className="text-center text-gray-400 italic">No section data</div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">PLY (簾紗)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-base">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Usage:</span>
                <span className="font-medium text-lg">{formatValue(summary.plyUsage, 'kg')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Scrap:</span>
                <span className="font-medium text-red-600 text-lg">{formatValue(displayPlyScrap, 'kg')}</span>
              </div>
              <div className="flex justify-between border-t pt-1 mt-1 items-center">
                <span className="text-muted-foreground text-sm">Scrap Rate:</span>
                <span className="font-bold text-lg">{hasData ? (calculateRate(displayPlyScrap, summary.plyUsage) ?? '0') : ''}</span>
              </div>
              {hasData && (
                <div className="mt-2 pt-2 border-t border-dashed text-sm space-y-1">
                  {getPlySections().map(section => (
                    <div key={section} className="flex justify-between text-gray-500">
                      <span className="text-base">{section}:</span>
                      <span className="text-base">{getPlySectionTotal(section).toFixed(1)} kg</span>
                    </div>
                  ))}
                  {getPlySections().length === 0 && (
                    <div className="text-center text-gray-400 italic">No section data</div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">Rubber (膠料)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-base">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Usage:</span>
                <span className="font-medium text-lg">{formatValue(summary.rubberUsage, 'kg')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Scrap:</span>
                <span className="font-medium text-red-600 text-lg">{formatValue(displayRubberScrap, 'kg')}</span>
              </div>
              <div className="flex justify-between border-t pt-1 mt-1 items-center">
                <span className="text-muted-foreground text-sm">Scrap Rate:</span>
                <span className="font-bold text-lg">{hasData ? (calculateRate(displayRubberScrap, summary.rubberUsage) ?? '0') : ''}</span>
              </div>
              {hasData && (
                <div className="mt-2 pt-2 border-t border-dashed text-sm space-y-1">
                  {getMaterialSections('Rubber').map(section => (
                    <div key={section} className="flex justify-between text-gray-500">
                      <span className="text-base">{section}:</span>
                      <span className="text-base">{getSectionScrapTotal('Rubber', section).toFixed(1)} kg</span>
                    </div>
                  ))}
                  {getMaterialSections('Rubber').length === 0 && (
                    <div className="text-center text-gray-400 italic">No section data</div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">RN Generation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-base">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Rubber Usage:</span>
                <span className="font-medium text-lg">{formatValue(summary.extrusionRubberUsage, 'kg')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">RN Scrap:</span>
                <span className="font-medium text-red-600 text-lg">{formatValue(displayRnScrap, 'kg')}</span>
              </div>
              <div className="flex justify-between border-t pt-1 mt-1 items-center">
                <span className="text-muted-foreground text-sm">Scrap Rate:</span>
                <span className="font-bold text-lg">{hasData ? (calculateRate(displayRnScrap, summary.extrusionRubberUsage) ?? '0') : ''}</span>
              </div>
              {hasData && (
                <div className="mt-2 pt-2 border-t border-dashed text-sm space-y-1">
                  {getRnSections().map(section => (
                    <div key={section} className="flex justify-between text-gray-500">
                      <span className="text-base">{section}:</span>
                      <span className="text-base">{getRnSectionTotal(section).toFixed(1)} kg</span>
                    </div>
                  ))}
                  {getRnSections().length === 0 && (
                    <div className="text-center text-gray-400 italic">No section data</div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
          <div>
            <CardTitle>Scrap Details</CardTitle>
            <CardDescription>Detailed list of scrap recorded for {format(date, 'PPP')}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => copyAsPicture(scrapTableRef, setCopiedScrap)} className="h-9 font-bold">
            {copiedScrap ? <Check className="h-4 w-4 sm:mr-2 text-green-600" /> : <ImageIcon className="h-4 w-4 sm:mr-2" />}
            <span className="hidden sm:inline">{copiedScrap ? 'Copied!' : 'Copy Scrap Image'}</span>
            {!copiedScrap && <span className="sm:hidden">Scrap</span>}
            {copiedScrap && <span className="sm:hidden">Copied</span>}
          </Button>
        </CardHeader>
        <CardContent ref={scrapTableRef}>
          {filteredScraps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No scrap records found matching the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Material Type</TableHead>
                    <TableHead>Material Name</TableHead>
                    <TableHead>Weight (kg)</TableHead>
                    <TableHead>Main Reason</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Picture</TableHead>
                    <TableHead>Recorded At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredScraps.map((scrap: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap">{scrap.date}</TableCell>
                      <TableCell>{scrap.shift}</TableCell>
                      <TableCell>{scrap.section}</TableCell>
                      <TableCell className="font-medium">{scrap.material}</TableCell>
                      <TableCell>{scrap.materialName || '-'}</TableCell>
                      <TableCell>{typeof scrap.weight === 'number' ? (scrap.weight === 0 ? '0' : scrap.weight.toFixed(1)) : (scrap.weight || '0')}</TableCell>
                      <TableCell>{scrap.mainReason || '-'}</TableCell>
                      <TableCell>
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
                      <TableCell>
                        {scrap.imageUrl ? (
                          <a href={scrap.imageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            View Image
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-sm">No image</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{formatToIST(scrap.timestamp || scrap.time || '-')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
