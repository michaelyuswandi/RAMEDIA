import { useState } from 'react';
import { Download, Trash2, Check } from 'lucide-react';
import { useBibleManager } from '../../hooks/useBibleManager';
import type { BibleVersion } from '../../electron/database/schema';

interface BibleTranslationSelectorProps {
  value?: string;
  onChange?: (versionId: string) => void;
  onDownload?: () => void;
  showDownloadButton?: boolean;
  compact?: boolean;
}

/**
 * Bible Translation Selector Component
 * Allows user to switch between downloaded Bible translations
 */
export function BibleTranslationSelector({
  value,
  onChange,
  onDownload,
  showDownloadButton = true,
  compact = false,
}: BibleTranslationSelectorProps) {
  const {
    versions,
    activeVersion,
    isLoading,
    storageStats,
    switchVersion,
    deleteVersion,
  } = useBibleManager();

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleSelect = async (version: BibleVersion) => {
    try {
      await switchVersion(version.id);
      onChange?.(version.id);
    } catch (error) {
      console.error('Failed to switch version:', error);
    }
  };

  const handleDelete = async (e: React.MouseEvent, versionId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this translation?')) {
      try {
        await deleteVersion(versionId);
      } catch (error) {
        console.error('Failed to delete version:', error);
      }
    }
  };

  const shouldHighlight = value || activeVersion?.id;

  if (isLoading) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="animate-pulse">Loading translations...</div>
      </div>
    );
  }

  if (compact) {
    // Compact dropdown view
    return (
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Translation:</label>
        <select
          value={shouldHighlight || ''}
          onChange={(e) => {
            const version = versions.find(v => v.id === e.target.value);
            if (version) handleSelect(version);
          }}
          className="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          <option value="">Choose translation...</option>
          {versions.map(version => (
            <option key={version.id} value={version.id}>
              {version.name} ({version.code})
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Full view
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Bible Translations</h3>
        {storageStats && (
          <span className="text-xs text-gray-500">
            {storageStats.biblesCount} translation(s), {storageStats.totalSizeInMB.toFixed(1)} MB
          </span>
        )}
      </div>

      {versions.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">No translations downloaded yet</p>
          {showDownloadButton && (
            <button
              onClick={onDownload}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              <Download size={16} />
              Download Translation
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {versions.map(version => (
            <div
              key={version.id}
              onMouseEnter={() => setHoveredId(version.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => handleSelect(version)}
              className={`p-3 rounded-lg cursor-pointer transition-all ${
                shouldHighlight === version.id
                  ? 'bg-blue-100 border border-blue-300'
                  : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium text-gray-800">
                    {version.name}
                    {version.isActive && (
                      <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {version.code} • {version.language || 'Unknown language'}
                    {version.downloadedAt && (
                      <span className="ml-2">
                        (Downloaded {new Date(version.downloadedAt).toLocaleDateString()})
                      </span>
                    )}
                  </div>
                </div>

                {shouldHighlight === version.id && (
                  <Check size={20} className="text-blue-600" />
                )}

                {hoveredId === version.id && (
                  <button
                    onClick={(e) => handleDelete(e, version.id)}
                    className="ml-2 p-2 hover:bg-red-100 rounded-lg transition-colors"
                    title="Delete translation"
                  >
                    <Trash2 size={16} className="text-red-600" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {showDownloadButton && (
            <button
              onClick={onDownload}
              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
            >
              <Download size={16} />
              Download Another Translation
            </button>
          )}
        </div>
      )}
    </div>
  );
}
