"use client";

import { useState, useEffect } from 'react';
import { Users, Send, BarChart3, Bot, X, Sparkles, RefreshCcw, Search, Filter, Edit3, CheckCircle2, UserCircle, Activity, Layers, Trash2, History, RotateCcw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Toaster, toast } from 'sonner';

export default function CRMDashboard() {
  const [activeTab, setActiveTab] = useState('audience');
  
  // 1. Audience & Pagination State
  const [customers, setCustomers] = useState([]);
  const [isLoadingAudience, setIsLoadingAudience] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('total_spent');
  const [minSpent, setMinSpent] = useState(0);
  const [maxSpent, setMaxSpent] = useState(999999);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [availableSources, setAvailableSources] = useState<string[]>(["All Data"]);
  const [selectedSource, setSelectedSource] = useState("All Data");

  // 2. Customer 360 Drawer State
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  // 3. AI Copilot State
  const [campaignName, setCampaignName] = useState('');
  const [audiencePrompt, setAudiencePrompt] = useState('');
  const [draftTemplate, setDraftTemplate] = useState('');
  const [copilotPhase, setCopilotPhase] = useState<'input' | 'review' | 'dispatched'>('input');
  const [isProcessing, setIsProcessing] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<any>(null);

  // 4. Analytics State
  const [metricsId, setMetricsId] = useState('');
  const [metricsData, setMetricsData] = useState<any>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  // 5. Campaign Manager & History State
  const [campaignList, setCampaignList] = useState([]);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<number[]>([]);

  // --- Derived State for Tabs ---
  const activeCampaigns = campaignList.filter((c: any) => c.status !== 'deleted');
  const deletedCampaigns = campaignList.filter((c: any) => c.status === 'deleted');

  // --- API Calls ---

  // Fetch Sources
  useEffect(() => {
    fetch('http://localhost:8000/api/v1/customers/sources')
      .then(res => res.json())
      .then(data => setAvailableSources(["All Data", ...data.sources]))
      .catch(() => toast.error("Could not fetch data sources."));
  }, [refreshTrigger]);

  // Fetch Audience
  useEffect(() => {
    setIsLoadingAudience(true);
    fetch(`http://localhost:8000/api/v1/customers?page=${currentPage}&limit=10&sort_by=${sortBy}&min_spent=${minSpent}&max_spend=${maxSpent}&source_filter=${selectedSource}&t=${refreshTrigger}`)
      .then(res => res.json())
      .then(data => {
        setCustomers(data.customers);
        setTotalPages(data.total_pages);
        setTotalCount(data.total_count);
        setIsLoadingAudience(false);
      })
      .catch(() => {
        toast.error("Failed to load audience data. Is the backend running?");
        setIsLoadingAudience(false);
      });
  }, [currentPage, sortBy, minSpent, maxSpent, refreshTrigger, selectedSource]);

  // Reset to page 1 if we change filters
  useEffect(() => {
    setCurrentPage(1);
  }, [minSpent, maxSpent, sortBy, selectedSource]);

  // Fetch Campaigns for Manager & History Tabs
  const fetchCampaigns = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/campaigns');
      const data = await res.json();
      setCampaignList(data.campaigns);
    } catch {
      toast.error("Failed to fetch campaigns.");
    }
  };

  // Load campaigns when tab is opened
  useEffect(() => {
    if (activeTab === 'manager' || activeTab === 'history') {
      fetchCampaigns();
      setSelectedCampaignIds([]); 
    }
  }, [activeTab]);

  // Handle CSV Upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    try {
      const res = await fetch('http://localhost:8000/api/v1/customers/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) throw new Error("Upload failed");
      
      const data = await res.json();
      toast.success(`Success! Added ${data.count} new, Updated ${data.updated || 0} existing.`);
      
      setCurrentPage(1);
      setRefreshTrigger(prev => prev + 1); 
    } catch {
      toast.error("Failed to upload CSV file. Ensure emails are unique.");
    } finally {
      setIsUploading(false);
      event.target.value = ''; 
    }
  };

  const handleGenerateDraft = async () => {
    if (!campaignName || !audiencePrompt) return toast.error("Please fill in campaign details");
    setIsProcessing(true);
    try {
      const res = await fetch('http://localhost:8000/api/v1/campaigns/generate-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: campaignName, channel: 'WhatsApp', audience_criteria: audiencePrompt, message_template: "" })
      });
      const data = await res.json();
      setDraftTemplate(data.suggested_template);
      
      setMinSpent(data.min_spend);
      setMaxSpent(data.max_spend);
      
      setCopilotPhase('review');
      toast.success(`AI Draft Generated! Targeting spend between $${data.min_spend} - $${data.max_spend}`);
    } catch { toast.error("Draft generation failed"); }
    setIsProcessing(false);
  };

  const handleDispatch = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch('http://localhost:8000/api/v1/campaigns/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: campaignName, 
          channel: 'WhatsApp', 
          template: draftTemplate, 
          min_spend: minSpent,
          max_spend: maxSpent,
          source_filter: selectedSource
        })
      });
      const data = await res.json();
      setDispatchResult(data);
      setCopilotPhase('dispatched');
      toast.success(`Dispatched to ${data.recipients_count} customers!`);
    } catch { toast.error("Dispatch failed"); }
    setIsProcessing(false);
  };

  const fetchAnalytics = async () => {
    if (!metricsId) return;
    setIsLoadingAnalytics(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 600));
      const res = await fetch(`http://localhost:8000/api/v1/campaigns/${metricsId}/analytics`);
      const data = await res.json();
      setMetricsData({
        chart: Object.entries(data.metrics).map(([key, val]) => ({ name: key, value: val }))
      });
    } catch { 
      toast.error("Could not fetch analytics."); 
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  // Bulk Action Handler
  const handleBulkAction = async (action: 'delete' | 'restore' | 'hard_delete') => {
    if (selectedCampaignIds.length === 0) return toast.error("No campaigns selected");
    try {
      await fetch('http://localhost:8000/api/v1/campaigns/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_ids: selectedCampaignIds, action })
      });
      toast.success(`Successfully processed campaigns.`);
      setSelectedCampaignIds([]);
      fetchCampaigns(); 
    } catch {
      toast.error("Failed to perform bulk action.");
    }
  };

  const filteredCustomers = (customers || []).filter((c: any) => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      <Toaster position="top-right" theme="dark" richColors />
      
      {/* SIDEBAR */}
      <aside className="w-72 bg-slate-900 border-r border-slate-800 p-6 flex flex-col shadow-2xl z-10">
        <div className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400 font-extrabold text-3xl mb-10 flex items-center gap-3 tracking-tight">
          <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20"><Bot size={28} /></div>
          Xeno AI
        </div>
        <nav className="space-y-3">
          {[
            { id: 'audience', label: 'Audience Studio', icon: Users },
            { id: 'campaigns', label: 'AI Copilot', icon: Send },
            { id: 'manager', label: 'Active Campaigns', icon: Layers }, 
            { id: 'history', label: 'Campaign History', icon: History }, 
            { id: 'analytics', label: 'Matrix Insights', icon: BarChart3 }
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id)} 
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all duration-200 font-medium ${
                activeTab === item.id 
                  ? 'bg-indigo-500/10 text-indigo-300 shadow-sm border border-indigo-500/20' 
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <item.icon size={20} className={activeTab === item.id ? 'text-indigo-400' : 'text-slate-500'} />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-10 overflow-y-auto relative">
        <header className="mb-8 flex justify-between items-end">
           <div>
             <h1 className="text-3xl font-bold text-slate-100 tracking-tight capitalize">
               {activeTab.replace('-', ' ')}
             </h1>
             <p className="text-slate-400 mt-1 text-sm">Manage and analyze your intelligent workflows.</p>
           </div>
        </header>

        <div className="bg-slate-900 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.4)] border border-slate-800 p-8 min-h-[600px] transition-all relative overflow-hidden flex flex-col">
          
          {/* 1. AUDIENCE TAB */}
          {activeTab === 'audience' && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col h-full flex-1">
               <div className="flex gap-4 mb-6">
                 <div className="relative flex-1">
                   <Search className="absolute left-3 top-3.5 text-slate-500" size={18} />
                   <input 
                     className="w-full pl-10 p-3 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-slate-200"
                     placeholder="Search customers by name or email..."
                     onChange={(e) => setSearchQuery(e.target.value)}
                   />
                 </div>
                 
                 <div className="relative w-36">
                   <Filter className="absolute left-3 top-3.5 text-slate-500" size={18} />
                   <input 
                     type="number"
                     value={minSpent || ''}
                     className="w-full pl-10 p-3 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-slate-200"
                     placeholder="Min ($)"
                     onChange={(e) => setMinSpent(Number(e.target.value) || 0)}
                   />
                 </div>

                 <div className="relative w-36">
                   <Filter className="absolute left-3 top-3.5 text-slate-500" size={18} />
                   <input 
                     type="number"
                     value={maxSpent === 999999 ? '' : maxSpent}
                     className="w-full pl-10 p-3 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-slate-200"
                     placeholder="Max ($)"
                     onChange={(e) => setMaxSpent(e.target.value ? Number(e.target.value) : 999999)}
                   />
                 </div>
                 
                 <select 
                    value={selectedSource}
                    onChange={(e) => setSelectedSource(e.target.value)}
                    className="bg-slate-950 border border-slate-800 px-4 py-3 rounded-xl text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/50"
                 >
                    {availableSources.map(src => <option key={src} value={src}>{src}</option>)}
                 </select>

                 <div className="relative">
                    <input type="file" id="csv-upload" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={isUploading}/>
                    <label htmlFor="csv-upload" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-semibold cursor-pointer transition-colors shadow-md h-full">
                      {isUploading ? <RefreshCcw className="animate-spin" size={18} /> : <Users size={18} />}
                      {isUploading ? "Ingesting..." : "Import CSV"}
                    </label>
                 </div>
               </div>

               <div className="flex-1 border border-slate-800/50 rounded-xl flex flex-col overflow-hidden">
                 <div className="overflow-auto flex-1">
                   <table className="w-full text-left">
                     <thead className="bg-slate-950/50 sticky top-0 z-10 backdrop-blur-md">
                       <tr className="border-b border-slate-800 text-slate-500 text-sm uppercase tracking-wider">
                         <th className="p-4 font-semibold">Customer Name</th>
                         <th className="p-4 font-semibold">Email Address</th>
                         <th className="p-4 font-semibold text-right">Lifetime Value</th>
                       </tr>
                     </thead>
                     <tbody>
                       {isLoadingAudience ? (
                         [...Array(10)].map((_, i) => (
                           <tr key={i} className="border-b border-slate-800/50">
                             <td className="p-5"><div className="h-4 bg-slate-800 rounded animate-pulse w-3/4"></div></td>
                             <td className="p-5"><div className="h-4 bg-slate-800 rounded animate-pulse w-1/2"></div></td>
                             <td className="p-5 flex justify-end"><div className="h-6 bg-slate-800 rounded-full animate-pulse w-16"></div></td>
                           </tr>
                         ))
                       ) : filteredCustomers.length === 0 ? (
                         <tr>
                           <td colSpan={3} className="p-10 text-center text-slate-500">No customers found matching criteria.</td>
                         </tr>
                       ) : (
                         filteredCustomers.map((c: any) => (
                           <tr 
                             key={c.id} 
                             onClick={() => setSelectedCustomer(c)}
                             className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group cursor-pointer"
                           >
                             <td className="p-5 font-medium text-slate-200">{c.name}</td>
                             <td className="p-5 text-slate-400">{c.email}</td>
                             <td className="p-5 text-right">
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-colors">
                                  ${c.total_spent?.toFixed(2) || "0.00"}
                                </span>
                             </td>
                           </tr>
                         ))
                       )}
                     </tbody>
                   </table>
                 </div>
                 
                 {!isLoadingAudience && totalCount > 0 && (
                   <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800/50 bg-slate-950/30">
                     <span className="text-sm text-slate-500">
                       Showing <span className="font-medium text-slate-300">{(currentPage - 1) * 10 + 1}</span> to <span className="font-medium text-slate-300">{Math.min(currentPage * 10, totalCount)}</span> of <span className="font-medium text-slate-300">{totalCount}</span> results
                     </span>
                     <div className="flex gap-2">
                       <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="px-4 py-2 border border-slate-700 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50 transition-colors">Previous</button>
                       <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="px-4 py-2 border border-slate-700 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50 transition-colors">Next</button>
                     </div>
                   </div>
                 )}
               </div>
             </div>
          )}
          {/* 2. AI COPILOT TAB */}
          {activeTab === 'campaigns' && (
            <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              {copilotPhase === 'input' && (
                <div className="space-y-5">
                  <div className="p-1 mb-2 inline-flex bg-indigo-500/10 text-indigo-300 rounded-lg text-sm font-semibold items-center gap-2 px-3 py-1.5 border border-indigo-500/20">
                    <Sparkles size={16} /> AI Intelligence Engine
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Campaign Name</label>
                    <input className="w-full p-3.5 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/50 bg-slate-950 text-slate-100" placeholder="e.g., Q3 VIP Reactivation" onChange={e => setCampaignName(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Target Audience Context</label>
                    <textarea className="w-full p-3.5 border border-slate-700 rounded-xl h-36 focus:ring-2 focus:ring-indigo-500/50 bg-slate-950 text-slate-100 resize-none" placeholder="e.g., Find shoppers who spend less than $120..." onChange={e => setAudiencePrompt(e.target.value)} />
                  </div>
                  <button onClick={handleGenerateDraft} disabled={isProcessing} className="w-full bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white p-4 rounded-xl font-semibold shadow-[0_0_20px_rgba(99,102,241,0.2)] transition-all flex justify-center items-center gap-2 disabled:opacity-50">
                    {isProcessing ? <><RefreshCcw className="animate-spin" size={20} /> Analyzing...</> : <><Edit3 size={20} /> Generate AI Draft</>}
                  </button>
                </div>
              )}

              {copilotPhase === 'review' && (
                <div className="space-y-5 animate-in fade-in zoom-in-95 duration-300">
                  <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl flex justify-between items-center">
                    <div><h3 className="text-slate-200 font-semibold">{campaignName}</h3><p className="text-slate-400 text-sm truncate w-96">{audiencePrompt}</p></div>
                    <button onClick={() => setCopilotPhase('input')} className="text-indigo-400 text-sm hover:underline">Edit Setup</button>
                  </div>

                  <div className="flex gap-4 p-4 bg-slate-900 border border-slate-700 rounded-xl">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Target Min Spend</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                        <input type="number" value={minSpent} onChange={e => setMinSpent(Number(e.target.value))} className="w-full pl-8 p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 outline-none focus:border-indigo-500 transition-colors" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Target Max Spend</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                        <input type="number" value={maxSpent === 999999 ? '' : maxSpent} onChange={e => setMaxSpent(e.target.value ? Number(e.target.value) : 999999)} placeholder="No Limit" className="w-full pl-8 p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 outline-none focus:border-indigo-500 transition-colors" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">AI Generated Draft</label>
                    <textarea className="w-full p-4 border border-indigo-500/30 rounded-xl h-48 focus:ring-2 focus:ring-indigo-500/50 bg-slate-950 text-indigo-100 resize-none font-medium text-lg leading-relaxed" value={draftTemplate} onChange={e => setDraftTemplate(e.target.value)} />
                  </div>
                  <button onClick={handleDispatch} disabled={isProcessing} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white p-4 rounded-xl font-semibold transition-all">
                    {isProcessing ? <><RefreshCcw className="animate-spin" size={20} /> Dispatching...</> : <><Send size={20} /> Approve & Dispatch</>}
                  </button>
                </div>
              )}
              {copilotPhase === 'dispatched' && (
                <div className="flex flex-col items-center justify-center p-12 text-center border border-slate-800 rounded-2xl bg-slate-900/50 animate-in zoom-in duration-500">
                  <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6"><CheckCircle2 size={40} className="text-emerald-400" /></div>
                  <h3 className="text-2xl font-bold text-slate-100 mb-2">Campaign Live!</h3>
                  <button onClick={() => { setCopilotPhase('input'); setCampaignName(''); setAudiencePrompt(''); }} className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-6 py-3 rounded-xl font-medium transition-colors">Create Another Campaign</button>
                </div>
              )}
            </div>
          )}

          {/* 3. ACTIVE CAMPAIGN MANAGER TAB */}
          {activeTab === 'manager' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col h-full flex-1">
              <div className="flex justify-between items-center mb-6">
                 <div className="flex gap-3">
                   <button
                     onClick={() => handleBulkAction('delete')}
                     disabled={selectedCampaignIds.length === 0}
                     className="bg-red-500/20 text-red-400 hover:bg-red-500/30 px-4 py-2.5 rounded-xl flex items-center gap-2 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-red-500/30"
                   >
                     <Trash2 size={18} /> Move to History
                   </button>
                 </div>
                 <button onClick={fetchCampaigns} className="p-3 text-slate-400 hover:text-slate-200 bg-slate-800 rounded-xl transition-colors border border-slate-700">
                    <RefreshCcw size={18} />
                 </button>
              </div>

              <div className="flex-1 border border-slate-800/50 rounded-xl flex flex-col overflow-hidden">
                <div className="overflow-auto flex-1">
                  <table className="w-full text-left">
                    <thead className="bg-slate-950/50 sticky top-0 z-10 backdrop-blur-md">
                      <tr className="border-b border-slate-800 text-slate-500 text-sm uppercase tracking-wider">
                        <th className="p-5 w-16 text-center">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-slate-700 bg-slate-900 focus:ring-indigo-500 accent-indigo-500"
                            onChange={(e) => {
                              if (e.target.checked) setSelectedCampaignIds(activeCampaigns.map((c:any) => c.id));
                              else setSelectedCampaignIds([]);
                            }}
                            checked={activeCampaigns.length > 0 && selectedCampaignIds.length === activeCampaigns.length}
                          />
                        </th>
                        <th className="p-5 font-semibold">ID</th>
                        <th className="p-5 font-semibold">Campaign Name</th>
                        <th className="p-5 font-semibold">Status</th>
                        <th className="p-5 font-semibold">Targeting</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeCampaigns.map((c: any) => (
                        <tr key={c.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                          <td className="p-5 text-center">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-slate-700 bg-slate-900 focus:ring-indigo-500 accent-indigo-500"
                              checked={selectedCampaignIds.includes(c.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedCampaignIds([...selectedCampaignIds, c.id]);
                                else setSelectedCampaignIds(selectedCampaignIds.filter(id => id !== c.id));
                              }}
                            />
                          </td>
                          <td className="p-5 text-slate-500 font-mono text-sm">#{c.id}</td>
                          <td className="p-5 font-medium text-slate-200">{c.name}</td>
                          <td className="p-5">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20`}>
                              {c.status ? c.status.toUpperCase() : 'ACTIVE'}
                            </span>
                          </td>
                          <td className="p-5 text-slate-400 text-sm truncate max-w-[250px]">{c.audience_criteria}</td>
                        </tr>
                      ))}
                      {activeCampaigns.length === 0 && (
                         <tr><td colSpan={5} className="p-16 text-center text-slate-500 text-lg">No active campaigns currently.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 4. HISTORY TAB (NEW) */}
          {activeTab === 'history' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col h-full flex-1">
              <div className="flex justify-between items-center mb-6">
                 <div className="flex gap-3">
                   <button
                     onClick={() => handleBulkAction('restore')}
                     disabled={selectedCampaignIds.length === 0}
                     className="bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 px-4 py-2.5 rounded-xl flex items-center gap-2 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-indigo-500/30"
                   >
                     <RotateCcw size={18} /> Restore Selected
                   </button>
                   <button
                     onClick={() => handleBulkAction('hard_delete')}
                     disabled={selectedCampaignIds.length === 0}
                     className="bg-red-500/20 text-red-400 hover:bg-red-500/30 px-4 py-2.5 rounded-xl flex items-center gap-2 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-red-500/30"
                   >
                     <Trash2 size={18} /> Permanently Delete
                   </button>
                 </div>
                 <button onClick={fetchCampaigns} className="p-3 text-slate-400 hover:text-slate-200 bg-slate-800 rounded-xl transition-colors border border-slate-700">
                    <RefreshCcw size={18} />
                 </button>
              </div>

              <div className="flex-1 border border-slate-800/50 rounded-xl flex flex-col overflow-hidden">
                <div className="overflow-auto flex-1">
                  <table className="w-full text-left">
                    <thead className="bg-slate-950/50 sticky top-0 z-10 backdrop-blur-md">
                      <tr className="border-b border-slate-800 text-slate-500 text-sm uppercase tracking-wider">
                        <th className="p-5 w-16 text-center">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-slate-700 bg-slate-900 focus:ring-indigo-500 accent-indigo-500"
                            onChange={(e) => {
                              if (e.target.checked) setSelectedCampaignIds(deletedCampaigns.map((c:any) => c.id));
                              else setSelectedCampaignIds([]);
                            }}
                            checked={deletedCampaigns.length > 0 && selectedCampaignIds.length === deletedCampaigns.length}
                          />
                        </th>
                        <th className="p-5 font-semibold">ID</th>
                        <th className="p-5 font-semibold">Campaign Name</th>
                        <th className="p-5 font-semibold">Status</th>
                        <th className="p-5 font-semibold">Targeting</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deletedCampaigns.map((c: any) => (
                        <tr key={c.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors opacity-60 hover:opacity-100">
                          <td className="p-5 text-center">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-slate-700 bg-slate-900 focus:ring-indigo-500 accent-indigo-500"
                              checked={selectedCampaignIds.includes(c.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedCampaignIds([...selectedCampaignIds, c.id]);
                                else setSelectedCampaignIds(selectedCampaignIds.filter(id => id !== c.id));
                              }}
                            />
                          </td>
                          <td className="p-5 text-slate-500 font-mono text-sm">#{c.id}</td>
                          <td className="p-5 font-medium text-slate-200 line-through">{c.name}</td>
                          <td className="p-5">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border bg-slate-800 text-slate-400 border-slate-700">
                              DELETED
                            </span>
                          </td>
                          <td className="p-5 text-slate-400 text-sm truncate max-w-[250px] line-through">{c.audience_criteria}</td>
                        </tr>
                      ))}
                      {deletedCampaigns.length === 0 && (
                         <tr><td colSpan={5} className="p-16 text-center text-slate-500 text-lg">Your history is clean.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 5. MATRIX INSIGHTS TAB */}
          {activeTab === 'analytics' && (
             <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="flex gap-4 p-6 bg-slate-950/50 rounded-2xl border border-slate-800 items-end">
                 <div className="flex-1">
                   <label className="block text-sm font-medium text-slate-300 mb-2">Campaign ID</label>
                   <input className="w-full p-3.5 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/50 bg-slate-900 text-slate-100" placeholder="Enter ID..." onChange={e => setMetricsId(e.target.value)} />
                 </div>
                 <button onClick={fetchAnalytics} disabled={isLoadingAnalytics} className="bg-slate-100 hover:bg-white text-slate-900 px-8 py-3.5 rounded-xl font-bold transition-all">
                    {isLoadingAnalytics ? "Loading..." : "Load Analytics"}
                 </button>
               </div>
               {metricsData && (
                 <div className="h-80 w-full mt-8 p-6 border border-slate-800 rounded-2xl bg-slate-950/30">
                   <ResponsiveContainer width="100%" height="100%"><BarChart data={metricsData.chart}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" fill="#6366f1" /></BarChart></ResponsiveContainer>
                 </div>
               )}
             </div>
          )}
        </div>
      </main>

      {/* CUSTOMER 360 DRAWER */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setSelectedCustomer(null)} />
          <div className="w-full max-w-md bg-slate-900 h-full shadow-[-20px_0_40px_rgba(0,0,0,0.5)] border-l border-slate-800 p-8 animate-in slide-in-from-right duration-300 flex flex-col relative z-10">
             <div className="flex justify-between items-center mb-8">
               <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2"><UserCircle className="text-indigo-400" /> Customer 360</h2>
               <button onClick={() => setSelectedCustomer(null)} className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-full transition-colors"><X size={20} /></button>
             </div>
             
             <div className="space-y-8 flex-1 overflow-y-auto pr-2">
               <div className="text-center pb-6 border-b border-slate-800">
                 <div className="w-24 h-24 bg-indigo-500/20 text-indigo-300 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-4 border border-indigo-500/30">
                   {selectedCustomer.name.charAt(0)}
                 </div>
                 <h3 className="text-2xl font-bold text-slate-100">{selectedCustomer.name}</h3>
                 <p className="text-slate-400">{selectedCustomer.email}</p>
               </div>

               <div className="p-5 bg-gradient-to-br from-indigo-900/40 to-violet-900/40 border border-indigo-500/20 rounded-xl relative overflow-hidden">
                 <div className="absolute -right-4 -top-4 text-indigo-500/10"><Sparkles size={100} /></div>
                 <p className="text-sm text-indigo-300 font-semibold mb-1 flex items-center gap-2"><Activity size={16}/> AI Churn Prediction</p>
                 <p className="text-3xl font-bold text-indigo-100">Low Risk</p>
                 <p className="text-xs text-indigo-300/70 mt-2">Highly engaged in recent campaigns.</p>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                   <p className="text-sm text-slate-500 mb-1">Lifetime Value</p>
                   <p className="text-xl font-bold text-emerald-400">${selectedCustomer.total_spent?.toFixed(2)}</p>
                 </div>
                 <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                   <p className="text-sm text-slate-500 mb-1">Total Orders</p>
                   <p className="text-xl font-bold text-slate-200">{Math.floor(Math.random() * 20) + 1}</p>
                 </div>
               </div>

               <div>
                 <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Audience Segments</h4>
                 <div className="flex gap-2 flex-wrap">
                   <span className="px-3 py-1 bg-slate-800 text-slate-300 rounded-full text-xs font-medium border border-slate-700">VIP Spender</span>
                   <span className="px-3 py-1 bg-slate-800 text-slate-300 rounded-full text-xs font-medium border border-slate-700">WhatsApp Active</span>
                   <span className="px-3 py-1 bg-slate-800 text-slate-300 rounded-full text-xs font-medium border border-slate-700">Summer Promo</span>
                 </div>
               </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}