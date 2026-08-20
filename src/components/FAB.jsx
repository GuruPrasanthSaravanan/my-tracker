import { Plus } from 'lucide-react';

export default function FAB({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-20 right-4 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition z-10"
    >
      <Plus size={24} />
    </button>
  );
}
