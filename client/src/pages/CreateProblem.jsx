import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { problemApi } from '../services/problemApi';

export default function CreateProblem() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [difficulty, setDifficulty] = useState('medium');
    const [timeLimit, setTimeLimit] = useState(2);
    const [memoryLimit, setMemoryLimit] = useState(256);
    // Default to all 7 supported languages
    const [languagesAllowed, setLanguagesAllowed] = useState([71, 63, 62, 54, 50, 998, 999]);

    // Dynamic Test Cases
    const [testCases, setTestCases] = useState([{ input: '', expectedOutput: '', isHidden: false }]);

    const handleAddTestCase = () => {
        setTestCases([...testCases, { input: '', expectedOutput: '', isHidden: false }]);
    };

    const handleRemoveTestCase = (index) => {
        setTestCases(testCases.filter((_, i) => i !== index));
    };

    const handleTestCaseChange = (index, field, value) => {
        const updated = [...testCases];
        updated[index][field] = value;
        setTestCases(updated);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                if (Array.isArray(parsed)) {
                    setTestCases(parsed);
                    setError(null);
                    // show a tiny success message
                    alert(`Successfully loaded ${parsed.length} test cases!`);
                } else {
                    setError('JSON file must contain an array of objects.');
                }
            } catch (err) {
                setError('Invalid JSON file format.');
            }
        };
        reader.readAsText(file);
        e.target.value = null; // reset input
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Filter out completely empty test cases
        const cleanedCases = testCases.filter((tc) => tc.input.trim() || tc.expectedOutput.trim());

        if (cleanedCases.length === 0) {
            setError('Please provide at least one valid test case.');
            setLoading(false);
            return;
        }

        try {
            await problemApi.createProblem({
                title,
                description,
                difficulty,
                timeLimit: Number(timeLimit),
                memoryLimit: Number(memoryLimit),
                languagesAllowed,
                testCases: cleanedCases,
            });

            // Redirect to contests dashboard or show success
            navigate('/contests');
        } catch (err) {
            setError(err.response?.data?.message || err.response?.data?.error || 'Failed to create problem');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen pt-[72px] pb-12" style={{ backgroundColor: 'var(--lc-bg)', color: 'var(--lc-text-primary)' }}>
            <div className="max-w-4xl mx-auto px-4">

                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <button onClick={() => navigate(-1)}
                        className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:-translate-x-1"
                        style={{ backgroundColor: 'var(--lc-card)', border: '1px solid var(--lc-border)' }}>
                        <span className="text-[#ffa116] font-bold">←</span>
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-white uppercase tracking-tight">Create Problem</h1>
                        <p className="text-sm font-mono" style={{ color: 'var(--lc-text-secondary)' }}>Add a new challenge to the database</p>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 px-4 py-3 rounded-xl border flex items-center gap-3"
                        style={{ backgroundColor: 'rgba(248,113,113,0.1)', borderColor: 'rgba(248,113,113,0.3)', color: '#f87171' }}>
                        <span>⚠️</span>
                        <p className="text-sm font-bold">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Metadata Card */}
                    <div className="p-6 rounded-2xl space-y-5" style={{ backgroundColor: 'var(--lc-card)', border: '1px solid var(--lc-border)' }}>
                        <h2 className="text-lg font-black text-white uppercase tracking-wider mb-2 border-b pb-2" style={{ borderColor: 'var(--lc-border)' }}>
                            1. Metadata
                        </h2>

                        <div className="space-y-2">
                            <label className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400">Title</label>
                            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
                                placeholder="e.g. Reverse Integer"
                                className="w-full bg-black/40 border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-all placeholder:text-gray-600"
                                style={{ borderColor: 'var(--lc-border)' }}
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400">Difficulty</label>
                                <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
                                    className="w-full bg-black/40 border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                                    style={{ borderColor: 'var(--lc-border)' }}>
                                    <option value="easy">🟩 Easy</option>
                                    <option value="medium">🟨 Medium</option>
                                    <option value="hard">🟥 Hard</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400">Time Limit (s)</label>
                                <input type="number" min="0.5" step="0.5" value={timeLimit} onChange={e => setTimeLimit(e.target.value)} required
                                    className="w-full bg-black/40 border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none font-mono"
                                    style={{ borderColor: 'var(--lc-border)' }} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400">Memory Limit (MB)</label>
                                <input type="number" min="16" step="16" value={memoryLimit} onChange={e => setMemoryLimit(e.target.value)} required
                                    className="w-full bg-black/40 border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none font-mono"
                                    style={{ borderColor: 'var(--lc-border)' }} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400">Description (Markdown Supported)</label>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} required rows={6}
                                placeholder={"Write the problem description here...\n\nExample:\nGiven a string `s`, return the reversed string."}
                                className="w-full bg-black/40 border rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all font-mono placeholder:text-gray-600"
                                style={{ borderColor: 'var(--lc-border)' }} />
                        </div>
                    </div>

                    {/* Test Cases Card */}
                    <div className="p-6 rounded-2xl relative" style={{ backgroundColor: 'var(--lc-card)', border: '1px solid var(--lc-border)' }}>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b pb-4" style={{ borderColor: 'var(--lc-border)' }}>
                            <div>
                                <h2 className="text-lg font-black text-white uppercase tracking-wider">2. Test Cases</h2>
                                <p className="text-xs font-mono text-gray-500 mt-1">Define inputs and expected outputs.</p>
                            </div>

                            <div className="flex items-center gap-3">
                                {/* Upload Button */}
                                <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all hover:opacity-80"
                                    style={{ backgroundColor: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', color: '#38bdf8' }}>
                                    <span>📂 BULK JSON</span>
                                    <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
                                </label>

                                {/* Add Manual Button */}
                                <button type="button" onClick={handleAddTestCase}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all hover:opacity-80"
                                    style={{ backgroundColor: 'rgba(0,184,163,0.1)', border: '1px solid rgba(0,184,163,0.2)', color: '#00b8a3' }}>
                                    + ADD MANUAL
                                </button>
                            </div>
                        </div>

                        {testCases.length === 0 ? (
                            <div className="text-center py-8 text-xs font-mono text-gray-500">No test cases added. Please add at least one.</div>
                        ) : (
                            <div className="space-y-4">
                                {testCases.map((tc, idx) => (
                                    <div key={idx} className="p-4 rounded-xl relative group" style={{ backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--lc-border)' }}>

                                        {/* Test Case Header (Number + Hidden Toggle + Delete) */}
                                        <div className="flex items-center justify-between mb-3 border-b pb-2" style={{ borderColor: 'var(--lc-border)' }}>
                                            <span className="text-xs font-mono font-bold text-[#ffa116]">CASE #{idx + 1}</span>

                                            <div className="flex items-center gap-4">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input type="checkbox" checked={tc.isHidden} onChange={(e) => handleTestCaseChange(idx, 'isHidden', e.target.checked)}
                                                        className="w-4 h-4 rounded appearance-none border checked:bg-[#f87171] checked:border-[#f87171] transition-all cursor-pointer"
                                                        style={{ borderColor: 'var(--lc-border)' }} />
                                                    <span className="text-xs font-mono text-gray-400 uppercase">Hidden (Points)</span>
                                                </label>

                                                {testCases.length > 1 && (
                                                    <button type="button" onClick={() => handleRemoveTestCase(idx)}
                                                        className="text-gray-500 hover:text-[#f87171] transition-colors p-1" title="Delete Test Case">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                                            <path d="M18 6L6 18M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid sm:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500">Input (stdin)</label>
                                                <textarea value={tc.input} onChange={(e) => handleTestCaseChange(idx, 'input', e.target.value)} required rows={2}
                                                    className="w-full bg-black/60 border rounded-lg px-3 py-2 text-xs text-white focus:outline-none font-mono"
                                                    style={{ borderColor: 'var(--lc-border)' }} />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500">Expected Output (stdout)</label>
                                                <textarea value={tc.expectedOutput} onChange={(e) => handleTestCaseChange(idx, 'expectedOutput', e.target.value)} required rows={2}
                                                    className="w-full bg-black/60 border rounded-lg px-3 py-2 text-xs text-white focus:outline-none font-mono"
                                                    style={{ borderColor: 'var(--lc-border)' }} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end pt-4">
                        <button type="submit" disabled={loading}
                            className="flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-mono font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: 'linear-gradient(135deg,#ffa116,#ff7a00)', color: '#1a1a1a', boxShadow: '0 0 20px rgba(255,161,22,0.3)' }}>
                            {loading ? 'Creating...' : 'Create Problem'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
