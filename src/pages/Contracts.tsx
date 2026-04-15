import { useState, useEffect, useRef } from 'react';
import { FileSpreadsheet, UploadCloud, FileDown, Plus, X, Image as ImageIcon, FileText, Loader2, Edit, Trash2 } from 'lucide-react';
import Papa from 'papaparse';
import { supabase } from '../lib/supabase';
import { useSubcontractor } from '../contexts/SubcontractorContext';

interface ContractItem {
    id: string;
    item_number: string;
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    total_price: number;
    is_option: boolean;
}

export default function Contracts() {
    const { selectedSubcontractorId } = useSubcontractor();
    const selectedSubId = selectedSubcontractorId;
    const [items, setItems] = useState<ContractItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [ocrProcessing, setOcrProcessing] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [showAdvancedModal, setShowAdvancedModal] = useState(false);
    const [newItem, setNewItem] = useState({ item_number: '', description: '', quantity: 0, unit: 'stk', unit_price: 0, is_option: false });
    const [editingItem, setEditingItem] = useState<ContractItem | null>(null);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [pastedText, setPastedText] = useState('');
    const [parsedPreview, setParsedPreview] = useState<Partial<ContractItem>[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!selectedSubId) {
            setLoading(false);
            return;
        }

        async function fetchContractItems() {
            setLoading(true);
            const { data, error } = await supabase
                .from('contract_items')
                .select('*')
                .eq('subcontractor_id', selectedSubId)
                .order('item_number', { ascending: true });

            if (!error && data) {
                setItems(data);
            }
            setLoading(false);
        }

        fetchContractItems();
    }, [selectedSubId]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedSubId) return;

        setUploading(true);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const parsedItems = results.data.map((row: any) => ({
                    subcontractor_id: selectedSubId,
                    item_number: row['Postnr'] || row['Item'] || '',
                    description: row['Beskrivelse'] || row['Description'] || 'Ukjent post',
                    quantity: parseFloat(row['Mengde'] || row['Quantity'] || '0'),
                    unit: row['Enhet'] || row['Unit'] || 'stk',
                    unit_price: parseFloat(row['Enhetspris'] || row['Unit Price'] || '0'),
                    total_price: parseFloat(row['Total'] || row['Total Price'] || '0'),
                    is_option: false
                }));

                const { error } = await supabase.from('contract_items').insert(parsedItems);

                if (!error) {
                    setItems([...items, ...parsedItems as any]);
                } else {
                    console.error("Opplasting feilet:", error);
                    alert("Opplasting feilet. Sørg for at kolonnene matcher malen.");
                }

                setUploading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            },
            error: (error) => {
                console.error("Fil parse feil:", error);
                setUploading(false);
                alert("Kunne ikke lese filen.");
            }
        });
    };

    const parseRawText = (text: string) => {
        // Pre-process text to remove common OCR table border artifacts
        let cleanedText = text.replace(/[\[\]\|_—]/g, ' ');
        // We do NOT replace \s+ with ' ' because we want to preserve tabs (\t) from OCR.space

        let prevText = '';
        while (cleanedText !== prevText) {
            prevText = cleanedText;
            cleanedText = cleanedText.replace(/(\d)\s+(\d{3})(?!\d)/g, '$1$2');
        }

        const lines = cleanedText.split('\n');
        const parsedItems: any[] = [];

        const knownUnits = ['stk', 'm', 'm2', 'm3', 'lm', 'kg', 'tonn', 'time', 'timer', 'mnd', 'pk', 'sett', 'post', 'pkt.', 'ls', 'rs', 'mnd.', 'pkt'];

        for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine) continue;

            const isOptionRow = /opsjon/i.test(cleanLine) || newItem.is_option;
            const isTabSeparated = cleanLine.includes('\t');

            let parts = isTabSeparated ? cleanLine.split('\t') : cleanLine.split(/\s+/);
            parts = parts.map(p => p.trim()).filter(p => p.length > 0);

            // Extract numbers from the end
            const numbers: number[] = [];
            let textParts: string[] = [];

            for (let i = parts.length - 1; i >= 0; i--) {
                const part = parts[i];
                const numStr = part.replace(',', '.');
                const cleanNumStr = numStr.replace(/[^0-9.-]/g, '');

                if (/\d/.test(part) && !/[a-zA-Z]{3,}/.test(part) && !isNaN(parseFloat(cleanNumStr))) {
                    numbers.unshift(parseFloat(cleanNumStr));
                } else {
                    textParts = parts.slice(0, i + 1);
                    break;
                }
            }

            if (numbers.length > 0 && textParts.length > 0) {
                let quantity = 0;
                let unit_price = 0;
                let total_price = 0;

                if (numbers.length >= 3) {
                    quantity = numbers[0];
                    unit_price = numbers[1];
                    total_price = numbers[2];
                } else if (numbers.length === 2) {
                    quantity = numbers[0];
                    total_price = numbers[1];
                    unit_price = quantity > 0 ? total_price / quantity : 0;
                } else if (numbers.length === 1) {
                    quantity = 1;
                    total_price = numbers[0];
                    unit_price = total_price;
                }

                let unit = 'stk';
                if (textParts.length > 0) {
                    const lastTextPart = textParts[textParts.length - 1].toLowerCase();
                    // If it's a known unit or very short text (1-3 chars without digits)
                    if (knownUnits.includes(lastTextPart) || (lastTextPart.length <= 3 && !/\d/.test(lastTextPart))) {
                        unit = textParts.pop() || 'stk';
                    }
                }

                let description = textParts.join(' ');

                // If the first part is a number with a dot (like 01.1), treat it as item_number
                let item_number = '';
                if (textParts.length > 1 && /^[\d.]+$/.test(textParts[0])) {
                    item_number = textParts.shift() || '';
                    description = textParts.join(' ');
                }

                // Only add if we found something sensible
                if (description.length > 0) {
                    parsedItems.push({
                        subcontractor_id: selectedSubId,
                        item_number: item_number,
                        description: description,
                        quantity,
                        unit,
                        unit_price: Number(unit_price.toFixed(2)),
                        total_price: Number(total_price.toFixed(2)),
                        is_option: isOptionRow
                    });
                }
            } else if (cleanLine.length > 3) {
                // Informational text line / header (like "Trapperom WC...")
                parsedItems.push({
                    subcontractor_id: selectedSubId,
                    item_number: '',
                    description: cleanLine,
                    quantity: 0,
                    unit: '',
                    unit_price: 0,
                    total_price: 0,
                    is_option: isOptionRow
                });
            }
        }
        return parsedItems;
    };

    const handleTextSubmit = async () => {
        if (!pastedText.trim() || !selectedSubId) return;
        setLoading(true);
        const parsedItems = parseRawText(pastedText);

        if (parsedItems.length > 0) {
            // Only assign sequential numbers if item_number is empty
            const numberedItems = parsedItems.map((item, index) => ({
                ...item,
                item_number: item.item_number || (index + 1).toString()
            }));
            setParsedPreview(numberedItems);
        } else {
            alert("Kunne ikke finne noen brukbare poster i teksten.");
        }
        setLoading(false);
    };

    const handleSavePreview = async () => {
        if (!selectedSubId || parsedPreview.length === 0) return;
        setLoading(true);

        // Ensure calculations are right based on edits
        const itemsToSave = parsedPreview.map(item => ({
            ...item,
            total_price: (item.quantity || 0) * (item.unit_price || 0)
        }));

        const { error } = await supabase.from('contract_items').insert(itemsToSave as any);
        if (!error) {
            setItems([...items, ...itemsToSave as any]);
            setShowAdvancedModal(false);
            setPastedText('');
            setParsedPreview([]);
        } else {
            alert("Feil ved lagring av tekst-poster.");
        }
        setLoading(false);
    };

    const handleUpdatePreviewItem = (index: number, field: string, value: any) => {
        const updated = [...parsedPreview];
        updated[index] = { ...updated[index], [field]: value };
        setParsedPreview(updated);
    };

    const handleRemovePreviewItem = (index: number) => {
        const updated = parsedPreview.filter((_, i) => i !== index);
        setParsedPreview(updated);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedSubId) return;

        setOcrProcessing(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('apikey', 'helloworld'); // Public free test key
            formData.append('language', 'eng'); // OCREngine 2 only fully supports eng, but works well for Norwegian chars like æøå
            formData.append('isTable', 'true');
            formData.append('OCREngine', '2');
            formData.append('scale', 'true');

            const response = await fetch('https://api.ocr.space/parse/image', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.IsErroredOnProcessing) {
                console.error("OCR API Error Details:", result.ErrorMessage);
                alert(`Feil under tolkning: ${Array.isArray(result.ErrorMessage) ? result.ErrorMessage.join(', ') : result.ErrorMessage}`);
            } else if (result.ParsedResults && result.ParsedResults.length > 0) {
                const fullText = result.ParsedResults.map((pr: any) => pr.ParsedText).join('\n');
                setPastedText(fullText);
            } else {
                alert("Fant ingen lesbar tekst i dokumentet.");
            }
        } catch (error) {
            console.error("OCR/Upload Error:", error);
            alert("Feil under opplasting til tolknings-tjenesten.");
        }
        setOcrProcessing(false);
        if (imageInputRef.current) imageInputRef.current.value = '';
    };

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSubId) return;
        setLoading(true);

        const total_price = newItem.quantity * newItem.unit_price;

        const { data, error } = await supabase.from('contract_items').insert([{
            subcontractor_id: selectedSubId,
            item_number: newItem.item_number,
            description: newItem.description,
            quantity: newItem.quantity,
            unit: newItem.unit,
            unit_price: newItem.unit_price,
            total_price: total_price,
            is_option: newItem.is_option
        }]).select();

        if (!error && data) {
            setItems([...items, data[0] as any]);
            setShowModal(false);
            setNewItem({ item_number: '', description: '', quantity: 0, unit: 'stk', unit_price: 0, is_option: false });
        } else {
            alert('En feil oppstod ved lagring av post.');
        }
        setLoading(false);
    };

    const handleUpdateItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingItem || editingIndex === null) return;
        setLoading(true);

        const total_price = editingItem.quantity * editingItem.unit_price;

        const { error } = await supabase
            .from('contract_items')
            .update({
                item_number: editingItem.item_number,
                description: editingItem.description,
                quantity: editingItem.quantity,
                unit: editingItem.unit,
                unit_price: editingItem.unit_price,
                total_price: total_price,
                is_option: editingItem.is_option
            })
            .eq('id', editingItem.id);

        if (!error) {
            const updatedItems = [...items];
            updatedItems[editingIndex] = { ...editingItem, total_price };
            setItems(updatedItems);
            setEditingItem(null);
            setEditingIndex(null);
        } else {
            alert('En feil oppstod ved oppdatering av post.');
        }
        setLoading(false);
    };

    const handleDeleteItem = async (id: string, index: number) => {
        if (!confirm('Er du sikker på at du vil slette denne posten?')) return;
        setLoading(true);

        const { error } = await supabase
            .from('contract_items')
            .delete()
            .eq('id', id);

        if (!error) {
            const updatedItems = items.filter((_, i) => i !== index);
            setItems(updatedItems);
        } else {
            alert('En feil oppstod ved sletting av post.');
        }
        setLoading(false);
    };

    const handleToggleOption = async (id: string, is_option: boolean) => {
        setLoading(true);

        const { error } = await supabase
            .from('contract_items')
            .update({ is_option })
            .eq('id', id);

        if (!error) {
            const updatedItems = items.map(item => 
                item.id === id ? { ...item, is_option } : item
            );
            setItems(updatedItems);
        } else {
            alert('En feil oppstod ved oppdatering av opsjonsstatus.');
        }
        setLoading(false);
    };

    if (!selectedSubId) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                <div className="bg-slate-50 p-6 rounded-full mb-6 ring-8 ring-slate-50/50">
                    <FileSpreadsheet className="w-16 h-16 text-slate-300" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-700">Ingen underentreprenør valgt</h3>
                <p className="text-slate-500 text-center mt-3 font-medium">Vennligst velg en underentreprenør for å se kontraktdetaljer.</p>
            </div>
        );
    }

    const mainItems = items.filter(i => !i.is_option);
    const optionItems = items.filter(i => i.is_option);

    const totalMainSum = mainItems.reduce((sum, item) => sum + Number(item.total_price), 0);
    const totalOptionSum = optionItems.reduce((sum, item) => sum + Number(item.total_price), 0);
    const totalContractSum = totalMainSum + totalOptionSum;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Kontraktdetaljer</h1>
                    <p className="text-slate-500 font-medium text-sm mt-1">Mengdebeskrivelse og avtalt enhetspris register</p>
                </div>
                <div className="flex gap-3">
                    <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="bg-white text-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center shrink-0 disabled:opacity-50"
                    >
                        <UploadCloud className="w-4 h-4 mr-2 text-primary-600" />
                        {uploading ? 'Laster opp...' : 'Importer CSV'}
                    </button>
                    <button
                        onClick={() => { setShowAdvancedModal(true); setParsedPreview([]); }}
                        className="bg-white text-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center shrink-0"
                    >
                        <FileText className="w-4 h-4 mr-2 text-primary-600" />
                        Lim inn tekst / PDF / Bilde
                    </button>
                    <button onClick={() => setShowModal(true)} className="bg-primary-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:bg-primary-700 transition-colors flex items-center shrink-0">
                        <Plus className="w-4 h-4 mr-2" />
                        Ny Post
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Hovedkontrakt</p>
                    <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">{Math.round(totalMainSum).toLocaleString('no-NO')}</h2>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-blue-200/60 bg-blue-50/20">
                    <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">Opsjoner</p>
                    <h2 className="text-2xl font-extrabold text-blue-900 tracking-tight">{Math.round(totalOptionSum).toLocaleString('no-NO')}</h2>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Potensiell Total</p>
                    <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">{Math.round(totalContractSum).toLocaleString('no-NO')}</h2>
                </div>
            </div>

            <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-200/60 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-extrabold text-slate-800 tracking-tight flex items-center">
                        <FileSpreadsheet className="w-5 h-5 mr-3 text-primary-500" />
                        Aktiv Mengdebeskrivelse
                    </h3>
                    <button className="text-slate-500 hover:text-primary-600 hover:bg-primary-50 p-2 rounded-lg transition-colors flex items-center text-xs font-bold">
                        <FileDown className="w-4 h-4 mr-1.5" /> Eksporter
                    </button>
                </div>

                {loading ? (
                    <div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
                ) : mainItems.length === 0 ? (
                    <div className="p-16 flex flex-col items-center justify-center text-center border-b border-dashed border-slate-200 bg-slate-50/30">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <FileSpreadsheet className="w-8 h-8 text-slate-300" />
                        </div>
                        <h4 className="text-lg font-bold text-slate-700 mb-1">Ingen kontraktdetaljer funnet</h4>
                        <p className="text-slate-500 text-sm max-w-sm">Klikk "Importer CSV" eller nytt bilde oppe til høyre for å laste opp tabeller.</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse whitespace-nowrap">
                                <thead>
                                    <tr className="border-b border-slate-200/60 bg-slate-50/30">
                                        <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider w-24">Postnr</th>
                                        <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider min-w-[300px]">Beskrivelse</th>
                                        <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Mengde</th>
                                        <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider text-left pl-2">Enhet</th>
                                        <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Enhetspris</th>
                                        <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Total</th>
                                        <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider w-20">Opsjon</th>
                                        <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider w-20">Handling</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {mainItems.map((item, index) => (
                                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="py-3 px-6 text-sm font-bold text-slate-500">{item.item_number}</td>
                                            <td className="py-3 px-6 text-sm font-bold text-slate-800 whitespace-normal">{item.description}</td>
                                            <td className="py-3 px-6 text-sm font-extrabold text-slate-700 text-right">{item.quantity}</td>
                                            <td className="py-3 px-2 text-xs font-bold text-slate-400 uppercase">{item.unit}</td>
                                            <td className="py-3 px-6 text-sm font-medium text-slate-600 text-right">{item.unit_price.toLocaleString('no-NO')}</td>
                                            <td className="py-3 px-6 text-sm font-extrabold text-slate-900 text-right bg-slate-50/30 group-hover:bg-primary-50/50 transition-colors">{Math.round(item.total_price).toLocaleString('no-NO')}</td>
                                            <td className="py-3 px-6 text-center">
                                                <div className="flex justify-center items-center h-full">
                                                    <input
                                                        type="checkbox"
                                                        checked={item.is_option}
                                                        onChange={() => handleToggleOption(item.id, !item.is_option)}
                                                        className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500"
                                                        title="Marker som opsjon"
                                                    />
                                                </div>
                                            </td>
                                            <td className="py-3 px-6 text-center">
                                                <button
                                                    onClick={() => {
                                                        setEditingItem(item);
                                                        setEditingIndex(index);
                                                        setShowModal(true);
                                                    }}
                                                    className="text-slate-400 hover:text-primary-600 hover:bg-primary-50 p-1.5 rounded-lg transition-colors"
                                                    title="Rediger"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteItem(item.id, index)}
                                                    className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                                    title="Slett"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-200/60 bg-slate-50/30">
                            <button 
                                onClick={() => {
                                    setEditingItem(null);
                                    setEditingIndex(null);
                                    setShowModal(true);
                                }} 
                                className="text-sm font-bold text-primary-600 hover:text-primary-700 flex items-center transition-colors"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Legg til ny rad
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Options Table */}
            {optionItems.length > 0 && (
                <div className="bg-white border border-blue-200/60 rounded-3xl shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-blue-100 bg-blue-50/50 flex justify-between items-center">
                        <h3 className="font-extrabold text-blue-800 tracking-tight flex items-center">
                            Aktivt Opsjonsregister
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse whitespace-nowrap">
                            <thead>
                                <tr className="border-b border-blue-100 bg-blue-50/30">
                                    <th className="py-4 px-6 text-xs font-bold text-blue-400 uppercase tracking-wider w-24">Postnr</th>
                                    <th className="py-4 px-6 text-xs font-bold text-blue-400 uppercase tracking-wider min-w-[300px]">Beskrivelse</th>
                                    <th className="py-4 px-6 text-xs font-bold text-blue-400 uppercase tracking-wider text-right">Mengde</th>
                                    <th className="py-4 px-6 text-xs font-bold text-blue-400 uppercase tracking-wider text-left pl-2">Enhet</th>
                                    <th className="py-4 px-6 text-xs font-bold text-blue-400 uppercase tracking-wider text-right">Enhetspris</th>
                                    <th className="py-4 px-6 text-xs font-bold text-blue-400 uppercase tracking-wider text-right">Total</th>
                                    <th className="py-4 px-6 text-xs font-bold text-blue-400 uppercase tracking-wider w-20">Opsjon</th>
                                    <th className="py-4 px-6 text-xs font-bold text-blue-400 uppercase tracking-wider w-20">Handling</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-blue-50">
                                {optionItems.map((item, index) => (
                                    <tr key={item.id} className="hover:bg-blue-50/50 transition-colors group">
                                        <td className="py-3 px-6 text-sm font-bold text-blue-500">{item.item_number}</td>
                                        <td className="py-3 px-6 text-sm font-bold text-slate-800 whitespace-normal">{item.description}</td>
                                        <td className="py-3 px-6 text-sm font-extrabold text-slate-700 text-right">{item.quantity}</td>
                                        <td className="py-3 px-2 text-xs font-bold text-slate-400 uppercase">{item.unit}</td>
                                        <td className="py-3 px-6 text-sm font-medium text-slate-600 text-right">{item.unit_price.toLocaleString('no-NO')}</td>
                                        <td className="py-3 px-6 text-sm font-extrabold text-blue-900 text-right bg-blue-50/30 group-hover:bg-blue-100/50 transition-colors">{Math.round(item.total_price).toLocaleString('no-NO')}</td>
                                        <td className="py-3 px-6 text-center">
                                            <div className="flex justify-center items-center h-full">
                                                <input
                                                    type="checkbox"
                                                    checked={item.is_option}
                                                    onChange={() => handleToggleOption(item.id, !item.is_option)}
                                                    className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500"
                                                    title="Marker som opsjon"
                                                />
                                            </div>
                                        </td>
                                        <td className="py-3 px-6 text-center">
                                            <button
                                                onClick={() => {
                                                    setEditingItem(item);
                                                    setEditingIndex(index);
                                                    setShowModal(true);
                                                }}
                                                className="text-slate-400 hover:text-primary-600 hover:bg-primary-50 p-1.5 rounded-lg transition-colors"
                                                title="Rediger"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteItem(item.id, index)}
                                                className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                                title="Slett"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-6 py-4 border-t border-blue-100 bg-blue-50/30">
                        <button 
                            onClick={() => {
                                setEditingItem(null);
                                setEditingIndex(null);
                                setShowModal(true);
                            }} 
                            className="text-sm font-bold text-primary-600 hover:text-primary-700 flex items-center transition-colors"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Legg til ny rad
                        </button>
                    </div>
                </div>
            )}

            {/* Add/Edit Contract Item Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-lg font-extrabold text-slate-800">
                                {editingItem ? 'Rediger Mengdebeskrivelse-Post' : 'Ny Mengdebeskrivelse-Post'}
                            </h3>
                            <button onClick={() => {
                                setShowModal(false);
                                setEditingItem(null);
                                setEditingIndex(null);
                            }} className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={editingItem ? handleUpdateItem : handleAddItem} className="p-6 space-y-5">
                            <div className="grid grid-cols-4 gap-4">
                                <div className="col-span-1">
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Postnr</label>
                                    <input 
                                        type="text" 
                                        value={editingItem ? editingItem.item_number : newItem.item_number} 
                                        onChange={(e) => editingItem ? setEditingItem({ ...editingItem, item_number: e.target.value }) : setNewItem({ ...newItem, item_number: e.target.value })} 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium focus:ring-2 focus:ring-primary-500/50" 
                                        placeholder="Eks. 01.1" 
                                    />
                                </div>
                                <div className="col-span-3">
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Beskrivelse</label>
                                    <input 
                                        type="text" 
                                        required 
                                        value={editingItem ? editingItem.description : newItem.description} 
                                        onChange={(e) => editingItem ? setEditingItem({ ...editingItem, description: e.target.value }) : setNewItem({ ...newItem, description: e.target.value })} 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium focus:ring-2 focus:ring-primary-500/50" 
                                        placeholder="Eks. Rigg og Drift" 
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Mengde</label>
                                    <input 
                                        type="number" 
                                        step="0.01" 
                                        required 
                                        value={editingItem ? editingItem.quantity : newItem.quantity} 
                                        onChange={(e) => editingItem ? setEditingItem({ ...editingItem, quantity: Number(e.target.value) }) : setNewItem({ ...newItem, quantity: Number(e.target.value) })} 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium focus:ring-2 focus:ring-primary-500/50" 
                                        placeholder="0" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Enhet</label>
                                    <input 
                                        type="text" 
                                        required 
                                        value={editingItem ? editingItem.unit : newItem.unit} 
                                        onChange={(e) => editingItem ? setEditingItem({ ...editingItem, unit: e.target.value }) : setNewItem({ ...newItem, unit: e.target.value })} 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium focus:ring-2 focus:ring-primary-500/50" 
                                        placeholder="stk, m2, m3" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Enhetspris</label>
                                    <input 
                                        type="number" 
                                        step="0.01" 
                                        required 
                                        value={editingItem ? editingItem.unit_price : newItem.unit_price} 
                                        onChange={(e) => editingItem ? setEditingItem({ ...editingItem, unit_price: Number(e.target.value) }) : setNewItem({ ...newItem, unit_price: Number(e.target.value) })} 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium focus:ring-2 focus:ring-primary-500/50" 
                                        placeholder="0" 
                                    />
                                </div>
                            </div>
                            <div className="flex items-center space-x-2 bg-blue-50 p-3 rounded-xl border border-blue-100">
                                <input
                                    type="checkbox"
                                    id="is_option"
                                    checked={editingItem ? editingItem.is_option : newItem.is_option}
                                    onChange={(e) => editingItem ? setEditingItem({ ...editingItem, is_option: e.target.checked }) : setNewItem({ ...newItem, is_option: e.target.checked })}
                                    className="w-5 h-5 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
                                />
                                <label htmlFor="is_option" className="font-bold text-slate-700 text-sm cursor-pointer select-none">
                                    Marker denne posten som en opsjon (ikke en del av hovedkontrakten enda)
                                </label>
                            </div>
                            <div className="pt-2 flex gap-3">
                                <button type="button" onClick={() => {
                                    setShowModal(false);
                                    setEditingItem(null);
                                    setEditingIndex(null);
                                }} className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors">
                                    Avbryt
                                </button>
                                <button disabled={loading} type="submit" className="flex-1 px-4 py-3 bg-primary-600 text-white font-bold rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:bg-primary-700 transition-colors disabled:opacity-50">
                                    {loading ? 'Lagrer...' : (editingItem ? 'Oppdater Post' : 'Lagre Post')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Advanced OCR and Text Paste Modal */}
            {showAdvancedModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-lg font-extrabold text-slate-800">Lim inn tekst, last opp PDF eller bilde</h3>
                            <button onClick={() => { setShowAdvancedModal(false); setParsedPreview([]); }} className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            {parsedPreview.length === 0 ? (
                                <>
                                    <input
                                        type="file"
                                        accept="image/*,.pdf"
                                        className="hidden"
                                        ref={imageInputRef}
                                        onChange={handleImageUpload}
                                    />

                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-sm font-bold text-slate-700">Lim inn tabell, eller la oss lese dokumentet ditt automatisk:</label>
                                        <button
                                            type="button"
                                            disabled={ocrProcessing}
                                            onClick={() => imageInputRef.current?.click()}
                                            className="text-xs font-bold px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg flex items-center transition-colors disabled:opacity-50"
                                        >
                                            {ocrProcessing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5 mr-1.5" />}
                                            Last opp PDF / bilde for auto-tolking
                                        </button>
                                    </div>

                                    <textarea
                                        value={pastedText}
                                        onChange={(e) => setPastedText(e.target.value)}
                                        rows={10}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-slate-800"
                                        placeholder="Eks.
01.1 Rigg og drift 1 stk 15000 15000
01.2 Utgraving 50 m3 200 10000"
                                    />

                                    <div className="flex items-center space-x-2 bg-blue-50 p-3 rounded-xl border border-blue-100">
                                        <input
                                            type="checkbox"
                                            id="is_option_batch"
                                            checked={newItem.is_option}
                                            onChange={(e) => setNewItem({ ...newItem, is_option: e.target.checked })}
                                            className="w-5 h-5 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
                                        />
                                        <label htmlFor="is_option_batch" className="font-bold text-slate-700 text-sm cursor-pointer select-none">
                                            Marker alle disse postene som Opsjon
                                        </label>
                                    </div>

                                    <div className="pt-2 flex gap-3">
                                        <button type="button" onClick={() => { setShowAdvancedModal(false); setParsedPreview([]); }} className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors">
                                            Avbryt
                                        </button>
                                        <button onClick={handleTextSubmit} disabled={loading || ocrProcessing} className="flex-1 px-4 py-3 bg-primary-600 text-white font-bold rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:bg-primary-700 transition-colors disabled:opacity-50">
                                            {loading ? 'Tolker...' : 'Tolk Tekst/Bilde'}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="mb-2">
                                        <h4 className="text-sm font-bold text-slate-700">Se over tolkede poster før lagring</h4>
                                        <p className="text-xs text-slate-500">Korriger kolonnene der bilde-tolkingen (OCR) har tatt feil av antall og pris.</p>
                                    </div>

                                    <div className="max-h-[50vh] overflow-y-auto border border-slate-200 rounded-xl bg-slate-50">
                                        <table className="w-full text-left text-sm whitespace-nowrap">
                                            <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                                                <tr>
                                                    <th className="py-2 px-3 font-bold text-slate-600 w-16">Postnr</th>
                                                    <th className="py-2 px-3 font-bold text-slate-600 min-w-[200px]">Beskrivelse</th>
                                                    <th className="py-2 px-3 font-bold text-slate-600 w-24">Mengde</th>
                                                    <th className="py-2 px-3 font-bold text-slate-600 w-20">Enhet</th>
                                                    <th className="py-2 px-3 font-bold text-slate-600 w-28 text-right">Enhetspris</th>
                                                    <th className="py-2 px-3 font-bold text-slate-600 w-20 text-center">Opsjon</th>
                                                    <th className="py-2 px-3 font-bold text-slate-600 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200/60">
                                                {parsedPreview.map((item, idx) => (
                                                    <tr key={idx} className={`hover:bg-white transition-colors group ${item.is_option ? 'bg-blue-50/30' : ''}`}>
                                                        <td className="p-1.5"><input type="text" value={item.item_number || ''} onChange={(e) => handleUpdatePreviewItem(idx, 'item_number', e.target.value)} className="w-full bg-transparent border border-transparent group-hover:bg-white group-hover:border-slate-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-primary-500 focus:bg-white focus:border-primary-500 transition-all font-medium" placeholder="Eks. 01.1" /></td>
                                                        <td className="p-1.5"><input type="text" value={item.description || ''} onChange={(e) => handleUpdatePreviewItem(idx, 'description', e.target.value)} className="w-full bg-transparent border border-transparent group-hover:bg-white group-hover:border-slate-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-primary-500 focus:bg-white focus:border-primary-500 transition-all text-slate-800" /></td>
                                                        <td className="p-1.5"><input type="number" step="any" value={item.quantity === undefined ? '' : item.quantity} onChange={(e) => handleUpdatePreviewItem(idx, 'quantity', e.target.value ? Number(e.target.value) : '')} className="w-full bg-transparent border border-transparent group-hover:bg-white group-hover:border-slate-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-primary-500 focus:bg-white focus:border-primary-500 transition-all text-right font-extrabold text-slate-700" placeholder="0" /></td>
                                                        <td className="p-1.5"><input type="text" value={item.unit || ''} onChange={(e) => handleUpdatePreviewItem(idx, 'unit', e.target.value)} className="w-full bg-transparent border border-transparent group-hover:bg-white group-hover:border-slate-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-primary-500 focus:bg-white focus:border-primary-500 transition-all font-bold text-slate-500" placeholder="Eks. m2" /></td>
                                                        <td className="p-1.5"><input type="number" step="any" value={item.unit_price === undefined ? '' : item.unit_price} onChange={(e) => handleUpdatePreviewItem(idx, 'unit_price', e.target.value ? Number(e.target.value) : '')} className="w-full bg-transparent border border-transparent group-hover:bg-white group-hover:border-slate-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-primary-500 focus:bg-white focus:border-primary-500 transition-all text-right font-medium text-slate-600" placeholder="0" /></td>
                                                        <td className="p-1.5 text-center">
                                                            <div className="flex justify-center items-center h-full">
                                                                <input type="checkbox" checked={item.is_option || false} onChange={(e) => handleUpdatePreviewItem(idx, 'is_option', e.target.checked)} className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500" title="Marker som opsjon" />
                                                            </div>
                                                        </td>
                                                        <td className="p-1.5"><button onClick={() => handleRemovePreviewItem(idx)} className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors w-full flex justify-center"><X className="w-4 h-4" /></button></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {parsedPreview.length === 0 && (
                                            <div className="p-8 text-center text-slate-500 font-medium">Alle poster er fjernet. Gå tilbake for å tolke på nytt.</div>
                                        )}
                                    </div>

                                    <div className="pt-4 flex gap-3 border-t border-slate-100 mt-2">
                                        <button type="button" onClick={() => setParsedPreview([])} className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors">
                                            Gå tilbake for å endre bilde/tekst
                                        </button>
                                        <button onClick={handleSavePreview} disabled={loading || parsedPreview.length === 0} className="flex-1 px-4 py-3 bg-primary-600 text-white font-bold rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center">
                                            {loading ? 'Lagrer...' : `Lagre ${parsedPreview.length} Poster permanent`}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
