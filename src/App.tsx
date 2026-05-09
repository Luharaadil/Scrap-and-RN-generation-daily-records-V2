import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { Dashboard } from '@/src/components/Dashboard';
import { ProductionEntry } from '@/src/components/ProductionEntry';
import { ScrapEntry } from '@/src/components/ScrapEntry';
import { MainReport } from '@/src/components/MainReport';
import { RNReport } from '@/src/components/RNReport';
import { Button } from '@/src/components/ui/button';
import { LayoutDashboard, FileText, PlusCircle, AlertCircle, Menu } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { SidebarProvider, useSidebar } from '@/src/lib/SidebarContext';
import { DataProvider } from '@/src/lib/DataContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover';

function AppContent() {
  const { controls } = useSidebar();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Tabs defaultValue="main" className="flex-1 flex flex-col">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
          <div className="max-w-[1600px] mx-auto px-4 h-20 flex items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <h1 className="font-bold tracking-tight text-gray-900 text-xl whitespace-nowrap">
                MRI Tracker
              </h1>
              
              <TabsList className="hidden md:flex bg-transparent h-auto p-0 gap-1">
                <TabsTrigger 
                  value="main" 
                  className="flex items-center gap-2 px-4 py-2 rounded-md transition-all font-bold data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  <FileText className="h-4 w-4" />
                  <span>Main Report</span>
                </TabsTrigger>
                
                <TabsTrigger 
                  value="dashboard" 
                  className="flex items-center gap-2 px-4 py-2 rounded-md transition-all font-bold data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Dashboard</span>
                </TabsTrigger>
                
                <TabsTrigger 
                  value="production" 
                  className="flex items-center gap-2 px-4 py-2 rounded-md transition-all font-bold data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>Production</span>
                </TabsTrigger>
                
                <TabsTrigger 
                  value="scrap" 
                  className="flex items-center gap-2 px-4 py-2 rounded-md transition-all font-bold data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  <AlertCircle className="h-4 w-4" />
                  <span>Scrap Entry</span>
                </TabsTrigger>
                
                <TabsTrigger 
                  value="rn" 
                  className="flex items-center gap-2 px-4 py-2 rounded-md transition-all font-bold data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  <FileText className="h-4 w-4" />
                  <span>RN Generation</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex items-center gap-4">
              {controls && (
                <div className="flex items-center gap-2">
                  {controls}
                </div>
              )}
              
              {/* Mobile Menu Trigger */}
              <div className="md:hidden">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="end">
                    <TabsList className="flex flex-col bg-transparent h-auto p-0 gap-1">
                      <TabsTrigger value="main" className="w-full justify-start gap-2 px-3 py-2 font-bold">
                        <FileText className="h-4 w-4" /> Main Report
                      </TabsTrigger>
                      <TabsTrigger value="dashboard" className="w-full justify-start gap-2 px-3 py-2 font-bold">
                        <LayoutDashboard className="h-4 w-4" /> Dashboard
                      </TabsTrigger>
                      <TabsTrigger value="production" className="w-full justify-start gap-2 px-3 py-2 font-bold">
                        <PlusCircle className="h-4 w-4" /> Production
                      </TabsTrigger>
                      <TabsTrigger value="scrap" className="w-full justify-start gap-2 px-3 py-2 font-bold">
                        <AlertCircle className="h-4 w-4" /> Scrap Entry
                      </TabsTrigger>
                      <TabsTrigger value="rn" className="w-full justify-start gap-2 px-3 py-2 font-bold">
                        <FileText className="h-4 w-4" /> RN Generation
                      </TabsTrigger>
                    </TabsList>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-[1600px] mx-auto">
            <TabsContent value="main" className="mt-0 outline-none">
              <MainReport />
            </TabsContent>

            <TabsContent value="dashboard" className="mt-0 outline-none">
              <Dashboard />
            </TabsContent>
            
            <TabsContent value="production" className="mt-0 outline-none">
              <ProductionEntry />
            </TabsContent>
            
            <TabsContent value="scrap" className="mt-0 outline-none">
              <ScrapEntry />
            </TabsContent>
            
            <TabsContent value="rn" className="mt-0 outline-none">
              <RNReport />
            </TabsContent>
          </div>
        </main>
      </Tabs>
    </div>
  );
}

export default function App() {
  return (
    <SidebarProvider>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </SidebarProvider>
  );
}
