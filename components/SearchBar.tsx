'use client';
import { Search } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative w-full max-w-md mb-8">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="text-neutral-400" size={20} />
      </div>
      <input
        type="text"
        className="block w-full pl-10 pr-3 py-2.5 border-0 rounded-full bg-neutral-800 text-white placeholder-neutral-400 focus:ring-2 focus:ring-white sm:text-sm transition-all"
        placeholder="Search for titles, artists, or albums..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
