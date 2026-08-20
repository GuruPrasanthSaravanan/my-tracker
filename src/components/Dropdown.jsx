import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Plus } from 'lucide-react';

export default function Dropdown({ label, options, value, onChange, onAddNew }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const containerRef = useRef(null);

  // Close the dropdown when tapping/clicking outside of it, so it doesn't
  // stay open and visually overlap fields below it on mobile.
  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [isOpen]);

  const filtered = options.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  const showAddNew = onAddNew && search.trim() && !options.some(
    (opt) => opt.toLowerCase() === search.trim().toLowerCase()
  );

  const handleAddNew = async () => {
    const newValue = search.trim();
    if (!newValue || isAdding) return;
    setIsAdding(true);
    try {
      const resolvedValue = await onAddNew(newValue);
      onChange(resolvedValue || newValue);
      setIsOpen(false);
      setSearch('');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
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
              disabled={isAdding}
              className="w-full px-2 py-1 text-sm border rounded disabled:opacity-50" autoFocus
            />
          </div>
          {showAddNew && (
            <button
              onClick={handleAddNew}
              disabled={isAdding}
              className="w-full px-3 py-2 text-left text-sm text-primary font-medium flex items-center gap-1 hover:bg-blue-50 border-b disabled:opacity-60"
            >
              <Plus size={14} /> {isAdding ? 'Adding...' : `Add "${search.trim()}"`}
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
