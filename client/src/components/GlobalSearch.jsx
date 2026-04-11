import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { TYPE_META } from './TaskCard.jsx';

export default function GlobalSearch({ onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ tasks: [], projects: [] });
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
    
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults({ tasks: [], projects: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/search?q=${encodeURIComponent(query)}`);
        setResults(data);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const allResults = [
    ...results.projects.map(p => ({ ...p, type: 'project' })),
    ...results.tasks.map(t => ({ ...t, type: 'task' }))
  ];

  const handleSelect = (item) => {
    if (item.type === 'project') {
      navigate(`/projects/${item.id}/board`);
    } else {
      navigate(`/projects/${item.project_id}/tasks/${item.key_prefix}-${item.task_number}`);
    }
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(allResults.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + allResults.length) % Math.max(allResults.length, 1));
    } else if (e.key === 'Enter') {
      if (allResults[selectedIndex]) {
        handleSelect(allResults[selectedIndex]);
      }
    }
  };

  return (
    <div className="search-backdrop" onClick={onClose}>
      <div className="search-palette" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Search for tasks, projects..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <span className="search-hint">ESC to close</span>
        </div>

        <div className="search-results-container">
          {query.trim().length < 2 ? (
            <div className="search-empty-state">
              <div style={{ fontSize: 24, marginBottom: 8 }}>⌨️</div>
              <div>Type at least 2 characters to search...</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Try searching for task IDs like "TF-1" or project names</div>
            </div>
          ) : loading ? (
            <div className="search-loading">
              <div className="loading-spinner" style={{ width: 24, height: 24 }} />
              <span>Searching...</span>
            </div>
          ) : allResults.length === 0 ? (
            <div className="search-empty-state">
              <div>No results found for "{query}"</div>
            </div>
          ) : (
            <div className="search-results-list">
              {results.projects.length > 0 && <div className="search-category">Projects</div>}
              {results.projects.map((p, i) => (
                <div
                  key={`p-${p.id}`}
                  className={`search-result-item ${selectedIndex === i ? 'active' : ''}`}
                  onClick={() => handleSelect({ ...p, type: 'project' })}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <div className="result-icon project">📁</div>
                  <div className="result-content">
                    <div className="result-title">{p.name}</div>
                    <div className="result-sub">{p.key_prefix} project</div>
                  </div>
                  <div className="result-action">Jump to board →</div>
                </div>
              ))}

              {results.tasks.length > 0 && <div className="search-category">Tasks</div>}
              {results.tasks.map((t, i) => {
                const idx = i + results.projects.length;
                const tm = TYPE_META[t.task_type] || TYPE_META.task;
                return (
                  <div
                    key={`t-${t.id}`}
                    className={`search-result-item ${selectedIndex === idx ? 'active' : ''}`}
                    onClick={() => handleSelect({ ...t, type: 'task' })}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <div className="result-icon task">{tm.icon}</div>
                    <div className="result-content">
                      <div className="result-title">
                        <span className="result-key">{t.key_prefix}-{t.task_number}</span>
                        {t.title}
                      </div>
                      <div className="result-sub">in {t.project_name} • {t.status}</div>
                    </div>
                    <div className="result-action">View details →</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="search-footer">
          <div className="search-footer-item"><span>↑↓</span> to navigate</div>
          <div className="search-footer-item"><span>↵</span> to select</div>
          <div className="search-footer-item"><span>ESC</span> to close</div>
        </div>
      </div>
    </div>
  );
}
