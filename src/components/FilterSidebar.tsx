
import React, { useState } from 'react';
import { Filter, ChevronDown, ChevronUp } from 'lucide-react';

interface FilterSidebarProps {
  onFiltersChange: (filters: any) => void;
}

const FilterSidebar: React.FC<FilterSidebarProps> = ({ onFiltersChange }) => {
  const [openSections, setOpenSections] = useState({
    category: true,
    subscribers: true,
    price: true,
    income: true,
    type: true,
  });

  const [filters, setFilters] = useState({
    categories: [] as string[],
    subscriberRange: { min: '', max: '' },
    priceRange: { min: '', max: '' },
    incomeRange: { min: '', max: '' },
    types: [] as string[],
  });

  const categories = [
    'Gaming', 'Music', 'Tech', 'Lifestyle', 'Education', 'Entertainment',
    'Sports', 'News', 'Comedy', 'Cooking', 'Travel', 'Fashion', 'Fitness'
  ];

  const channelTypes = ['Verified', 'Premium', 'Monetized', 'New'];

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleCategoryChange = (category: string) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter(c => c !== category)
      : [...filters.categories, category];
    
    const newFilters = { ...filters, categories: newCategories };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleTypeChange = (type: string) => {
    const newTypes = filters.types.includes(type)
      ? filters.types.filter(t => t !== type)
      : [...filters.types, type];
    
    const newFilters = { ...filters, types: newTypes };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleRangeChange = (field: string, key: string, value: string) => {
    const newFilters = {
      ...filters,
      [field]: { ...filters[field as keyof typeof filters], [key]: value }
    };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    const newFilters = {
      categories: [],
      subscriberRange: { min: '', max: '' },
      priceRange: { min: '', max: '' },
      incomeRange: { min: '', max: '' },
      types: [],
    };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const FilterSection = ({ title, isOpen, onToggle, children }: any) => (
    <div className="border-b border-xsm-medium-gray pb-4 mb-4">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full text-left text-xsm-yellow font-semibold mb-3"
      >
        {title}
        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {isOpen && children}
    </div>
  );

  return (
    <div className="bg-xsm-dark-gray rounded-lg p-6 sticky top-24">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-xsm-yellow flex items-center">
          <Filter className="w-5 h-5 mr-2" />
          Filters
        </h3>
        <button
          onClick={clearFilters}
          className="text-sm text-xsm-light-gray hover:text-xsm-yellow transition-colors"
        >
          Clear All
        </button>
      </div>

      {/* Category Filter */}
      <FilterSection
        title="Category"
        isOpen={openSections.category}
        onToggle={() => toggleSection('category')}
      >
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {categories.map(category => (
            <label key={category} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.categories.includes(category)}
                onChange={() => handleCategoryChange(category)}
                className="rounded border-xsm-medium-gray text-xsm-yellow focus:ring-xsm-yellow"
              />
              <span className="text-sm text-white">{category}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Subscriber Range */}
      <FilterSection
        title="Subscribers"
        isOpen={openSections.subscribers}
        onToggle={() => toggleSection('subscribers')}
      >
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            placeholder="Min"
            value={filters.subscriberRange.min}
            onChange={(e) => handleRangeChange('subscriberRange', 'min', e.target.value)}
            className="xsm-input text-sm"
          />
          <input
            type="number"
            placeholder="Max"
            value={filters.subscriberRange.max}
            onChange={(e) => handleRangeChange('subscriberRange', 'max', e.target.value)}
            className="xsm-input text-sm"
          />
        </div>
      </FilterSection>

      {/* Price Range */}
      <FilterSection
        title="Price Range ($)"
        isOpen={openSections.price}
        onToggle={() => toggleSection('price')}
      >
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            placeholder="Min"
            value={filters.priceRange.min}
            onChange={(e) => handleRangeChange('priceRange', 'min', e.target.value)}
            className="xsm-input text-sm"
          />
          <input
            type="number"
            placeholder="Max"
            value={filters.priceRange.max}
            onChange={(e) => handleRangeChange('priceRange', 'max', e.target.value)}
            className="xsm-input text-sm"
          />
        </div>
      </FilterSection>

      {/* Monthly Income Range */}
      <FilterSection
        title="Monthly Income ($)"
        isOpen={openSections.income}
        onToggle={() => toggleSection('income')}
      >
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            placeholder="Min"
            value={filters.incomeRange.min}
            onChange={(e) => handleRangeChange('incomeRange', 'min', e.target.value)}
            className="xsm-input text-sm"
          />
          <input
            type="number"
            placeholder="Max"
            value={filters.incomeRange.max}
            onChange={(e) => handleRangeChange('incomeRange', 'max', e.target.value)}
            className="xsm-input text-sm"
          />
        </div>
      </FilterSection>

      {/* Channel Type */}
      <FilterSection
        title="Channel Type"
        isOpen={openSections.type}
        onToggle={() => toggleSection('type')}
      >
        <div className="space-y-2">
          {channelTypes.map(type => (
            <label key={type} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.types.includes(type)}
                onChange={() => handleTypeChange(type)}
                className="rounded border-xsm-medium-gray text-xsm-yellow focus:ring-xsm-yellow"
              />
              <span className="text-sm text-white">{type}</span>
            </label>
          ))}
        </div>
      </FilterSection>
    </div>
  );
};

export default FilterSidebar;
