import { MoreVertical, Edit, Copy, Trash2, Calendar, Clock } from 'lucide-react';
import { useState } from 'react';
import type { Schedule } from '../../electron/database/schema';
import { formatDuration } from '../../utils/timeUtils';

interface ScheduleListItemProps {
  schedule: Schedule;
  itemCount?: number;
  totalDuration?: number;
  lastModified?: string;
  onEdit: () => void;
  onClone: () => void;
  onDelete: () => void;
  onSelect?: () => void;
  isSelected?: boolean;
}

export default function ScheduleListItem({
  schedule,
  itemCount = 0,
  totalDuration = 0,
  lastModified,
  onEdit,
  onClone,
  onDelete,
  onSelect,
  isSelected = false,
}: ScheduleListItemProps) {
  const [showMenu, setShowMenu] = useState(false);

  const handleMenuAction = (action: () => void) => {
    setShowMenu(false);
    action();
  };

  return (
    <div
      onClick={onSelect}
      className={`group relative flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all ${
        isSelected
          ? 'bg-primary/10 border-primary/30'
          : 'bg-transparent border-text/10 hover:bg-text/5 hover:border-text/20'
      }`}
    >
      {/* Icon */}
      <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
        isSelected ? 'bg-primary/20' : 'bg-text/5'
      }`}>
        <Calendar size={18} className={isSelected ? 'text-primary' : 'text-text/50'} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Name */}
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-bold text-text truncate">
            {schedule.name}
          </h4>
          {schedule.serviceType && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-text/5 text-text/50 shrink-0">
              {schedule.serviceType}
            </span>
          )}
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-3 mt-1 text-[11px] text-text/50">
          {schedule.date && (
            <span className="flex items-center gap-1">
              <Calendar size={10} />
              {new Date(schedule.date).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
              })}
            </span>
          )}
          
          <span>•</span>
          <span>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
          
          {totalDuration > 0 && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock size={10} />
                {formatDuration(totalDuration)}
              </span>
            </>
          )}
          
          {lastModified && (
            <>
              <span>•</span>
              <span>{lastModified}</span>
            </>
          )}
        </div>
      </div>

      {/* Actions Menu */}
      <div className="relative shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="p-1.5 rounded hover:bg-text/10 transition-colors opacity-0 group-hover:opacity-100"
        >
          <MoreVertical size={16} />
        </button>

        {/* Dropdown */}
        {showMenu && (
          <>
            <div 
              className="fixed inset-0 z-10" 
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
              }}
            />
            <div className="absolute right-0 top-full mt-1 w-40 bg-surface border border-text/10 rounded-lg shadow-lg z-20 py-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMenuAction(onEdit);
                }}
                className="w-full px-3 py-2 text-left text-xs hover:bg-text/5 flex items-center gap-2 text-text"
              >
                <Edit size={12} />
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMenuAction(onClone);
                }}
                className="w-full px-3 py-2 text-left text-xs hover:bg-text/5 flex items-center gap-2 text-text"
              >
                <Copy size={12} />
                Clone
              </button>
              <div className="my-1 border-t border-text/10" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMenuAction(onDelete);
                }}
                className="w-full px-3 py-2 text-left text-xs hover:bg-red-500/10 flex items-center gap-2 text-red-400"
              >
                <Trash2 size={12} />
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
