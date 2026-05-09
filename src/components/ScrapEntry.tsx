import React, { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Loader2, Upload, X, Save, Package, Tag, Clock, Factory, Scale, AlertCircle, FileText, Camera } from 'lucide-react';
import { Calendar } from '@/src/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { saveScrapDetails } from '@/src/lib/api';
import { cn } from '@/src/lib/utils';
import { useData } from '@/src/lib/DataContext';

export function ScrapEntry() {
  const [date, setDate] = useState<Date>(new Date());
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { loadData } = useData();
  
  const [formData, setFormData] = useState({
    material: '',
    materialName: '',
    weight: '',
    reason: '',
    mainReason: '',
    shift: '',
    section: '',
    customSection: ''
  });
  
  const [image, setImage] = useState<{ base64: string, mimeType: string } | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setImagePreview(base64String);
      setImage({
        base64: base64String,
        mimeType: file.type
      });
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.material) {
      setMessage('Error: Please select a material type');
      return;
    }
    if (!formData.materialName) {
      setMessage('Error: Please enter the material name');
      return;
    }
    if (!formData.mainReason) {
      setMessage('Error: Please select a main reason');
      return;
    }
    if (!formData.shift) {
      setMessage('Error: Please select a shift');
      return;
    }
    if (!formData.section) {
      setMessage('Error: Please select a section');
      return;
    }
    if (formData.section === 'Manual' && !formData.customSection) {
      setMessage('Error: Please enter the custom section name');
      return;
    }
    
    setLoading(true);
    setMessage('');
    
    try {
      await saveScrapDetails({
        date: format(date, 'yyyy-MM-dd'),
        timestamp: new Date().toISOString(),
        material: formData.material,
        materialName: formData.materialName,
        weight: formData.weight || 0,
        reason: formData.reason,
        mainReason: formData.mainReason,
        shift: formData.shift,
        section: formData.section === 'Manual' ? formData.customSection : formData.section,
        imageBase64: image?.base64,
        imageMimeType: image?.mimeType
      });
      
      setMessage('Scrap data saved successfully!');
      loadData(true);
      setFormData({ material: '', materialName: '', weight: '', reason: '', mainReason: '', shift: '', section: '', customSection: '' });
      clearImage();
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
        <div className="flex-1" />
        <CardTitle className="text-2xl text-center flex-1 whitespace-nowrap">Scrap Entry</CardTitle>
        <div className="flex items-center gap-2 flex-1 justify-end">
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
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6 pt-4">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Package className="h-4 w-4 text-primary" />
                Material Type
              </Label>
              <Select value={formData.material} onValueChange={(v) => handleSelectChange('material', v)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BIC">BIC (鋼絲)</SelectItem>
                  <SelectItem value="PLY">PLY (簾紗)</SelectItem>
                  <SelectItem value="Rubber">Rubber (膠料)</SelectItem>
                  <SelectItem value="RN">RN Generation</SelectItem>
                  <SelectItem value="Chafer">Chafer (防擦布)</SelectItem>
                  <SelectItem value="Fabric">Fabric</SelectItem>
                  <SelectItem value="Carbon">Carbon</SelectItem>
                  <SelectItem value="Chemical">Chemical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-semibold" htmlFor="materialName">
                <Tag className="h-4 w-4 text-primary" />
                Material Name / Code
              </Label>
              <Input 
                id="materialName" 
                name="materialName" 
                required
                value={formData.materialName} 
                onChange={handleChange} 
                placeholder="Enter name or code"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Clock className="h-4 w-4 text-primary" />
                Shift
              </Label>
              <Select value={formData.shift} onValueChange={(v) => handleSelectChange('shift', v)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select shift" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                  <SelectItem value="C">C</SelectItem>
                  <SelectItem value="A1">A1</SelectItem>
                  <SelectItem value="C1">C1</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Factory className="h-4 w-4 text-primary" />
                Section
              </Label>
              <Select value={formData.section} onValueChange={(v) => handleSelectChange('section', v)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mixing">Mixing</SelectItem>
                  <SelectItem value="Extrusion">Extrusion</SelectItem>
                  <SelectItem value="Calendering">Calendering</SelectItem>
                  <SelectItem value="Cutting">Cutting</SelectItem>
                  <SelectItem value="Tire building">Tire building</SelectItem>
                  <SelectItem value="Curing">Curing</SelectItem>
                  <SelectItem value="Manual">Manual key in</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.section === 'Manual' && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="customSection" className="font-semibold">Custom Section Name</Label>
                <Input 
                  id="customSection" 
                  name="customSection" 
                  required
                  value={formData.customSection} 
                  onChange={handleChange} 
                  placeholder="Enter section name"
                  className="h-11"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-semibold" htmlFor="weight">
                <Scale className="h-4 w-4 text-primary" />
                Scrap Weight (kg)
              </Label>
              <Input 
                id="weight" 
                name="weight" 
                type="number" 
                step="0.01" 
                required
                value={formData.weight} 
                onChange={handleChange} 
                placeholder="0.00"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <AlertCircle className="h-4 w-4 text-primary" />
                Main Reason
              </Label>
              <Select value={formData.mainReason} onValueChange={(v) => handleSelectChange('mainReason', v)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Die Rubber">Die Rubber</SelectItem>
                  <SelectItem value="Machine NG">Machine NG</SelectItem>
                  <SelectItem value="Human Error">Human Error</SelectItem>
                  <SelectItem value="Process scrap">Process scrap</SelectItem>
                  <SelectItem value="Spec finish">Spec finish</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label className="flex items-center gap-2 text-sm font-semibold" htmlFor="reason">
                <FileText className="h-4 w-4 text-primary" />
                Reason for Scrap (Details)
              </Label>
              <Input 
                id="reason" 
                name="reason" 
                required
                value={formData.reason} 
                onChange={handleChange} 
                placeholder="Provide more specific details..."
                className="h-11"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Scrap Picture Preview</Label>
            <div className="flex items-center gap-4">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageChange} 
                accept="image/*" 
                className="hidden" 
              />
              {imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="Preview" className="size-20 object-cover rounded-md border" />
                  <button 
                    type="button" 
                    onClick={clearImage}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="size-20 border-2 border-dashed border-gray-200 rounded-md flex items-center justify-center text-gray-400 text-xs text-center p-2">
                  No image selected
                </div>
              )}
            </div>
          </div>

          {message && (
            <div className={cn("text-sm font-medium p-3 rounded-md", message.includes('Error') ? "bg-red-50 text-red-500" : "bg-green-50 text-green-600")}>
              {message}
            </div>
          )}
          
          <div className="pt-4 flex flex-row flex-nowrap justify-center gap-2 sm:gap-4">
            <Button 
              type="button" 
              variant="outline" 
              size="square-lg" 
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 h-20 sm:h-24"
            >
              <Upload className="h-4 w-4 sm:h-6 sm:w-6" />
              <span className="text-[10px] sm:text-sm">Upload Picture</span>
            </Button>

            <Button type="submit" disabled={loading} size="square-lg" className="flex-1 h-20 sm:h-24">
              {loading ? <Loader2 className="h-4 w-4 sm:h-6 sm:w-6 animate-spin" /> : <Save className="h-4 w-4 sm:h-6 sm:w-6" />}
              <span className="text-[10px] sm:text-sm">{loading ? 'Saving...' : 'Save Scrap'}</span>
            </Button>
          </div>
        </CardContent>
      </form>
    </Card>
  );
}
