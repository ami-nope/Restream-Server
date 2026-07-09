// ============================================
// DestinationList Component
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import { Destination, DestinationState } from '../../types';
import { api } from '../../utils/api';
import DestinationCard from './DestinationCard';
import DestinationModal from './DestinationModal';

interface DestinationListProps {
  relayStates: DestinationState[];
}

const DestinationList: React.FC<DestinationListProps> = ({ relayStates }) => {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDest, setEditingDest] = useState<Destination | null>(null);

  const fetchDestinations = useCallback(async () => {
    try {
      const data = await api.getDestinations();
      setDestinations(data.destinations);
    } catch (err) {
      console.error('Failed to fetch destinations:', err);
    }
  }, []);

  useEffect(() => {
    fetchDestinations();
  }, [fetchDestinations]);

  const handleEdit = (dest: Destination) => {
    setEditingDest(dest);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditingDest(null);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setDestinations((prev) => prev.filter((d) => d.id !== id));
  };

  const handleSaved = () => {
    fetchDestinations();
  };

  const getRelayState = (id: string): DestinationState | undefined => {
    return relayStates.find((rs) => rs.id === id);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-100">Destinations</h2>
          <p className="text-sm text-gray-500 mt-1">
            {destinations.length} destination{destinations.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <button onClick={handleAdd} className="btn-primary">
          + Add Destination
        </button>
      </div>

      {/* Destination grid */}
      {destinations.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-5xl mb-4">📡</p>
          <h3 className="text-lg font-semibold text-gray-300 mb-2">No Destinations</h3>
          <p className="text-sm text-gray-500 mb-6">
            Add your first RTMP destination to start relaying your stream.
          </p>
          <button onClick={handleAdd} className="btn-primary">
            + Add Destination
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {destinations.map((dest) => (
            <DestinationCard
              key={dest.id}
              destination={dest}
              relayState={getRelayState(dest.id)}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onRefresh={fetchDestinations}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <DestinationModal
        isOpen={modalOpen}
        destination={editingDest}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
};

export default DestinationList;
