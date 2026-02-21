import { useState } from 'react';
import { X, MapPin, Calendar, Clock, Loader } from 'lucide-react';

const EventModal = ({ isOpen, onClose, onSubmit, loading }) => {
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    location: '',
    description: ''
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const dateTime = new Date(`${formData.date}T${formData.time}`);
    onSubmit({
      ...formData,
      date: dateTime.toISOString()
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      {/* Container - MODIF : dark:bg-gray-900 et dark:border */}
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-200 border dark:border-gray-800 transition-colors">
        
        {/* Header - Reste en primary-500 car il ressort bien dans les deux modes */}
        <div className="bg-primary-500 p-4 flex justify-between items-center text-white">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Schedule a Date
          </h3>
          <button onClick={onClose} className="hover:bg-white/20 rounded-full p-1 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              {/* MODIF : dark:text-gray-300 */}
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors">Date</label>
              <input
                type="date"
                required
                className="w-full input p-2 border rounded-lg dark:border-gray-700"
                min={new Date().toISOString().split('T')[0]}
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors">Time</label>
              <input
                type="time"
                required
                className="w-full input p-2 border rounded-lg dark:border-gray-700"
                value={formData.time}
                onChange={e => setFormData({ ...formData, time: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors">Location</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                required
                placeholder="Where are we meeting?"
                className="w-full input pl-10 p-2 border rounded-lg dark:border-gray-700"
                value={formData.location}
                onChange={e => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors">Activity / Note</label>
            <textarea
              placeholder="Let's grab a coffee or go for a walk..."
              className="w-full input p-3 border rounded-lg h-24 resize-none dark:border-gray-700"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              maxLength={500}
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 rounded-lg flex items-center justify-center gap-2 font-medium cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99]"
            >
              {loading ? <Loader className="w-5 h-5 animate-spin" /> : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventModal;