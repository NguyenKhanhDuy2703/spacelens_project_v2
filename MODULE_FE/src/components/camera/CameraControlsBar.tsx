import React from 'react';
import { Search, Grid, List, Plus } from 'lucide-react';
import { ViewMode } from '@/types/ui.types';

interface CameraControlsBarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  locationFilter: string;
  onLocationFilterChange: (val: string) => void;
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  locations?: string[];
  onOpenAddModal: () => void;
}

export default function CameraControlsBar({
  searchQuery,
  onSearchChange,
  locationFilter,
  onLocationFilterChange,
  statusFilter,
  onStatusFilterChange,
  viewMode,
  onViewModeChange,
  locations = [],
  onOpenAddModal,
}: CameraControlsBarProps): React.JSX.Element {
  return (
    <div className="controls-bar">
      {/* Search Input */}
      <div className="search-input-wrapper relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-secondary)] pointer-events-none"
        />
        <input
          type="text"
          className="search-input pl-8"
          placeholder="Search by camera name, code, location or RTSP..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Filters & View Switches */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Location Dropdown */}
        <select
          className="select-filter"
          value={locationFilter}
          onChange={(e) => onLocationFilterChange(e.target.value)}
        >
          <option value="ALL">All Locations</option>
          {locations.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>

        {/* Status Dropdown */}
        <select
          className="select-filter"
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
        >
          <option value="ALL">All Statuses</option>
          <option value="STREAMING">Streaming / Ready</option>
          <option value="AI_ACTIVE">AI Worker Active</option>
          <option value="RECONNECTING">Reconnecting / Error</option>
          <option value="INACTIVE">Inactive</option>
        </select>

        {/* Grid / List View Toggle */}
        <div className="view-toggle-group">
          <button
            type="button"
            className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => onViewModeChange('grid')}
            title="Grid Card View"
          >
            <Grid size={14} />
          </button>
          <button
            type="button"
            className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => onViewModeChange('list')}
            title="List Table View"
          >
            <List size={14} />
          </button>
        </div>

        {/* Add Camera Button (Primary Accent) */}
        <button type="button" className="btn btn-primary" onClick={onOpenAddModal}>
          <Plus size={14} />
          <span>Add Camera</span>
        </button>
      </div>
    </div>
  );
}
