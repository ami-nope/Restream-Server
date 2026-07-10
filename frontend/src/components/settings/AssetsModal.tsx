// ============================================
// AssetsModal Component — Manage stream assets
// ============================================

import React, { useEffect, useState } from 'react';
import { api } from '../../utils/api';

interface AssetsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AssetInfo {
  exists: boolean;
  name?: string;
  size?: number;
  url?: string;
}

const ASSET_TYPES = [
  { id: 'brb', label: 'BRB Placeholder', desc: 'Streamed when OBS stream disconnects', required: true },
  { id: 'starting_soon', label: 'Starting Soon Image', desc: 'Placeholder for stream intro', required: false, note: 'For future use' },
  { id: 'ending', label: 'Ending Image', desc: 'Placeholder for stream outro', required: false, note: 'For future use' },
  { id: 'offline', label: 'Offline Image', desc: 'Placeholder when stream is fully stopped', required: false, note: 'For future use' },
];

function formatBytes(bytes?: number): string {
  if (bytes === undefined) return '-';
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const AssetsModal: React.FC<AssetsModalProps> = ({ isOpen, onClose }) => {
  const [assets, setAssets] = useState<Record<string, AssetInfo>>({});
  const [loading, setLoading] = useState(true);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      void loadAssets();
    }
  }, [isOpen]);

  const loadAssets = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAssets();
      setAssets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (type: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingType(type);
    setError(null);
    try {
      await api.uploadAsset(type, file);
      await loadAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload asset');
    } finally {
      setUploadingType(null);
    }
  };

  const handleDelete = async (type: string) => {
    if (!window.confirm(`Are you sure you want to delete the "${type}" asset?`)) return;

    setError(null);
    try {
      await api.deleteAsset(type);
      await loadAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete asset');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-2xl p-6 relative animate-zoom-in flex flex-col max-h-[90vh] overflow-y-auto border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-white/[0.06] mb-5">
          <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
            📁 Stream Assets Manager
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-sm font-bold p-1 select-none"
            title="Close Assets Manager"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-red-300 text-xs">
            ⚠ {error}
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading assets list...</div>
        ) : (
          <div className="space-y-5">
            {ASSET_TYPES.map((assetDef) => {
              const asset = assets[assetDef.id] || { exists: false };

              return (
                <div
                  key={assetDef.id}
                  className="bg-white/[0.01] border border-white/[0.04] p-4 rounded-xl flex flex-col md:flex-row gap-4 justify-between items-start md:items-center"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-200">{assetDef.label}</span>
                      {assetDef.note && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-white/[0.04] text-gray-500 border border-white/5 uppercase">
                          {assetDef.note}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-500 block mt-0.5">{assetDef.desc}</span>

                    {asset.exists && asset.name && (
                      <div className="mt-2 flex items-center gap-3 bg-white/[0.02] border border-white/[0.03] p-1.5 rounded-lg w-fit">
                        {asset.url && (
                          <img
                            src={asset.url}
                            alt={assetDef.label}
                            className="w-10 h-10 object-cover rounded-md border border-white/10"
                          />
                        )}
                        <div className="text-[10px]">
                          <p className="text-gray-300 font-semibold truncate max-w-[200px]">
                            {asset.name}
                          </p>
                          <p className="text-gray-500">{formatBytes(asset.size)}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center gap-2 w-full md:w-auto justify-end">
                    {uploadingType === assetDef.id ? (
                      <span className="text-xs text-accent-light animate-pulse">Uploading...</span>
                    ) : asset.exists ? (
                      <>
                        <label className="btn-secondary text-xs !px-3 !py-1.5 cursor-pointer">
                          Replace File
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileChange(assetDef.id, e)}
                            className="hidden"
                          />
                        </label>
                        <button
                          onClick={() => handleDelete(assetDef.id)}
                          className="btn-danger text-xs !px-3 !py-1.5"
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <label className="btn-primary text-xs !px-4 !py-2 cursor-pointer">
                        Upload Image
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileChange(assetDef.id, e)}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetsModal;
