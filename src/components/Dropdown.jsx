import { useState } from 'react';
import { ChevronDown, Check, Plus } from 'lucide-react';

export default function Dropdown({ label, options, value, onChange, onAddNew }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = options.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  const showAddNew = onAddNew && search.trim() && !options.some(
    (opt) => opt.toLowerCase() === search.trim().toLowerCase()
  );

  const handleAddNew = () => {
    const newValue = search.trim();
    if (newValue) {
      onAddNew(newValue);
      onChange(newValue);
      setIsOpen(false);
      setSearch('');
    }
  };

  return (
    <div className="relative">
      <label className="text-xs text-gray-500">{label}</label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full border rounded-lg px-3 py-2 mt-1 flex items-center justify-between text-left"
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {value || `Select ${label}`}
        </span>
        <ChevronDown size={16} className="text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 bg-white border rounded-xl shadow-lg z-20 max-h-48 overflow-auto">
          <div className="p-2 border-b">
            <input
              type="text" placeholder={`Search or type new ${label.toLowerCase()}...`} value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-2 py-1 text-sm border rounded" autoFocus
            />
          </div>
          {showAddNew && (
            <button
              onClick={handleAddNew}
              className="w-full px-3 py-2 text-left text-sm text-primary font-medium flex items-center gap-1 hover:bg-blue-50 border-b"
            >
              <Plus size={14} /> Add "{search.trim()}"
            </button>
          )}
          {filtered.map((opt) => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setIsOpen(false); setSearch(''); }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
            >
              {opt}
              {opt === value && <Check size={14} className="text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
