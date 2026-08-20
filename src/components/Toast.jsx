import { useEffect } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

export default function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-4 left-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-white text-sm
      ${type === 'success' ? 'bg-success' : 'bg-danger'}`}>
      {type === 'success' ? <CheckCircle size={18} /> : <XCircle size={18} />}
      {message}
    </div>
  );
}
