import React from 'react';
import { Search, Filter, Grid, List, Plus } from 'lucide-react';

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
}) {
  return (
    <div className="controls-bar">
      {/* Search Input */}
      <div className="search-input-wrapper">
        <Search
          size={14}
          color="var(--color-secondary)"
          style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}
        />
        <input
          type="text"
          className="search-input"
          placeholder="Search by camera name, IP, or RTSP endpoint..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Filters & View Switches */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
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
          <option value="CONNECTED">Connected Only</option>
          <option value="AI_ACTIVE">AI Worker Active</option>
          <option value="RECONNECTING">Reconnecting / Error</option>
        </select>

        {/* Grid / List View Toggle */}
        <div className="view-toggle-group">
          <button
            className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => onViewModeChange('grid')}
            title="Grid Card View"
          >
            <Grid size={14} />
          </button>
          <button
            className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => onViewModeChange('list')}
            title="List Table View"
          >
            <List size={14} />
          </button>
        </div>

        {/* Add Camera Button (Primary Accent) */}
        <button className="btn btn-primary" onClick={onOpenAddModal}>
          <Plus size={14} />
          <span>Add Camera</span>
        </button>
      </div>
    </div>
  );
}
